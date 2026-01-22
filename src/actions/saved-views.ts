'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { savedView, member } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { SavedViewConfig, SavedView, NewSavedView } from '@/db/schema';

// ============================================================================
// Types
// ============================================================================

export interface CreateSavedViewInput {
  name: string;
  type: 'dashboard' | 'report' | 'query';
  config: SavedViewConfig;
}

export interface UpdateSavedViewInput {
  id: string;
  name?: string;
  config?: SavedViewConfig;
}

interface ActionResult<T> {
  success: true;
  data: T;
}

interface ActionError {
  success: false;
  error: string;
}

type ActionResponse<T> = ActionResult<T> | ActionError;

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

async function getUserOrganization(userId: string) {
  const membership = await db.query.member.findFirst({
    where: eq(member.userId, userId),
    with: {
      organization: true,
    },
  });
  
  return membership?.organization ?? null;
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Create a new saved view
 */
export async function createSavedView(
  input: CreateSavedViewInput
): Promise<ActionResponse<SavedView>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }
    
    const org = await getUserOrganization(user.id);
    if (!org) {
      return { success: false, error: 'No organization found' };
    }
    
    const id = crypto.randomUUID();
    
    const [newView] = await db.insert(savedView).values({
      id,
      organizationId: org.id,
      name: input.name,
      type: input.type,
      config: input.config,
      createdBy: user.id,
    }).returning();
    
    return { success: true, data: newView };
  } catch (error) {
    console.error('Failed to create saved view:', error);
    return { success: false, error: 'Failed to create saved view' };
  }
}

/**
 * Get all saved views for the current organization
 */
export async function getSavedViews(
  type?: 'dashboard' | 'report' | 'query'
): Promise<ActionResponse<SavedView[]>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }
    
    const org = await getUserOrganization(user.id);
    if (!org) {
      return { success: false, error: 'No organization found' };
    }
    
    const whereClause = type 
      ? and(eq(savedView.organizationId, org.id), eq(savedView.type, type))
      : eq(savedView.organizationId, org.id);
    
    const views = await db.query.savedView.findMany({
      where: whereClause,
      orderBy: [desc(savedView.updatedAt)],
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    return { success: true, data: views };
  } catch (error) {
    console.error('Failed to get saved views:', error);
    return { success: false, error: 'Failed to get saved views' };
  }
}

/**
 * Get a single saved view by ID
 */
export async function getSavedView(
  id: string
): Promise<ActionResponse<SavedView>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }
    
    const org = await getUserOrganization(user.id);
    if (!org) {
      return { success: false, error: 'No organization found' };
    }
    
    const view = await db.query.savedView.findFirst({
      where: and(
        eq(savedView.id, id),
        eq(savedView.organizationId, org.id)
      ),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    if (!view) {
      return { success: false, error: 'Saved view not found' };
    }
    
    return { success: true, data: view };
  } catch (error) {
    console.error('Failed to get saved view:', error);
    return { success: false, error: 'Failed to get saved view' };
  }
}

/**
 * Update a saved view
 */
export async function updateSavedView(
  input: UpdateSavedViewInput
): Promise<ActionResponse<SavedView>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }
    
    const org = await getUserOrganization(user.id);
    if (!org) {
      return { success: false, error: 'No organization found' };
    }
    
    // Verify ownership
    const existing = await db.query.savedView.findFirst({
      where: and(
        eq(savedView.id, input.id),
        eq(savedView.organizationId, org.id)
      ),
    });
    
    if (!existing) {
      return { success: false, error: 'Saved view not found' };
    }
    
    const updateData: Partial<NewSavedView> = {
      updatedAt: new Date(),
    };
    
    if (input.name) updateData.name = input.name;
    if (input.config) updateData.config = input.config;
    
    const [updated] = await db
      .update(savedView)
      .set(updateData)
      .where(eq(savedView.id, input.id))
      .returning();
    
    return { success: true, data: updated };
  } catch (error) {
    console.error('Failed to update saved view:', error);
    return { success: false, error: 'Failed to update saved view' };
  }
}

/**
 * Delete a saved view
 */
export async function deleteSavedView(
  id: string
): Promise<ActionResponse<{ deleted: boolean }>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }
    
    const org = await getUserOrganization(user.id);
    if (!org) {
      return { success: false, error: 'No organization found' };
    }
    
    // Verify ownership
    const existing = await db.query.savedView.findFirst({
      where: and(
        eq(savedView.id, id),
        eq(savedView.organizationId, org.id)
      ),
    });
    
    if (!existing) {
      return { success: false, error: 'Saved view not found' };
    }
    
    await db.delete(savedView).where(eq(savedView.id, id));
    
    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error('Failed to delete saved view:', error);
    return { success: false, error: 'Failed to delete saved view' };
  }
}

/**
 * Generate a shareable URL for a saved view (with encoded config)
 */
export async function generateShareableUrl(
  viewId: string
): Promise<ActionResponse<{ url: string; expiresAt: Date }>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }
    
    const org = await getUserOrganization(user.id);
    if (!org) {
      return { success: false, error: 'No organization found' };
    }
    
    // Verify ownership
    const view = await db.query.savedView.findFirst({
      where: and(
        eq(savedView.id, viewId),
        eq(savedView.organizationId, org.id)
      ),
    });
    
    if (!view) {
      return { success: false, error: 'Saved view not found' };
    }
    
    // Create a simple shareable token (in production, use proper encryption/signing)
    const shareData = {
      viewId: view.id,
      orgId: org.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    
    const token = Buffer.from(JSON.stringify(shareData)).toString('base64url');
    
    // In production, store this token in the database for validation
    const url = `/dashboard/analytics?view=${token}`;
    
    return { 
      success: true, 
      data: { 
        url, 
        expiresAt: new Date(shareData.expiresAt) 
      } 
    };
  } catch (error) {
    console.error('Failed to generate shareable URL:', error);
    return { success: false, error: 'Failed to generate shareable URL' };
  }
}
