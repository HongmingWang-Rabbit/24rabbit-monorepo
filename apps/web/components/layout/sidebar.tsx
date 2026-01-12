'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  LayoutDashboard,
  Sparkles,
  FileText,
  Clock,
  Send,
  Link2,
  BarChart3,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'brands', href: '/dashboard/brands', icon: Sparkles },
  { name: 'materials', href: '/dashboard/materials', icon: FileText },
  { name: 'pending', href: '/dashboard/pending', icon: Clock },
  { name: 'posts', href: '/dashboard/posts', icon: Send },
  { name: 'accounts', href: '/dashboard/accounts', icon: Link2 },
  { name: 'analytics', href: '/dashboard/analytics', icon: BarChart3 },
];

const bottomNav = [
  { name: 'settings', href: '/dashboard/settings', icon: Settings },
  { name: 'help', href: '/dashboard/help', icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  // Remove locale prefix from pathname for comparison
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '');

  return (
    <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">24</span>
          </div>
          <span className="font-heading font-bold text-lg text-sidebar-foreground">Rabbit</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive =
            pathWithoutLocale === item.href ||
            (item.href !== '/dashboard' && pathWithoutLocale.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                isActive
                  ? 'bg-sidebar-primary/10 text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {t(item.name)}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-1">
        {bottomNav.map((item) => {
          const isActive = pathWithoutLocale.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                isActive
                  ? 'bg-sidebar-primary/10 text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {t(item.name)}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
