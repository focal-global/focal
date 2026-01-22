'use server';

/**
 * User Management Server Actions
 * 
 * Provides comprehensive user profile and admin management functionality.
 * Includes profile updates, user administration, role management, and activity logging.
 */

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, member, userActivity, type User, type UserActivity, type UserPreferences } from '@/db/schema';
import { eq, and, desc, like, ilike, count, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ============================================================================
// Types
// ============================================================================

// Re-export User type from schema
export type { User, UserActivity, UserPreferences } from '@/db/schema';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  title?: string;
  department?: string;
  timezone?: string;
  locale?: string;
  currency?: string;
  image?: string;
  preferences?: UserPreferences;
}

export interface UserSearchResult {
  users: Array<User & { 
    memberRole?: 'owner' | 'admin' | 'member' | null;
    organizationName?: string;
    lastActivity?: Date;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface ActivityLogResult {
  activities: Array<UserActivity & {
    userName: string;
    userEmail: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

// ============================================================================
// Profile Management
// ============================================================================

/**
 * Get current user profile with extended information
 */
export async function getCurrentUserProfile(): Promise<ActionResult<User>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    const userData = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!userData[0]) {
      return { success: false, error: 'User not found' };
    }

    // Log profile view activity
    await logUserActivity(session.user.id, 'profile_view', null, 'profile');

    return { success: true, data: userData[0] };
  } catch (error) {
    console.error('[UserActions] Get profile error:', error);
    return { success: false, error: 'Failed to get user profile' };
  }
}

/**
 * Update user profile information
 */
export async function updateUserProfile(
  data: ProfileUpdateData
): Promise<ActionResult<User>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Build update data with proper name handling
    const updateData: Partial<User> = {
      updatedAt: new Date(),
    };

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.locale !== undefined) updateData.locale = data.locale;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.preferences !== undefined) updateData.preferences = data.preferences;

    // Update display name if first/last name provided
    if (data.firstName || data.lastName) {
      const currentUser = await db
        .select({ firstName: user.firstName, lastName: user.lastName })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      if (currentUser[0]) {
        const firstName = data.firstName ?? currentUser[0].firstName ?? '';
        const lastName = data.lastName ?? currentUser[0].lastName ?? '';
        updateData.name = [firstName, lastName].filter(Boolean).join(' ').trim() || session.user.name;
      }
    }

    // Mark profile as completed if not already
    if (!updateData.profileCompletedAt && (data.firstName || data.lastName || data.title)) {
      updateData.profileCompletedAt = new Date();
    }

    const [updatedUser] = await db
      .update(user)
      .set(updateData)
      .where(eq(user.id, session.user.id))
      .returning();

    if (!updatedUser) {
      return { success: false, error: 'Failed to update profile' };
    }

    // Log profile update activity
    await logUserActivity(
      session.user.id,
      'profile_update',
      session.user.id,
      'profile',
      { updatedFields: Object.keys(data) }
    );

    return { success: true, data: updatedUser };
  } catch (error) {
    console.error('[UserActions] Update profile error:', error);
    return { success: false, error: 'Failed to update profile' };
  }
}

/**
 * Complete user onboarding process
 */
export async function completeOnboarding(): Promise<ActionResult<boolean>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    await db
      .update(user)
      .set({ 
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id));

    // Log onboarding completion
    await logUserActivity(session.user.id, 'onboarding_completed', null, 'profile');

    return { success: true, data: true };
  } catch (error) {
    console.error('[UserActions] Complete onboarding error:', error);
    return { success: false, error: 'Failed to complete onboarding' };
  }
}

// ============================================================================
// Admin User Management (Owner/Admin only)
// ============================================================================

/**
 * Search and list users with pagination (Admin only)
 */
export async function searchUsers(
  query: string = '',
  page: number = 1,
  limit: number = 20
): Promise<ActionResult<UserSearchResult>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user is admin or super admin
    const currentUser = await db
      .select({ isSuperAdmin: user.isSuperAdmin })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!currentUser[0]?.isSuperAdmin) {
      // Check if user is at least an admin in any organization
      const orgMembership = await db
        .select({ role: member.role })
        .from(member)
        .where(eq(member.userId, session.user.id))
        .limit(1);

      if (!orgMembership[0] || !['owner', 'admin'].includes(orgMembership[0].role)) {
        return { success: false, error: 'Insufficient permissions' };
      }
    }

    const offset = (page - 1) * limit;
    
    // Build search conditions
    const searchConditions = query
      ? sql`${ilike(user.name, `%${query}%`)} OR ${ilike(user.email, `%${query}%`)}`
      : sql`TRUE`;

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(user)
      .where(searchConditions);

    // Get users with member role information
    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        title: user.title,
        department: user.department,
        isActive: user.isActive,
        isSuperAdmin: user.isSuperAdmin,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        memberRole: member.role,
      })
      .from(user)
      .leftJoin(
        member,
        eq(member.userId, user.id)
      )
      .where(searchConditions)
      .orderBy(desc(user.lastLoginAt), desc(user.createdAt))
      .limit(limit)
      .offset(offset);

    // Log admin activity
    await logUserActivity(
      session.user.id,
      'admin_user_search',
      null,
      'admin',
      { query, page, limit }
    );

    return {
      success: true,
      data: {
        users: users as any,
        total: Number(total),
        page,
        limit,
      },
    };
  } catch (error) {
    console.error('[UserActions] Search users error:', error);
    return { success: false, error: 'Failed to search users' };
  }
}

/**
 * Update user role in organization (Owner/Admin only)
 */
