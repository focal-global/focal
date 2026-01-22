'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { dataConnector, member, type ConnectorConfig, type AzureConnectorConfig } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';

// ============================================================================
// Types
// ============================================================================

export type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

export interface ConnectorFormData {
  name: string;
  provider: 'azure' | 'aws' | 'gcp';
  config: ConnectorConfig;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getSessionWithOrg() {
  const session = await auth.api.getSession({ headers: await headers() });
  
  if (!session?.user?.id) {
    return { error: 'Unauthorized' } as const;
  }

  // Get user's active organization (for now, get the first org they're a member of)
  const membership = await db.query.member.findFirst({
    where: eq(member.userId, session.user.id),
    with: {
      organization: true,
    },
  });

  if (!membership?.organization) {
    return { error: 'No organization found. Please create or join an organization.' } as const;
  }

  return { session, organization: membership.organization };
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get all connectors for the user's organization
 */
export async function getConnectors(): Promise<ActionResult<typeof dataConnector.$inferSelect[]>> {
  try {
    const result = await getSessionWithOrg();
    if ('error' in result) {
      return { success: false, error: result.error ?? 'Unauthorized' };
    }

    const connectors = await db.query.dataConnector.findMany({
      where: eq(dataConnector.organizationId, result.organization.id),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });

    return { success: true, data: connectors };
  } catch (error) {
    console.error('[Connectors] Error fetching connectors:', error);
    return { success: false, error: 'Failed to fetch connectors' };
  }
}

/**
 * Get a single connector by ID
 */
export async function getConnector(id: string): Promise<ActionResult<typeof dataConnector.$inferSelect>> {
  try {
    const result = await getSessionWithOrg();
    if ('error' in result) {
      return { success: false, error: result.error ?? 'Unauthorized' };
    }

    const connector = await db.query.dataConnector.findFirst({
      where: and(
        eq(dataConnector.id, id),
        eq(dataConnector.organizationId, result.organization.id)
      ),
    });

    if (!connector) {
      return { success: false, error: 'Connector not found' };
    }

    return { success: true, data: connector };
  } catch (error) {
    console.error('[Connectors] Error fetching connector:', error);
    return { success: false, error: 'Failed to fetch connector' };
  }
}

/**
 * Create a new connector
 */
export async function createConnector(
  data: ConnectorFormData
): Promise<ActionResult<typeof dataConnector.$inferSelect>> {
  try {
    const result = await getSessionWithOrg();
    if ('error' in result) {
      return { success: false, error: result.error ?? 'Unauthorized' };
    }

    const id = nanoid();
    const now = new Date();

    const [connector] = await db.insert(dataConnector).values({
      id,
      organizationId: result.organization.id,
      name: data.name,
      provider: data.provider,
      config: data.config,
      status: 'inactive',
      createdAt: now,
      updatedAt: now,
    }).returning();

    revalidatePath('/dashboard/connectors');

    return { success: true, data: connector };
  } catch (error) {
    console.error('[Connectors] Error creating connector:', error);
    return { success: false, error: 'Failed to create connector' };
  }
}

/**
 * Update an existing connector
 */
export async function updateConnector(
  id: string,
  data: Partial<ConnectorFormData>
): Promise<ActionResult<typeof dataConnector.$inferSelect>> {
  try {
    const result = await getSessionWithOrg();
    if ('error' in result) {
      return { success: false, error: result.error ?? 'Unauthorized' };
    }

    // Verify ownership
    const existing = await db.query.dataConnector.findFirst({
      where: and(
        eq(dataConnector.id, id),
        eq(dataConnector.organizationId, result.organization.id)
      ),
    });

    if (!existing) {
      return { success: false, error: 'Connector not found' };
    }

    const [connector] = await db.update(dataConnector)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.provider && { provider: data.provider }),
        ...(data.config && { config: data.config }),
        updatedAt: new Date(),
      })
      .where(eq(dataConnector.id, id))
      .returning();

    revalidatePath('/dashboard/connectors');

    return { success: true, data: connector };
  } catch (error) {
    console.error('[Connectors] Error updating connector:', error);
    return { success: false, error: 'Failed to update connector' };
  }
}

/**
 * Delete a connector
 */
export async function deleteConnector(id: string): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const result = await getSessionWithOrg();
    if ('error' in result) {
      return { success: false, error: result.error ?? 'Unauthorized' };
    }

    // Verify ownership
    const existing = await db.query.dataConnector.findFirst({
      where: and(
        eq(dataConnector.id, id),
        eq(dataConnector.organizationId, result.organization.id)
      ),
    });

    if (!existing) {
      return { success: false, error: 'Connector not found' };
    }

    await db.delete(dataConnector).where(eq(dataConnector.id, id));

    revalidatePath('/dashboard/connectors');

    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error('[Connectors] Error deleting connector:', error);
    return { success: false, error: 'Failed to delete connector' };
  }
}

/**
 * Test connector connection
 */
