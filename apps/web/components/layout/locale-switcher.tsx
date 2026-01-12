'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { locales, localeNames, type Locale } from '@/i18n/request';
import { Globe } from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useClickOutside } from '@/lib/hooks';

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const closeMenu = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(closeMenu);

  const onSelectChange = useCallback(
    (newLocale: Locale) => {
      router.replace(pathname, { locale: newLocale });
      setOpen(false);
    },
    [router, pathname]
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Language: ${localeNames[locale]}`}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer',
          'hover:bg-accent text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">{localeNames[locale]}</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden min-w-[140px]"
        >
          {locales.map((loc) => (
            <button
              key={loc}
              role="option"
              aria-selected={loc === locale}
              onClick={() => onSelectChange(loc)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                'hover:bg-accent focus-visible:outline-none focus-visible:bg-accent',
                loc === locale ? 'bg-accent text-accent-foreground' : 'text-popover-foreground'
              )}
            >
              {localeNames[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
