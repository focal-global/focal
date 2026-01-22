'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { dataConnector } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { AzureConnectorConfig } from '@/db/schema';

// ============================================================================
// Types
// ============================================================================

interface GenerateSasUrlParams {
  connectorId: string;
  blobPath?: string; // Optional specific blob path, defaults to container-level
}

interface SasUrlResult {
  success: true;
  sasUrl: string;
  expiresAt: Date;
}

interface SasUrlError {
  success: false;
  error: string;
}

type GenerateSasUrlResponse = SasUrlResult | SasUrlError;

interface AzureCredentials {
  accountName: string;
  accountKey: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a SAS token signature using Web Crypto API
 * Azure Storage SAS tokens use HMAC-SHA256
 */
async function generateSasSignature(
  stringToSign: string,
  accountKey: string
): Promise<string> {
  // Decode the base64 account key
  const keyBuffer = Uint8Array.from(atob(accountKey), (c) => c.charCodeAt(0));

  // Import the key for HMAC-SHA256
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the string
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(stringToSign)
  );

  // Return base64 encoded signature
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Generate Azure Blob Storage SAS Token
 * Implements Service SAS for Blob Storage
 */
async function generateBlobSasToken(
  credentials: AzureCredentials,
  containerName: string,
  blobPath?: string,
  expiryMinutes: number = 60
): Promise<{ token: string; expiresAt: Date }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

  // Format dates for SAS (ISO 8601 without milliseconds)
  const formatDate = (date: Date) =>
    date.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const startTime = formatDate(new Date(now.getTime() - 5 * 60 * 1000)); // 5 min buffer
  const expiryTime = formatDate(expiresAt);

  // SAS parameters
  const signedPermissions = 'rl'; // Read + List
  const signedService = 'b'; // Blob
  const signedResourceType = blobPath ? 'b' : 'c'; // Blob or Container
  const signedProtocol = 'https';
  const signedVersion = '2022-11-02';

  // Canonical resource path
  const canonicalResource = blobPath
    ? `/blob/${credentials.accountName}/${containerName}/${blobPath}`
    : `/blob/${credentials.accountName}/${containerName}`;

  // String to sign (order matters!)
  // Reference: https://learn.microsoft.com/en-us/rest/api/storageservices/create-service-sas
  const stringToSign = [
    signedPermissions, // sp
    startTime, // st
    expiryTime, // se
    canonicalResource, // canonicalizedResource
    '', // signedIdentifier (empty)
    '', // signedIP (empty)
    signedProtocol, // spr
    signedVersion, // sv
    signedResourceType, // sr
    '', // signedSnapshotTime (empty)
    '', // signedEncryptionScope (empty)
    '', // rscc (cache-control)
    '', // rscd (content-disposition)
    '', // rsce (content-encoding)
    '', // rscl (content-language)
    '', // rsct (content-type)
  ].join('\n');

  const signature = await generateSasSignature(
    stringToSign,
    credentials.accountKey
  );

  // Build the SAS query string
  const sasParams = new URLSearchParams({
    sp: signedPermissions,
    st: startTime,
    se: expiryTime,
    spr: signedProtocol,
    sv: signedVersion,
    sr: signedResourceType,
    sig: signature,
  });

  return {
    token: sasParams.toString(),
    expiresAt,
  };
}

/**
 * Get credentials from connector config
 * Supports both 'sas' and 'key' auth methods
 */