export async function testConnector(id: string): Promise<ActionResult<{ valid: boolean; message: string }>> {
  try {
    const result = await getSessionWithOrg();
    if ('error' in result) {
      return { success: false, error: result.error ?? 'Unauthorized' };
    }

    const connector = await db.query.dataConnector.findFirst({
      where: and(
        eq(dataConnector.id, id),
        eq(dataConnector.organizationId, result.organization.id)
      ),
    });

    if (!connector) {
      return { success: false, error: 'Connector not found' };
    }

    // For now, just validate Azure connectors
    if (connector.provider === 'azure') {
      const config = connector.config as AzureConnectorConfig;
      
      // Check if required fields are present based on auth method
      if (config?.authMethod === 'sas') {
        if (!config.sasUrl) {
          return { 
            success: true, 
            data: { valid: false, message: 'SAS URL not configured' } 
          };
        }
      } else if (config?.authMethod === 'key') {
        if (!config.storageAccountName || !config.containerName) {
          return { 
            success: true, 
            data: { valid: false, message: 'Missing storage account or container name' } 
          };
        }
        if (!config.accountKey && !process.env.AZURE_STORAGE_KEY) {
          return { 
            success: true, 
            data: { valid: false, message: 'Azure Storage Key not configured' } 
          };
        }
      } else {
        return { 
          success: true, 
          data: { valid: false, message: 'Invalid authentication method configured' } 
        };
      }

      // Try to validate by importing the azure action
      const { validateAzureConnector } = await import('./azure');
      const validation = await validateAzureConnector(config);

      // Update connector status based on validation
      await db.update(dataConnector)
        .set({ 
          status: validation.valid ? 'active' : 'error',
          updatedAt: new Date(),
        })
        .where(eq(dataConnector.id, id));

      revalidatePath('/dashboard/connectors');

      return { 
        success: true, 
        data: { 
          valid: validation.valid, 
          message: validation.valid ? 'Connection successful!' : (validation.error || 'Connection failed') 
        } 
      };
    }

    // AWS and GCP not yet implemented
    return { 
      success: true, 
      data: { valid: false, message: `${connector.provider.toUpperCase()} connectors not yet supported` } 
    };
  } catch (error) {
    console.error('[Connectors] Error testing connector:', error);
    return { success: false, error: 'Failed to test connector' };
  }
}

/**
 * Test connector config before saving (validates credentials without persisting)
 */
export async function testConnectorConfig(
  provider: string,
  config: AzureConnectorConfig
): Promise<ActionResult<{ valid: boolean; message: string }>> {
  try {
    const result = await getSessionWithOrg();
    if ('error' in result) {
      return { success: false, error: result.error ?? 'Unauthorized' };
    }

    if (provider === 'azure') {
      // Check if required fields are present based on auth method
      if (config?.authMethod === 'sas') {
        if (!config.sasUrl) {
          return { 
            success: true, 
            data: { valid: false, message: 'SAS URL not configured' } 
          };
        }
      } else if (config?.authMethod === 'key') {
        if (!config.storageAccountName || !config.containerName) {
          return { 
            success: true, 
            data: { valid: false, message: 'Missing storage account or container name' } 
          };
        }
        if (!config.accountKey) {
          return { 
            success: true, 
            data: { valid: false, message: 'Azure Storage Key not configured' } 
          };
        }
      } else {
        return { 
          success: true, 
          data: { valid: false, message: 'Invalid authentication method' } 
        };
      }

      // Try to validate
      const { validateAzureConnector } = await import('./azure');
      const validation = await validateAzureConnector(config);

      return { 
        success: true, 
        data: { 
          valid: validation.valid, 
          message: validation.valid ? 'Connection successful!' : (validation.error || 'Connection failed') 
        } 
      };
    }

    return { 
      success: true, 
      data: { valid: false, message: `${provider.toUpperCase()} connectors not yet supported` } 
    };
  } catch (error) {
    console.error('[Connectors] Error testing connector config:', error);
    return { success: false, error: 'Failed to test connector config' };
  }
}

/**
 * Update connector status
 */
export async function updateConnectorStatus(
  id: string, 
  status: 'active' | 'inactive' | 'error'
): Promise<ActionResult<{ updated: boolean }>> {
  try {
    const result = await getSessionWithOrg();
    if ('error' in result) {
      return { success: false, error: result.error ?? 'Unauthorized' };
    }

    await db.update(dataConnector)
      .set({ 
        status,
        updatedAt: new Date(),
        ...(status === 'active' && { lastSyncAt: new Date() }),
      })
      .where(and(
        eq(dataConnector.id, id),
        eq(dataConnector.organizationId, result.organization.id)
      ));

    revalidatePath('/dashboard/connectors');

    return { success: true, data: { updated: true } };
  } catch (error) {
    console.error('[Connectors] Error updating connector status:', error);
    return { success: false, error: 'Failed to update connector status' };
  }
}
