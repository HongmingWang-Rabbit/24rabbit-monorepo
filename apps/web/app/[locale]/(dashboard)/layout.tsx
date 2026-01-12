import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { OrganizationGuard } from '@/components/providers/organization-guard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrganizationGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </OrganizationGuard>
  );
}
