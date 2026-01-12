'use client';

import { useTranslations } from 'next-intl';
import { Bell, Search } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { LocaleSwitcher } from './locale-switcher';
import { UserMenu } from './user-menu';

export function Header() {
  const t = useTranslations('common');

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('search')}
            className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
        <button className="p-2 rounded-md hover:bg-accent transition-colors cursor-pointer">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
