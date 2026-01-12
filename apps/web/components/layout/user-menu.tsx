'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { User, LogOut, Settings } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useClickOutside } from '@/lib/hooks';
import { signOut } from '@/lib/auth-client';

export function UserMenu() {
  const t = useTranslations('auth');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const closeMenu = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(closeMenu);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;

    setOpen(false);
    setIsLoggingOut(true);

    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push('/login');
          },
          onError: () => {
            setIsLoggingOut(false);
          },
        },
      });
    } catch {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, router]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={tCommon('userMenu')}
        className={cn(
          'flex items-center gap-2 p-1.5 rounded-full transition-colors cursor-pointer',
          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-4 w-4 text-primary" />
        </div>
      </button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden min-w-[180px]"
        >
          <div className="p-1">
            <Link
              href="/dashboard/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent cursor-pointer focus-visible:outline-none focus-visible:bg-accent"
            >
              <Settings className="h-4 w-4" />
              {tNav('settings')}
            </Link>
            <button
              role="menuitem"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent text-left cursor-pointer',
                'focus-visible:outline-none focus-visible:bg-accent',
                isLoggingOut && 'opacity-50 cursor-not-allowed'
              )}
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? tCommon('loading') : t('logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
