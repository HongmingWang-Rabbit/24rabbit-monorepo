'use client';

import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession, organization: orgClient } = authClient;

export type Session = typeof authClient.$Infer.Session;
