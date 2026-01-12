import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
  db,
  user,
  session,
  account,
  verification,
  organizations,
  organizationMembers,
} from '@24rabbit/database';
import {
  SESSION_EXPIRES_IN,
  SESSION_UPDATE_AGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  IS_PRODUCTION,
  getTrustedOrigins,
} from './constants/auth';

// Build social providers config only if credentials are provided
type SocialProviders = Parameters<typeof betterAuth>[0]['socialProviders'];

function getSocialProviders(): SocialProviders {
  const providers: SocialProviders = {};

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      scope: ['email', 'profile'],
    };
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }

  return providers;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification,
      organization: organizations,
      member: organizationMembers,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: IS_PRODUCTION,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },

  socialProviders: getSocialProviders(),

  plugins: [
    organization({
      allowUserToCreateOrganization: true,
    }),
  ],

  session: {
    expiresIn: SESSION_EXPIRES_IN,
    updateAge: SESSION_UPDATE_AGE,
  },

  trustedOrigins: getTrustedOrigins(),
});

export type Auth = typeof auth;