function getCredentials(
  config: AzureConnectorConfig
): { type: 'sas'; sasUrl: string } | { type: 'key'; credentials: AzureCredentials; containerName: string } {
  if (config.authMethod === 'sas') {
    if (!config.sasUrl) {
      throw new Error('SAS URL not configured');
    }
    return { type: 'sas', sasUrl: config.sasUrl };
  }
  
  // Key method
  if (!config.storageAccountName || !config.containerName) {
    throw new Error('Storage account or container name not configured');
  }
  
  // Try to get account key from config first, then fall back to env
  const accountKey = config.accountKey || process.env.AZURE_STORAGE_KEY;
  
  if (!accountKey) {
    throw new Error('Azure Storage Key not configured');
  }

  return {
    type: 'key',
    credentials: {
      accountName: config.storageAccountName,
      accountKey,
    },
    containerName: config.containerName,
  };
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Generate a SAS URL for accessing Azure Blob Storage
 * Implements the Valet Key Pattern - mints short-lived access tokens
 */
export async function generateAzureSasUrl(
  params: GenerateSasUrlParams
): Promise<GenerateSasUrlResponse> {
  try {
    // 1. Authenticate the user
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // 2. Fetch the connector and verify ownership
    const connector = await db.query.dataConnector.findFirst({
      where: eq(dataConnector.id, params.connectorId),
      with: {
        organization: {
          with: {
            members: true,
          },
        },
      },
    });

    if (!connector) {
      return { success: false, error: 'Connector not found' };
    }

    // 3. Verify user is a member of the organization
    const isMember = connector.organization?.members.some(
      (m) => m.userId === session.user.id
    );

    if (!isMember) {
      return { success: false, error: 'Access denied' };
    }

    // 4. Verify connector is Azure type
    if (connector.provider !== 'azure') {
      return { success: false, error: 'Invalid connector type' };
    }

    // 5. Get connector config
    const config = connector.config as AzureConnectorConfig;
    const authInfo = getCredentials(config);

    // 6. Handle based on auth method
    if (authInfo.type === 'sas') {
      // For SAS URL method, append blob path if provided
      let sasUrl = authInfo.sasUrl;
      
      if (params.blobPath) {
        // Parse the base URL and append blob path
        const [baseUrl, queryString] = sasUrl.split('?');
        sasUrl = `${baseUrl}/${params.blobPath}?${queryString}`;
      }

      return {
        success: true,
        sasUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Assume 1 hour for user-provided SAS
      };
    }

    // Key method - generate SAS token on demand
    const { token, expiresAt } = await generateBlobSasToken(
      authInfo.credentials,
      authInfo.containerName,
      params.blobPath,
      60 // 1 hour expiry
    );

    // Build the full SAS URL
    const blobUrl = params.blobPath
      ? `https://${authInfo.credentials.accountName}.blob.core.windows.net/${authInfo.containerName}/${params.blobPath}`
      : `https://${authInfo.credentials.accountName}.blob.core.windows.net/${authInfo.containerName}`;

    const sasUrl = `${blobUrl}?${token}`;

    // Log access for audit (optional)
    console.log(
      `[Azure SAS] Generated token for user ${session.user.id}, connector ${params.connectorId}, expires ${expiresAt.toISOString()}`
    );

    return {
      success: true,
      sasUrl,
      expiresAt,
    };
  } catch (error) {
    console.error('[Azure SAS] Error generating SAS URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate SAS URL',
    };
  }
}

// ============================================================================
// Types for FOCUS Export Discovery
// ============================================================================

export interface FocusFolder {
  path: string;
  name: string;
  isFocusDateRange: boolean;
  dateRange?: { start: string; end: string };
}

export interface ListBlobsResult {
  success: true;
  blobs: string[];
  folders: FocusFolder[];
  isFocusExportRoot: boolean;
}

/**
 * Detect if a folder name matches FOCUS export date range pattern (YYYYMMDD-YYYYMMDD)
 */
function parseFocusDateRange(folderName: string): { start: string; end: string } | null {
  // Match patterns like "20250101-20250131" or "20250101-20250131/"
  const match = folderName.match(/^(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})\/?$/);
  if (!match) return null;
  
  const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = match;
  return {
    start: `${startYear}-${startMonth}-${startDay}`,
    end: `${endYear}-${endMonth}-${endDay}`,
  };
}

/**
 * List blobs in a container (returns SAS URLs for each)
 * Useful for discovering available cost export files
 * Enhanced to detect FOCUS export folder structure
 */
