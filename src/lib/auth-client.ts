'use client';

import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  plugins: [
    organizationClient(),
  ],
});

// Export commonly used hooks and utilities
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;

// Organization-specific exports
export const {
  organization,
} = authClient;

// Social sign-in helper functions
export const signInWithGoogle = () => authClient.signIn.social({ provider: 'google' });
export const signInWithMicrosoft = () => authClient.signIn.social({ provider: 'microsoft' });
export const signInWithGitHub = () => authClient.signIn.social({ provider: 'github' });

// Link account helpers (for adding social accounts to existing user)
export const linkGoogle = () => authClient.linkSocial({ provider: 'google' });
export const linkMicrosoft = () => authClient.linkSocial({ provider: 'microsoft' });
export const linkGitHub = () => authClient.linkSocial({ provider: 'github' });

// Type exports for components
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
