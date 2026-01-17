'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Building2, Plus, Check, Loader2 } from 'lucide-react';
import { orgClient, useSession } from '@/lib/auth-client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
}

export default function OrganizationPage() {
  const t = useTranslations('organization');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch user's organizations
  useEffect(() => {
    async function fetchOrganizations() {
      if (!session?.user) return;

      try {
        const result = await orgClient.list({});
        if (result.data) {
          setOrganizations(result.data);
          // If user has no organizations, show create form
          if (result.data.length === 0) {
            setShowCreateForm(true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch organizations:', err);
      } finally {
        setLoading(false);
      }
    }

    if (!sessionLoading) {
      fetchOrganizations();
    }
  }, [session, sessionLoading]);

  // Redirect if not logged in or if already has active organization
  useEffect(() => {
    if (sessionLoading) return;

    if (!session?.user) {
      router.push('/login');
      return;
    }

    // If user already has an active organization, redirect to dashboard
    if (session.session?.activeOrganizationId) {
      router.push('/dashboard');
    }
  }, [session, sessionLoading, router]);

  const handleSelectOrganization = async (orgId: string) => {
    setSelecting(orgId);
    setError(null);

    try {
      await orgClient.setActive({ organizationId: orgId });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      console.error('Failed to select organization:', err);
      setError(t('selectError'));
      setSelecting(null);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      // Generate slug from name
      const slug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const result = await orgClient.create({
        name: orgName.trim(),
        slug: slug || `org-${Date.now()}`,
      });

      if (result.data) {
        // Set the new org as active
        await orgClient.setActive({ organizationId: result.data.id });
        router.push('/dashboard');
        router.refresh();
      } else if (result.error) {
        const errorMsg = result.error.message || '';
        // If organization already exists, refresh the list
        if (
          errorMsg.toLowerCase().includes('already exists') ||
          errorMsg.toLowerCase().includes('slug')
        ) {
          const listResult = await orgClient.list({});
          if (listResult.data && listResult.data.length > 0) {
            setOrganizations(listResult.data);
            setShowCreateForm(false);
            setError(null);
            // Auto-select if only one org
            if (listResult.data.length === 1) {
              await handleSelectOrganization(listResult.data[0].id);
              return;
            }
          }
        }
        setError(errorMsg || t('createError'));
        setCreating(false);
      }
    } catch (err) {
      console.error('Failed to create organization:', err);
      setError(t('createError'));
      setCreating(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold font-heading">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Existing Organizations */}
        {organizations.length > 0 && !showCreateForm && (
          <div className="space-y-3 mb-6">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelectOrganization(org.id)}
                disabled={selecting !== null}
                className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  {org.logo ? (
                    <Image
                      src={org.logo}
                      alt={org.name}
                      width={32}
                      height={32}
                      className="rounded"
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{org.name}</p>
                  <p className="text-sm text-muted-foreground">@{org.slug}</p>
                </div>
                {selecting === org.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Create New Organization Form */}
        {showCreateForm ? (
          <form onSubmit={handleCreateOrganization} className="space-y-4">
            <div>
              <label htmlFor="orgName" className="block text-sm font-medium mb-2">
                {t('orgName')}
              </label>
              <input
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={t('orgNamePlaceholder')}
                className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={creating}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              {organizations.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                  className="flex-1 py-2 px-4 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {tCommon('cancel')}
                </button>
              )}
              <button
                type="submit"
                disabled={!orgName.trim() || creating}
                className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('createOrganization')}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Plus className="h-5 w-5" />
            {t('createNew')}
          </button>
        )}
      </div>
    </div>
  );
}
