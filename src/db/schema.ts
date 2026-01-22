import {
  pgTable,
  text,
  timestamp,
  boolean,
  pgEnum,
  jsonb,
  primaryKey,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Enums
// ============================================================================

export const providerEnum = pgEnum('provider', ['azure', 'aws', 'gcp']);
export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'member']);
export const connectorStatusEnum = pgEnum('connector_status', ['active', 'inactive', 'error']);

// ============================================================================
// Better-Auth Core Tables
// ============================================================================

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  
  // Extended profile fields
  firstName: text('first_name'),
  lastName: text('last_name'),
  title: text('title'), // Job title
  department: text('department'),
  timezone: text('timezone').default('UTC'),
  locale: text('locale').default('en-US'),
  currency: text('currency').default('USD'),
  
  // User preferences
  preferences: jsonb('preferences').$type<UserPreferences>(),
  
  // Account status
  isActive: boolean('is_active').notNull().default(true),
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  lastLoginAt: timestamp('last_login_at'),
  
  // Profile completion
  profileCompletedAt: timestamp('profile_completed_at'),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  activeOrganizationId: text('active_organization_id'),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// Organization Tables (Better-Auth Organization Plugin)
// ============================================================================

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  metadata: text('metadata'),
});

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: memberRoleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: memberRoleEnum('role').notNull().default('member'),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at').notNull(),
  inviterId: text('inviter_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================================
// Focal Application Tables
// ============================================================================

export const dataConnector = pgTable('data_connector', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  provider: providerEnum('provider').notNull(),
  config: jsonb('config').$type<ConnectorConfig>(),
  status: connectorStatusEnum('status').notNull().default('inactive'),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const savedView = pgTable('saved_view', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'dashboard', 'report', 'query'
  config: jsonb('config').$type<SavedViewConfig>(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// User Activity & Audit Log
// ============================================================================

export const userActivity = pgTable('user_activity', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'login', 'logout', 'create_view', 'export_data', etc.
  resource: text('resource'), // Resource affected (view_id, connector_id, etc.)
  resourceType: text('resource_type'), // 'view', 'connector', 'organization', etc.
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================================
// Data Source - Tracks loaded/saved data sources from connectors
// ============================================================================

// Refresh schedule options
// Refresh schedule options - renamed to auto-import for clarity
export const refreshScheduleEnum = pgEnum('refresh_schedule', [
  'manual',
  'daily', 
  'weekly',
]);

// Configuration for a data source - represents a "subscription" to connector data
export interface DataSourceConfig {
  // The blob paths that have been loaded
  blobPaths: string[];
  // The folder paths to monitor for new data (for auto-import)
  folderPaths?: string[];
  // Date range if from a FOCUS export folder (for display purposes)
  dateRange?: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  // Table name prefix used in DuckDB
  tableName: string;
  // Whether to auto-import new months as they become available
  autoImportNewMonths?: boolean;
  // Detected FOCUS specification version (e.g., '1.0', '1.1', '1.2')
  focusVersion?: string;
}

export const dataSource = pgTable('data_source', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  connectorId: text('connector_id')
    .notNull()
    .references(() => dataConnector.id, { onDelete: 'cascade' }),
  // User-friendly name (e.g., "Azure FinOps - Jan 2025")
  name: text('name').notNull(),
  // Cloud provider for display
  provider: providerEnum('provider').notNull(),
  // Configuration including blob paths and date range
  config: jsonb('config').notNull().$type<DataSourceConfig>(),
  // Auto-refresh settings
  refreshSchedule: refreshScheduleEnum('refresh_schedule').default('manual'),
  lastRefreshAt: timestamp('last_refresh_at'),
  // Row count and column info cached from last load
  rowCount: integer('row_count'),
  columns: jsonb('columns').$type<string[]>(),
  createdBy: text('created_by').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// Relations
// ============================================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  savedViews: many(savedView),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  dataConnectors: many(dataConnector),
  dataSources: many(dataSource),
  savedViews: many(savedView),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const dataConnectorRelations = relations(dataConnector, ({ one, many }) => ({
  organization: one(organization, {
    fields: [dataConnector.organizationId],
    references: [organization.id],
  }),
  dataSources: many(dataSource),
}));

export const dataSourceRelations = relations(dataSource, ({ one }) => ({
  organization: one(organization, {
    fields: [dataSource.organizationId],
    references: [organization.id],
  }),
  connector: one(dataConnector, {
    fields: [dataSource.connectorId],
    references: [dataConnector.id],
  }),
  creator: one(user, {
    fields: [dataSource.createdBy],
    references: [user.id],
  }),
}));

export const savedViewRelations = relations(savedView, ({ one }) => ({
  organization: one(organization, {
    fields: [savedView.organizationId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [savedView.createdBy],
    references: [user.id],
  }),
}));

export const userActivityRelations = relations(userActivity, ({ one }) => ({
  user: one(user, {
    fields: [userActivity.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [userActivity.organizationId],
    references: [organization.id],
  }),
}));

// ============================================================================
// TypeScript Types
// ============================================================================

// User preference configuration types
export interface UserPreferences {
  // Dashboard preferences
  defaultDashboard?: string;
  favoriteViews?: string[];
  
  // Display preferences
  theme?: 'light' | 'dark' | 'system';
  compactMode?: boolean;
  showWelcomeTips?: boolean;
  
  // Notification preferences
  emailNotifications?: {
    budgetAlerts?: boolean;
    anomalyDetection?: boolean;
    weeklyReports?: boolean;
    systemUpdates?: boolean;
  };
  
  // Analytics preferences
  defaultTimeRange?: string; // '7d', '30d', '90d', etc.
  defaultCurrency?: string;
  chartPreferences?: {
    defaultChartType?: 'line' | 'bar' | 'pie' | 'treemap';
    showDataLabels?: boolean;
    animateCharts?: boolean;
  };
  
  // Privacy preferences
  shareUsageData?: boolean;
  allowCookieTracking?: boolean;
}

// Connector configuration types
export interface AzureConnectorConfig {
  // Authentication method: 'sas' for direct SAS URL, 'key' for account key
  authMethod: 'sas' | 'key';
  
  // For SAS URL method - user provides a pre-generated SAS URL
  sasUrl?: string;
  
  // For Key method - we generate SAS tokens on demand
  storageAccountName?: string;
  containerName?: string;
  accountKey?: string; // Should be encrypted in production
  
  // Optional metadata
  subscriptionId?: string;
  exportName?: string;
  blobPrefix?: string; // Filter files by prefix
}

export interface AwsConnectorConfig {
  accountId: string;
  region: string;
  bucketName: string;
  reportPathPrefix: string;
}

export interface GcpConnectorConfig {
  projectId: string;
  billingAccountId: string;
  datasetId: string;
}

export type ConnectorConfig =
  | AzureConnectorConfig
  | AwsConnectorConfig
  | GcpConnectorConfig;

// Saved view configuration
export interface SavedViewConfig {
  // Query configuration
  queryId?: string;        // ID from FOCUS_QUERIES
  customSQL?: string;      // Custom SQL if not using predefined query
  
  // Filter configuration
  filters?: Record<string, unknown>;
  dateRange?: {
    start: string;
    end: string;
  };
  
  // Display configuration
  viewMode?: 'table' | 'pie' | 'bar' | 'treemap' | 'topology';
  chartType?: string;
  columns?: string[];
  groupBy?: string[];
  
  // Drill-down state (if saved while drilling)
  drillPath?: Array<{
    field: string;
    value: string;
  }>;
  
  // Dashboard layout (for dashboard type views)
  layout?: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; w: number; h: number };
    config: Record<string, unknown>;
  }>;
}

// Inferred types from schema
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Organization = typeof organization.$inferSelect;
export type NewOrganization = typeof organization.$inferInsert;
export type Member = typeof member.$inferSelect;
export type Invitation = typeof invitation.$inferSelect;
export type DataConnector = typeof dataConnector.$inferSelect;
export type NewDataConnector = typeof dataConnector.$inferInsert;
export type DataSource = typeof dataSource.$inferSelect;
export type NewDataSource = typeof dataSource.$inferInsert;
export type SavedView = typeof savedView.$inferSelect;
export type NewSavedView = typeof savedView.$inferInsert;
export type UserActivity = typeof userActivity.$inferSelect;
export type NewUserActivity = typeof userActivity.$inferInsert;
