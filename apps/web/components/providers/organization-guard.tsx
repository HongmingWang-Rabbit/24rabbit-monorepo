'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/lib/auth-client';

interface OrganizationGuardProps {
  children: React.ReactNode;
}

export function OrganizationGuard({ children }: OrganizationGuardProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isPending) return;

    // Not logged in - redirect to login
    if (!session?.user) {
      router.push('/login');
      return;
    }

    // Check if user has an active organization
    const activeOrgId = session.session?.activeOrganizationId;
    if (!activeOrgId) {
      // No active organization - redirect to organization selection page
      router.push('/organization');
      return;
    }

    // User has an active organization - allow access
    setIsChecking(false);
  }, [session, isPending, router]);

  if (isPending || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