export async function updateUserRole(
  userId: string,
  newRole: 'owner' | 'admin' | 'member'
): Promise<ActionResult<boolean>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if current user can modify roles (must be owner)
    const currentMember = await db
      .select({ role: member.role })
      .from(member)
      .where(eq(member.userId, session.user.id))
      .limit(1);

    if (!currentMember[0] || currentMember[0].role !== 'owner') {
      return { success: false, error: 'Only organization owners can modify roles' };
    }

    // Update the user's role (for first organization found)
    await db
      .update(member)
      .set({ role: newRole })
      .where(eq(member.userId, userId));

    // Log role change activity
    await logUserActivity(
      session.user.id,
      'role_updated',
      userId,
      'user',
      { newRole, organizationId: null }
    );

    return { success: true, data: true };
  } catch (error) {
    console.error('[UserActions] Update user role error:', error);
    return { success: false, error: 'Failed to update user role' };
  }
}

/**
 * Activate or deactivate a user account (Super Admin only)
 */
export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<ActionResult<boolean>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user is super admin
    const currentUser = await db
      .select({ isSuperAdmin: user.isSuperAdmin })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!currentUser[0]?.isSuperAdmin) {
      return { success: false, error: 'Only super admins can activate/deactivate users' };
    }

    // Prevent deactivating self
    if (userId === session.user.id && !isActive) {
      return { success: false, error: 'Cannot deactivate your own account' };
    }

    await db
      .update(user)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(user.id, userId));

    // Log activity
    await logUserActivity(
      session.user.id,
      isActive ? 'user_activated' : 'user_deactivated',
      userId,
      'user',
      { isActive }
    );

    return { success: true, data: true };
  } catch (error) {
    console.error('[UserActions] Toggle user active error:', error);
    return { success: false, error: 'Failed to toggle user status' };
  }
}

// ============================================================================
// Activity Logging & Audit
// ============================================================================

/**
 * Log user activity for audit trail
 */
export async function logUserActivity(
  userId: string,
  action: string,
  resource?: string | null,
  resourceType?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    await db.insert(userActivity).values({
      id: nanoid(),
      userId,
      organizationId: null, // TODO: Add organization context
      action,
      resource: resource || null,
      resourceType: resourceType || null,
      metadata: metadata || null,
      ipAddress: null, // TODO: Extract from headers if needed
      userAgent: null, // TODO: Extract from headers if needed
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('[UserActions] Log activity error:', error);
    // Don't throw error for logging failures
  }
}

/**
 * Get user activity log (Admin only)
 */
export async function getUserActivityLog(
  userId?: string,
  page: number = 1,
  limit: number = 50
): Promise<ActionResult<ActivityLogResult>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check permissions (admin or viewing own activity)
    const currentUser = await db
      .select({ isSuperAdmin: user.isSuperAdmin })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    const isAdmin = currentUser[0]?.isSuperAdmin;
    const viewingOwnActivity = userId === session.user.id;

    if (!isAdmin && !viewingOwnActivity) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const offset = (page - 1) * limit;
    
    // Build query conditions
    const queryUserId = userId || session.user.id;
    
    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(userActivity)
      .where(eq(userActivity.userId, queryUserId));

    // Get activities with user information
    const activities = await db
      .select({
        id: userActivity.id,
        userId: userActivity.userId,
        organizationId: userActivity.organizationId,
        action: userActivity.action,
        resource: userActivity.resource,
        resourceType: userActivity.resourceType,
        metadata: userActivity.metadata,
        ipAddress: userActivity.ipAddress,
        userAgent: userActivity.userAgent,
        createdAt: userActivity.createdAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(userActivity)
      .innerJoin(user, eq(userActivity.userId, user.id))
      .where(eq(userActivity.userId, queryUserId))
      .orderBy(desc(userActivity.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      success: true,
      data: {
        activities: activities as any,
        total: Number(total),
        page,
        limit,
      },
    };
  } catch (error) {
    console.error('[UserActions] Get activity log error:', error);
    return { success: false, error: 'Failed to get activity log' };
  }
}

/**
 * Get user activity logs (Admin only)
 */
export async function getUserActivityLogs(
  userId: string,
  page: number = 1,
  limit: number = 50
): Promise<ActionResult<ActivityLogResult>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user is admin or super admin or accessing own logs
    const isOwnLogs = session.user.id === userId;
    
    if (!isOwnLogs) {
      const currentUser = await db
        .select({ isSuperAdmin: user.isSuperAdmin })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      if (!currentUser[0]?.isSuperAdmin) {
        // Check if user is organization admin
        const orgMember = await db
          .select({ role: member.role })
          .from(member)
          .where(eq(member.userId, session.user.id))
          .limit(1);

        const isOrgAdmin = orgMember[0]?.role === 'admin' || orgMember[0]?.role === 'owner';
        
        if (!isOrgAdmin) {
          return { success: false, error: 'Insufficient permissions' };
        }
      }
    }

    const offset = (page - 1) * limit;

    // Get total count
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(userActivity)
      .where(eq(userActivity.userId, userId));

    // Get activities with user information
    const activities = await db
      .select({
        id: userActivity.id,
        userId: userActivity.userId,
        activityType: userActivity.action,
        description: userActivity.resource, // Using resource as description
        metadata: userActivity.metadata,
        ipAddress: userActivity.ipAddress,
        userAgent: userActivity.userAgent,
        createdAt: userActivity.createdAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(userActivity)
      .innerJoin(user, eq(userActivity.userId, user.id))
      .where(eq(userActivity.userId, userId))
      .orderBy(desc(userActivity.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      success: true,
      data: {
        activities: activities as any,
        total: Number(total),
        page,
        limit,
      },
    };
  } catch (error) {
    console.error('[UserActions] Get activity logs error:', error);
    return { success: false, error: 'Failed to get activity logs' };
  }
}