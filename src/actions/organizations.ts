'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { organization, member, invitation, user } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';

// ============================================================================
// Types
// ============================================================================

export type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

export interface CreateOrganizationInput {
  name: string;
  slug?: string;
  plan: SubscriptionPlan;
}

export interface OrganizationWithRole {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  createdAt: Date;
  role: 'owner' | 'admin' | 'member';
  memberCount?: number;
}

export interface PendingInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  role: 'owner' | 'admin' | 'member';
  inviterName: string;
  expiresAt: Date;
  createdAt: Date;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  
  if (!session?.user?.id) {
    return null;
  }
  
  return session.user;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ============================================================================
// Organization Actions
// ============================================================================

/**
 * Get user's current organization membership
 */
export async function getUserOrganization(): Promise<ActionResult<OrganizationWithRole | null>> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const membership = await db.query.member.findFirst({
      where: eq(member.userId, authUser.id),
      with: {
        organization: true,
      },
    });

    if (!membership?.organization) {
      return { success: true, data: null };
    }

    // Get member count
    const members = await db
      .select()
      .from(member)
      .where(eq(member.organizationId, membership.organization.id));

    return {
      success: true,
      data: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        logo: membership.organization.logo,
        createdAt: membership.organization.createdAt,
        role: membership.role,
        memberCount: members.length,
      },
    };
  } catch (error) {
    console.error('Failed to get user organization:', error);
    return { success: false, error: 'Failed to get organization' };
  }
}

/**
 * Create a new organization
 */
export async function createOrganization(
  input: CreateOrganizationInput
): Promise<ActionResult<OrganizationWithRole>> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if user already has an organization
    const existingMembership = await db.query.member.findFirst({
      where: eq(member.userId, authUser.id),
    });

    if (existingMembership) {
      return { success: false, error: 'You are already a member of an organization' };
    }

    // Generate slug if not provided
    const slug = input.slug || generateSlug(input.name);

    // Check if slug is taken
    const existingOrg = await db.query.organization.findFirst({
      where: eq(organization.slug, slug),
    });

    if (existingOrg) {
      return { success: false, error: 'Organization name is already taken' };
    }

    const orgId = nanoid();
    const memberId = nanoid();

    // Create organization
    const [newOrg] = await db.insert(organization).values({
      id: orgId,
      name: input.name,
      slug,
      logo: null,
      createdAt: new Date(),
      metadata: JSON.stringify({
        plan: input.plan,
        createdBy: authUser.id,
        trialEndsAt: input.plan === 'free' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
      }),
    }).returning();

    // Add user as owner
    await db.insert(member).values({
      id: memberId,
      organizationId: orgId,
      userId: authUser.id,
      role: 'owner',
      createdAt: new Date(),
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');

    return {
      success: true,
      data: {
        id: newOrg.id,
        name: newOrg.name,
        slug: newOrg.slug,
        logo: newOrg.logo,
        createdAt: newOrg.createdAt,
        role: 'owner',
        memberCount: 1,
      },
    };
  } catch (error) {
    console.error('Failed to create organization:', error);
    return { success: false, error: 'Failed to create organization' };
  }
}

/**
 * Get pending invitations for the current user
 */
export async function getPendingInvitations(): Promise<ActionResult<PendingInvitation[]>> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get user's email
    const userData = await db.query.user.findFirst({
      where: eq(user.id, authUser.id),
    });

    if (!userData?.email) {
      return { success: false, error: 'User email not found' };
    }

    // Get pending invitations for this email
    const invitations = await db.query.invitation.findMany({
      where: and(
        eq(invitation.email, userData.email),
        eq(invitation.status, 'pending'),
        gt(invitation.expiresAt, new Date())
      ),
      with: {
        organization: true,
        inviter: true,
      },
    });

    return {
      success: true,
      data: invitations.map((inv) => ({
        id: inv.id,
        organizationId: inv.organizationId,
        organizationName: inv.organization.name,
        role: inv.role,
        inviterName: inv.inviter.name,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    };
  } catch (error) {
    console.error('Failed to get pending invitations:', error);
    return { success: false, error: 'Failed to get invitations' };
  }
}

/**
 * Accept an invitation to join an organization
 */
export async function acceptInvitation(
  invitationId: string
): Promise<ActionResult<OrganizationWithRole>> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get the invitation
    const inv = await db.query.invitation.findFirst({
      where: and(
        eq(invitation.id, invitationId),
        eq(invitation.status, 'pending'),
        gt(invitation.expiresAt, new Date())
      ),
      with: {
        organization: true,
      },
    });

    if (!inv) {
      return { success: false, error: 'Invitation not found or expired' };
    }

    // Verify email matches
    const userData = await db.query.user.findFirst({
      where: eq(user.id, authUser.id),
    });

    if (userData?.email !== inv.email) {
      return { success: false, error: 'This invitation is for a different email address' };
    }

    // Check if user already has an organization
    const existingMembership = await db.query.member.findFirst({
      where: eq(member.userId, authUser.id),
    });

    if (existingMembership) {
      return { success: false, error: 'You are already a member of an organization' };
    }

    // Create membership
    const memberId = nanoid();
    await db.insert(member).values({
      id: memberId,
      organizationId: inv.organizationId,
      userId: authUser.id,
      role: inv.role,
      createdAt: new Date(),
    });

    // Mark invitation as accepted
    await db
      .update(invitation)
      .set({ status: 'accepted' })
      .where(eq(invitation.id, invitationId));

    // Get member count
    const members = await db
      .select()
      .from(member)
      .where(eq(member.organizationId, inv.organizationId));

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');

    return {
      success: true,
      data: {
        id: inv.organization.id,
        name: inv.organization.name,
        slug: inv.organization.slug,
        logo: inv.organization.logo,
        createdAt: inv.organization.createdAt,
        role: inv.role,
        memberCount: members.length,
      },
    };
  } catch (error) {
    console.error('Failed to accept invitation:', error);
    return { success: false, error: 'Failed to accept invitation' };
  }
}