export async function listAzureCostExports(
  connectorId: string,
  prefix?: string // Optional folder prefix to browse into
): Promise<ListBlobsResult | { success: false; error: string }> {
  try {
    // 1. Authenticate the user
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // 2. Fetch the connector and verify ownership
    const connector = await db.query.dataConnector.findFirst({
      where: eq(dataConnector.id, connectorId),
      with: {
        organization: {
          with: {
            members: true,
          },
        },
      },
    });

    if (!connector) {
      return { success: false, error: 'Connector not found' };
    }

    // 3. Verify user is a member of the organization
    const isMember = connector.organization?.members.some(
      (m) => m.userId === session.user.id
    );

    if (!isMember) {
      return { success: false, error: 'Access denied' };
    }

    // 4. Get connector config
    const config = connector.config as AzureConnectorConfig;
    const authInfo = getCredentials(config);

    let listUrl: string;

    if (authInfo.type === 'sas') {
      // For SAS URL, append list parameters
      const [baseUrl, queryString] = authInfo.sasUrl.split('?');
      listUrl = `${baseUrl}?restype=container&comp=list&delimiter=/&${queryString}`;
    } else {
      // Key method - generate SAS for listing
      const { token } = await generateBlobSasToken(
        authInfo.credentials,
        authInfo.containerName,
        undefined,
        5 // Short-lived for listing
      );
      listUrl = `https://${authInfo.credentials.accountName}.blob.core.windows.net/${authInfo.containerName}?restype=container&comp=list&delimiter=/&${token}`;
    }

    // Build the effective prefix: connector prefix + browse prefix
    const effectivePrefix = [config.blobPrefix, prefix]
      .filter(Boolean)
      .join('')
      .replace(/\/+/g, '/'); // Normalize multiple slashes

    if (effectivePrefix) {
      listUrl += `&prefix=${encodeURIComponent(effectivePrefix)}`;
    }

    // 5. List blobs using Azure Blob Storage REST API
    const response = await fetch(listUrl);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to list blobs: ${response.status} ${response.statusText} - ${text.slice(0, 200)}`);
    }

    const xml = await response.text();
    
    // Debug: Log the raw XML response (truncated)
    console.log('[Azure List] URL:', listUrl.replace(/sig=[^&]+/, 'sig=***'));
    console.log('[Azure List] Response length:', xml.length);
    console.log('[Azure List] XML preview:', xml.slice(0, 1500));

    // Parse blob names from XML response (files)
    // Azure returns: <Blobs><Blob><Name>path/to/file.parquet</Name>...</Blob></Blobs>
    // We need to get names from inside <Blob> elements only, not <BlobPrefix>
    const blobNames: string[] = [];
    
    // First, extract the Blobs section (contains both Blob and BlobPrefix)
    const blobsSection = xml.match(/<Blobs>([\s\S]*?)<\/Blobs>/)?.[1] || '';
    
    // Get all <Blob>...</Blob> content (not BlobPrefix)
    const blobElements = blobsSection.match(/<Blob>[\s\S]*?<\/Blob>/g) || [];
    
    for (const blobElement of blobElements) {
      const nameMatch = blobElement.match(/<Name>([^<]+)<\/Name>/);
      if (nameMatch) {
        const blobName = nameMatch[1];
        // Filter for common cost export formats
        if (
          blobName.endsWith('.parquet') ||
          blobName.endsWith('.csv') ||
          blobName.endsWith('.csv.gz')
        ) {
          blobNames.push(blobName);
        }
      }
    }
    
    console.log('[Azure List] Found blobs:', blobNames.length);

    // Parse folder prefixes from BlobPrefix elements with FOCUS detection
    const folders: FocusFolder[] = [];
    
    // Get all <BlobPrefix>...</BlobPrefix> content
    const prefixElements = blobsSection.match(/<BlobPrefix>[\s\S]*?<\/BlobPrefix>/g) || [];
    let focusDateFolderCount = 0;

    for (const prefixElement of prefixElements) {
      const nameMatch = prefixElement.match(/<Name>([^<]+)<\/Name>/);
      if (nameMatch) {
        const fullPath = nameMatch[1];
        // Extract just the folder name from the path
        const pathParts = fullPath.replace(/\/$/, '').split('/');
        const folderName = pathParts[pathParts.length - 1];
        
        const dateRange = parseFocusDateRange(folderName);
        
        if (dateRange) {
          focusDateFolderCount++;
          folders.push({
            path: fullPath,
            name: folderName,
            isFocusDateRange: true,
            dateRange,
          });
        } else {
          folders.push({
            path: fullPath,
            name: folderName,
            isFocusDateRange: false,
          });
        }
      }
    }
    
    console.log('[Azure List] Found folders:', folders.length, folders.map(f => f.name));

    // Sort FOCUS date folders chronologically (newest first)
    folders.sort((a, b) => {
      if (a.isFocusDateRange && b.isFocusDateRange) {
        // Sort by date descending (newest first)
        return b.name.localeCompare(a.name);
      }
      // Non-date folders come after date folders
      if (a.isFocusDateRange) return -1;
      if (b.isFocusDateRange) return 1;
      return a.name.localeCompare(b.name);
    });

    // If most folders are FOCUS date ranges, this is likely a FOCUS export root
    const isFocusExportRoot = folders.length > 0 && 
      focusDateFolderCount / folders.length > 0.5;

    return { 
      success: true, 
      blobs: blobNames, 
      folders,
      isFocusExportRoot,
    };
  } catch (error) {
    console.error('[Azure] Error listing blobs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list blobs',
    };
  }
}

/**
 * List all files within a specific folder (non-recursive)
 * Useful for loading all parquet files in a FOCUS date range folder
 */
export async function listFilesInFolder(
  connectorId: string,
  folderPath: string
): Promise<{ success: true; blobs: string[] } | { success: false; error: string }> {
  try {
    // 1. Authenticate the user
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // 2. Fetch the connector and verify ownership
    const connector = await db.query.dataConnector.findFirst({
      where: eq(dataConnector.id, connectorId),
      with: {
        organization: {
          with: {
            members: true,
          },
        },
      },
    });

    if (!connector) {
      return { success: false, error: 'Connector not found' };
    }

    // 3. Verify user is a member of the organization
    const isMember = connector.organization?.members.some(
      (m) => m.userId === session.user.id
    );

    if (!isMember) {
      return { success: false, error: 'Access denied' };
    }

    // 4. Get connector config
    const config = connector.config as AzureConnectorConfig;
    const authInfo = getCredentials(config);

    let listUrl: string;

    if (authInfo.type === 'sas') {
      const [baseUrl, queryString] = authInfo.sasUrl.split('?');
      // Note: NOT using delimiter=/ to get all blobs in folder
      listUrl = `${baseUrl}?restype=container&comp=list&${queryString}`;
    } else {
      const { token } = await generateBlobSasToken(
        authInfo.credentials,
        authInfo.containerName,
        undefined,
        5
      );
      listUrl = `https://${authInfo.credentials.accountName}.blob.core.windows.net/${authInfo.containerName}?restype=container&comp=list&${token}`;
    }

    // The folderPath already includes the full path from navigation
    // Just ensure it ends with /
    const normalizedPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    listUrl += `&prefix=${encodeURIComponent(normalizedPath)}`;
    
    console.log('[Azure ListFiles] Listing files in folder:', normalizedPath);
    console.log('[Azure ListFiles] URL:', listUrl.replace(/sig=[^&]+/, 'sig=***'));

    const response = await fetch(listUrl);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to list blobs: ${response.status} ${response.statusText} - ${text.slice(0, 200)}`);
    }

    const xml = await response.text();
    
    console.log('[Azure ListFiles] XML preview:', xml.slice(0, 1000));

    // Parse blob names using the same approach as listAzureCostExports
    const blobNames: string[] = [];
    
    // Extract the Blobs section
    const blobsSection = xml.match(/<Blobs>([\s\S]*?)<\/Blobs>/)?.[1] || '';
    
    // Get all <Blob>...</Blob> content
    const blobElements = blobsSection.match(/<Blob>[\s\S]*?<\/Blob>/g) || [];
    
    for (const blobElement of blobElements) {
      const nameMatch = blobElement.match(/<Name>([^<]+)<\/Name>/);
      if (nameMatch) {
        const blobName = nameMatch[1];
        // Filter for common cost export formats
        if (
          blobName.endsWith('.parquet') ||
          blobName.endsWith('.csv') ||
          blobName.endsWith('.csv.gz')
        ) {
          // Include files up to 2 levels deep (handles nested folder structures)
          // e.g., 20250101-20250131/part-00000.parquet (0 slashes)
          // e.g., 20250101-20250131/subfolder/part-00000.parquet (1 slash)
          const relativePath = blobName.replace(normalizedPath, '');
          const depth = (relativePath.match(/\//g) || []).length;
          if (depth <= 1) {
            blobNames.push(blobName);
          }
        }
      }
    }
    
    console.log('[Azure ListFiles] Found files:', blobNames.length, blobNames.slice(0, 5));

    return { success: true, blobs: blobNames };
  } catch (error) {
    console.error('[Azure] Error listing files in folder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list files',
    };
  }
}

/**
 * Validate Azure connector credentials
 * Used when creating/updating a connector
 */
export async function validateAzureConnector(
  config: AzureConnectorConfig
): Promise<{ valid: boolean; error?: string }> {
  try {
    const authInfo = getCredentials(config);

    let listUrl: string;

    if (authInfo.type === 'sas') {
      // For SAS URL, test by listing blobs
      const [baseUrl, queryString] = authInfo.sasUrl.split('?');
      listUrl = `${baseUrl}?restype=container&comp=list&maxresults=1&${queryString}`;
    } else {
      // Key method - generate SAS for validation
      const { token } = await generateBlobSasToken(
        authInfo.credentials,
        authInfo.containerName,
        undefined,
        1 // 1 minute
      );
      listUrl = `https://${authInfo.credentials.accountName}.blob.core.windows.net/${authInfo.containerName}?restype=container&comp=list&maxresults=1&${token}`;
    }

    const response = await fetch(listUrl);

    if (!response.ok) {
      return {
        valid: false,
        error: `Azure returned ${response.status}: ${response.statusText}`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }}