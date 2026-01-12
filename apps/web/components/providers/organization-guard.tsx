'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/lib/auth-client';

interface OrganizationGuardProps {
  children: React.ReactNode;
}

export function OrganizationGuard({ children }: OrganizationGuardProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  // Derive the ready state from session data
  const hasUser = !!session?.user;
  const activeOrgId = session?.session?.activeOrganizationId;
  const hasActiveOrg = !!activeOrgId;
  const isReady = !isPending && hasUser && hasActiveOrg;

  useEffect(() => {
    if (isPending) return;

    // Not logged in - redirect to login
    if (!session?.user) {
      router.push('/login');
      return;
    }

    // No active organization - redirect to organization selection page
    if (!session.session?.activeOrganizationId) {
      router.push('/organization');
    }
  }, [session, isPending, router]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