/**
 * Decline an invitation
 */
export async function declineInvitation(
  invitationId: string
): Promise<ActionResult<void>> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get the invitation
    const inv = await db.query.invitation.findFirst({
      where: eq(invitation.id, invitationId),
    });

    if (!inv) {
      return { success: false, error: 'Invitation not found' };
    }

    // Verify email matches
    const userData = await db.query.user.findFirst({
      where: eq(user.id, authUser.id),
    });

    if (userData?.email !== inv.email) {
      return { success: false, error: 'This invitation is for a different email address' };
    }

    // Mark invitation as declined
    await db
      .update(invitation)
      .set({ status: 'declined' })
      .where(eq(invitation.id, invitationId));

    revalidatePath('/dashboard/setup');

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to decline invitation:', error);
    return { success: false, error: 'Failed to decline invitation' };
  }
}

/**
 * Invite a user to the organization
 */
export async function inviteUser(
  email: string,
  role: 'admin' | 'member' = 'member'
): Promise<ActionResult<{ invitationId: string }>> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get user's organization and check permissions
    const membership = await db.query.member.findFirst({
      where: eq(member.userId, authUser.id),
      with: {
        organization: true,
      },
    });

    if (!membership?.organization) {
      return { success: false, error: 'You are not a member of an organization' };
    }

    // Only owners and admins can invite
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return { success: false, error: 'You do not have permission to invite users' };
    }

    // Check if user is already a member
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, email),
    });

    if (existingUser) {
      const existingMember = await db.query.member.findFirst({
        where: and(
          eq(member.userId, existingUser.id),
          eq(member.organizationId, membership.organizationId)
        ),
      });

      if (existingMember) {
        return { success: false, error: 'User is already a member of this organization' };
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await db.query.invitation.findFirst({
      where: and(
        eq(invitation.email, email),
        eq(invitation.organizationId, membership.organizationId),
        eq(invitation.status, 'pending'),
        gt(invitation.expiresAt, new Date())
      ),
    });

    if (existingInvitation) {
      return { success: false, error: 'An invitation has already been sent to this email' };
    }

    // Create invitation (expires in 7 days)
    const invitationId = nanoid();
    await db.insert(invitation).values({
      id: invitationId,
      organizationId: membership.organizationId,
      email,
      role,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      inviterId: authUser.id,
      createdAt: new Date(),
    });

    // TODO: Send invitation email
    console.log(`[Invitation] Sent to ${email} for organization ${membership.organization.name}`);

    revalidatePath('/dashboard/settings');

    return { success: true, data: { invitationId } };
  } catch (error) {
    console.error('Failed to invite user:', error);
    return { success: false, error: 'Failed to send invitation' };
  }
}

/**
 * Update organization settings
 */
export async function updateOrganization(
  input: { name?: string; logo?: string }
): Promise<ActionResult<OrganizationWithRole>> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get user's organization and check permissions
    const membership = await db.query.member.findFirst({
      where: eq(member.userId, authUser.id),
      with: {
        organization: true,
      },
    });

    if (!membership?.organization) {
      return { success: false, error: 'You are not a member of an organization' };
    }

    // Only owners can update organization settings
    if (membership.role !== 'owner') {
      return { success: false, error: 'Only organization owners can update settings' };
    }

    const [updatedOrg] = await db
      .update(organization)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.logo !== undefined && { logo: input.logo }),
      })
      .where(eq(organization.id, membership.organizationId))
      .returning();

    // Get member count
    const members = await db
      .select()
      .from(member)
      .where(eq(member.organizationId, membership.organizationId));

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');

    return {
      success: true,
      data: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        slug: updatedOrg.slug,
        logo: updatedOrg.logo,
        createdAt: updatedOrg.createdAt,
        role: membership.role,
        memberCount: members.length,
      },
    };
  } catch (error) {
    console.error('Failed to update organization:', error);
    return { success: false, error: 'Failed to update organization' };
  }
}

/**
 * Get organization members (for admins/owners)
 */
