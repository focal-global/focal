'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { dataSource, dataConnector, member } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { DataSourceConfig, DataSource, NewDataSource } from '@/db/schema';

// ============================================================================
// Types
// ============================================================================

export interface CreateDataSourceInput {
  connectorId: string;
  name: string;
  provider: 'azure' | 'aws' | 'gcp';
  config: DataSourceConfig;
  refreshSchedule?: 'manual' | 'daily' | 'weekly';
  rowCount?: number;
  columns?: string[];
}

export interface UpdateDataSourceInput {
  id: string;
  name?: string;
  config?: Partial<DataSourceConfig>;
  refreshSchedule?: 'manual' | 'daily' | 'weekly';
  rowCount?: number;
  columns?: string[];
  lastRefreshAt?: Date;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify user has access to the organization
 */
async function verifyUserAccess(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const membership = await db.query.member.findFirst({
    where: and(
      eq(member.userId, userId),
      eq(member.organizationId, organizationId)
    ),
  });
  return !!membership;
}

/**
 * Get the organization ID for a connector
 */
async function getConnectorOrganizationId(
  connectorId: string
): Promise<string | null> {
  const connector = await db.query.dataConnector.findFirst({
    where: eq(dataConnector.id, connectorId),
  });
  return connector?.organizationId ?? null;
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Create a new data source (save reference to loaded data)
 */
export async function createDataSource(
  input: CreateDataSourceInput
): Promise<{ success: true; dataSource: DataSource } | { success: false; error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get the organization from the connector
    const organizationId = await getConnectorOrganizationId(input.connectorId);
    
    if (!organizationId) {
      return { success: false, error: 'Connector not found' };
    }

    // Verify user access
    const hasAccess = await verifyUserAccess(session.user.id, organizationId);
    
    if (!hasAccess) {
      return { success: false, error: 'Access denied' };
    }

    // Create the data source
    const [newDataSource] = await db
      .insert(dataSource)
      .values({
        organizationId,
        connectorId: input.connectorId,
        name: input.name,
        provider: input.provider,
        config: input.config,
        refreshSchedule: input.refreshSchedule || 'manual',
        rowCount: input.rowCount,
        columns: input.columns,
        createdBy: session.user.id,
      })
      .returning();

    return { success: true, dataSource: newDataSource };
  } catch (error) {
    console.error('[DataSource] Error creating:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create data source',
    };
  }
}

/**
 * Update an existing data source
 */
export async function updateDataSource(
  input: UpdateDataSourceInput
): Promise<{ success: true; dataSource: DataSource } | { success: false; error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get the data source to verify access
    const existing = await db.query.dataSource.findFirst({
      where: eq(dataSource.id, input.id),
    });

    if (!existing) {
      return { success: false, error: 'Data source not found' };
    }

    // Verify user access
    const hasAccess = await verifyUserAccess(session.user.id, existing.organizationId);
    
    if (!hasAccess) {
      return { success: false, error: 'Access denied' };
    }

    // Build update values
    const updateValues: Partial<NewDataSource> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateValues.name = input.name;
    if (input.refreshSchedule !== undefined) updateValues.refreshSchedule = input.refreshSchedule;
    if (input.rowCount !== undefined) updateValues.rowCount = input.rowCount;
    if (input.columns !== undefined) updateValues.columns = input.columns;
    if (input.lastRefreshAt !== undefined) updateValues.lastRefreshAt = input.lastRefreshAt;
    
    // Handle config updates (merge with existing)
    if (input.config !== undefined) {
      const existingConfig = existing.config as DataSourceConfig;
      updateValues.config = { ...existingConfig, ...input.config };
    }

    const [updated] = await db
      .update(dataSource)
      .set(updateValues)
      .where(eq(dataSource.id, input.id))
      .returning();

    return { success: true, dataSource: updated };
  } catch (error) {
    console.error('[DataSource] Error updating:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update data source',
    };
  }
}

/**
 * Delete a data source
 */
export async function deleteDataSource(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get the data source to verify access
    const existing = await db.query.dataSource.findFirst({
      where: eq(dataSource.id, id),
    });

    if (!existing) {
      return { success: false, error: 'Data source not found' };
    }

    // Verify user access
    const hasAccess = await verifyUserAccess(session.user.id, existing.organizationId);
    
    if (!hasAccess) {
      return { success: false, error: 'Access denied' };
    }

    await db.delete(dataSource).where(eq(dataSource.id, id));

    return { success: true };
  } catch (error) {
    console.error('[DataSource] Error deleting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete data source',
    };
  }
}

/**
 * List data sources for an organization
 */
export async function listDataSources(
  organizationId: string
): Promise<{ success: true; dataSources: DataSource[] } | { success: false; error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify user access
    const hasAccess = await verifyUserAccess(session.user.id, organizationId);
    
    if (!hasAccess) {
      return { success: false, error: 'Access denied' };
    }

    const sources = await db.query.dataSource.findMany({
      where: eq(dataSource.organizationId, organizationId),
      orderBy: (dataSource, { desc }) => [desc(dataSource.createdAt)],
      with: {
        connector: true,
      },
    });

    return { success: true, dataSources: sources };
  } catch (error) {
    console.error('[DataSource] Error listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list data sources',
    };
  }
}

/**
 * Get a single data source by ID
 */
export async function getDataSource(
  id: string
): Promise<{ success: true; dataSource: DataSource } | { success: false; error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const source = await db.query.dataSource.findFirst({
      where: eq(dataSource.id, id),
      with: {
        connector: true,
      },
    });

    if (!source) {
      return { success: false, error: 'Data source not found' };
    }

    // Verify user access
    const hasAccess = await verifyUserAccess(session.user.id, source.organizationId);
    
    if (!hasAccess) {
      return { success: false, error: 'Access denied' };
    }

    return { success: true, dataSource: source };
  } catch (error) {
    console.error('[DataSource] Error getting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get data source',
    };
  }
}

/**
 * List data sources for a specific connector
 */
export async function listDataSourcesByConnector(
  connectorId: string
): Promise<{ success: true; dataSources: DataSource[] } | { success: false; error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get the organization from the connector
    const organizationId = await getConnectorOrganizationId(connectorId);
    
    if (!organizationId) {
      return { success: false, error: 'Connector not found' };
    }

    // Verify user access
    const hasAccess = await verifyUserAccess(session.user.id, organizationId);
    
    if (!hasAccess) {
      return { success: false, error: 'Access denied' };
    }

    const sources = await db.query.dataSource.findMany({
      where: eq(dataSource.connectorId, connectorId),
      orderBy: (dataSource, { desc }) => [desc(dataSource.createdAt)],
    });

    return { success: true, dataSources: sources };
  } catch (error) {
    console.error('[DataSource] Error listing by connector:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list data sources',
    };
  }
}

/**
 * Get all data sources for the current user's organization
 * Used to auto-load saved data sources on page load
 */
export async function getMyDataSources(): Promise<
  { success: true; dataSources: (DataSource & { connector: { name: string; provider: string } | null })[] } 
  | { success: false; error: string }
> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get user's organization
    const membership = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    const sources = await db.query.dataSource.findMany({
      where: eq(dataSource.organizationId, membership.organizationId),
      orderBy: (dataSource, { desc }) => [desc(dataSource.createdAt)],
      with: {
        connector: {
          columns: {
            name: true,
            provider: true,
          },
        },
      },
    });

    return { success: true, dataSources: sources };
  } catch (error) {
    console.error('[DataSource] Error getting my data sources:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get data sources',
    };
  }
}
