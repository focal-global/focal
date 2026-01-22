import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, openAPI } from 'better-auth/plugins';
import { db } from '@/db';
import * as schema from '@/db/schema';

export const auth = betterAuth({
  // Base URL for the auth server
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),

  // Email & Password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Password reset configuration
    sendResetPassword: async ({ user, url }) => {
      // In production, use a proper email service (SendGrid, Resend, etc.)
      // For now, log to console in development
      console.log(`[Password Reset] User: ${user.email}`);
      console.log(`[Password Reset] URL: ${url}`);
      
      // TODO: Implement email sending
      // await sendEmail({
      //   to: user.email,
      //   subject: 'Reset your Focal password',
      //   html: `<a href="${url}">Click here to reset your password</a>`
      // });
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // Social OAuth providers
  socialProviders: {
    // GitHub OAuth
    github: {
      enabled: Boolean(process.env.GITHUB_CLIENT_ID),
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
    // Google OAuth
    google: {
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    // Microsoft / Azure AD OAuth
    microsoft: {
      enabled: Boolean(process.env.MICROSOFT_CLIENT_ID),
      clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      // Optional: Configure tenant for enterprise SSO
      // tenantId: process.env.MICROSOFT_TENANT_ID, // 'common' for multi-tenant
    },
  },

  // Plugins
  plugins: [
    organization({
      // Allow users to create organizations
      allowUserToCreateOrganization: true,
    }),
    // OpenAPI documentation for auth endpoints
    openAPI(),
  ],

  // Advanced configuration for SSO readiness
  advanced: {
    // Generate secure user IDs
    generateId: () => crypto.randomUUID(),
    // Cookie settings for production
    cookiePrefix: 'focal',
    // Cross-site cookie settings (important for embedded scenarios)
    crossSubDomainCookies: {
      enabled: process.env.NODE_ENV === 'production',
      domain: process.env.COOKIE_DOMAIN, // e.g., '.focal.app'
    },
  },

  // Trust host for production
  trustedOrigins: process.env.BETTER_AUTH_URL 
    ? [process.env.BETTER_AUTH_URL] 
    : ['http://localhost:3000'],

  // Account linking - allow linking multiple providers to same account
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'microsoft', 'github'],
    },
  },
});

// Export type for use in other server files
export type Auth = typeof auth;