export async function getOrganizationMembers(): Promise<
  ActionResult<Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'member';
    createdAt: Date;
  }>>
> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const membership = await db.query.member.findFirst({
      where: eq(member.userId, authUser.id),
    });

    if (!membership) {
      return { success: false, error: 'You are not a member of an organization' };
    }

    const members = await db.query.member.findMany({
      where: eq(member.organizationId, membership.organizationId),
      with: {
        user: true,
      },
    });

    return {
      success: true,
      data: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        createdAt: m.createdAt,
      })),
    };
  } catch (error) {
    console.error('Failed to get organization members:', error);
    return { success: false, error: 'Failed to get members' };
  }
}

/**
 * Remove a member from the organization
 */
export async function removeMember(
  memberId: string
): Promise<ActionResult<void>> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const currentMembership = await db.query.member.findFirst({
      where: eq(member.userId, authUser.id),
    });

    if (!currentMembership || currentMembership.role !== 'owner') {
      return { success: false, error: 'Only organization owners can remove members' };
    }

    // Get the member to remove
    const memberToRemove = await db.query.member.findFirst({
      where: eq(member.id, memberId),
    });

    if (!memberToRemove) {
      return { success: false, error: 'Member not found' };
    }

    if (memberToRemove.organizationId !== currentMembership.organizationId) {
      return { success: false, error: 'Member is not in your organization' };
    }

    // Can't remove yourself if you're the owner
    if (memberToRemove.userId === authUser.id) {
      return { success: false, error: 'You cannot remove yourself. Transfer ownership first.' };
    }

    await db.delete(member).where(eq(member.id, memberId));

    revalidatePath('/dashboard/settings');

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to remove member:', error);
    return { success: false, error: 'Failed to remove member' };
  }
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: string;
  expiresAt: Date;
  createdAt: Date;
  inviterName: string;
}

/**
 * Get pending invitations for the organization (for admins/owners)
 */
export async function getOrganizationInvitations(): Promise<
  ActionResult<OrganizationInvitation[]>
> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const membership = await db.query.member.findFirst({
      where: eq(member.userId, authUser.id),
    });

    if (!membership) {
      return { success: false, error: 'You are not a member of an organization' };
    }

    const invitations = await db.query.invitation.findMany({
      where: and(
        eq(invitation.organizationId, membership.organizationId),
        eq(invitation.status, 'pending'),
        gt(invitation.expiresAt, new Date())
      ),
      with: {
        inviter: true,
      },
    });

    return {
      success: true,
      data: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        inviterName: inv.inviter.name,
      })),
    };
  } catch (error) {
    console.error('Failed to get organization invitations:', error);
    return { success: false, error: 'Failed to get invitations' };
  }
}

/**
 * Cancel a pending invitation
 */
export async function cancelInvitation(
  invitationId: string
): Promise<ActionResult<void>> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const membership = await db.query.member.findFirst({
      where: eq(member.userId, authUser.id),
    });

    if (!membership) {
      return { success: false, error: 'You are not a member of an organization' };
    }

    // Only owners and admins can cancel invitations
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return { success: false, error: 'You do not have permission to cancel invitations' };
    }

    const inv = await db.query.invitation.findFirst({
      where: eq(invitation.id, invitationId),
    });

    if (!inv) {
      return { success: false, error: 'Invitation not found' };
    }

    if (inv.organizationId !== membership.organizationId) {
      return { success: false, error: 'Invitation is not for your organization' };
    }

    await db
      .update(invitation)
      .set({ status: 'cancelled' })
      .where(eq(invitation.id, invitationId));

    revalidatePath('/dashboard/settings');

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to cancel invitation:', error);
    return { success: false, error: 'Failed to cancel invitation' };
  }
}

/**
 * Update a member's role in the organization
 */
export async function updateMemberRole(
  memberId: string,
  newRole: 'admin' | 'member'
): Promise<ActionResult<void>> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const currentMembership = await db.query.member.findFirst({
      where: eq(member.userId, authUser.id),
    });

    // Only owners can change roles
    if (!currentMembership || currentMembership.role !== 'owner') {
      return { success: false, error: 'Only organization owners can change member roles' };
    }

    // Get the member to update
    const memberToUpdate = await db.query.member.findFirst({
      where: eq(member.id, memberId),
    });

    if (!memberToUpdate) {
      return { success: false, error: 'Member not found' };
    }

    if (memberToUpdate.organizationId !== currentMembership.organizationId) {
      return { success: false, error: 'Member is not in your organization' };
    }

    // Can't change the owner's role
    if (memberToUpdate.role === 'owner') {
      return { success: false, error: 'Cannot change the owner\'s role' };
    }

    // Can't change your own role
    if (memberToUpdate.userId === authUser.id) {
      return { success: false, error: 'You cannot change your own role' };
    }

    await db
      .update(member)
      .set({ role: newRole })
      .where(eq(member.id, memberId));

    revalidatePath('/dashboard/settings');

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to update member role:', error);
    return { success: false, error: 'Failed to update member role' };
  }
}
