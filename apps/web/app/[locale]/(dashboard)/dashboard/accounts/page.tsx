import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Facebook, Twitter, Linkedin, Instagram, Youtube, AlertCircle } from 'lucide-react';

interface AccountsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AccountsPage({ params }: AccountsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AccountsPageContent />;
}

function AccountsPageContent() {
  const tNav = useTranslations('nav');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">{tNav('accounts')}</h1>

      {/* Connected Accounts */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Connected (3)</h2>

        <AccountCard
          platform="facebook"
          name="OMECA Restaurant Supply"
          handle="@omeca.official"
          connectedAt="2 days ago"
          brand="OMECA"
          tokenStatus="valid"
          tokenExpires="30 days"
        />
        <AccountCard
          platform="linkedin"
          name="OMECA Inc."
          handle="/company/omeca"
          connectedAt="1 week ago"
          brand="OMECA"
          tokenStatus="expiring"
          tokenExpires="5 days"
        />
        <AccountCard
          platform="twitter"
          name="@omeca_supply"
          handle="@omeca_supply"
          connectedAt="1 week ago"
          brand="OMECA"
          tokenStatus="valid"
        />
      </div>

      {/* Add Account */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Add Account</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ConnectButton platform="facebook" available />
          <ConnectButton platform="twitter" available />
          <ConnectButton platform="linkedin" available />
          <ConnectButton platform="instagram" comingSoon />
          <ConnectButton platform="youtube" comingSoon />
        </div>
      </div>
    </div>
  );
}

function AccountCard({
  platform,
  name,
  handle,
  connectedAt,
  brand,
  tokenStatus,
  tokenExpires,
}: {
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram' | 'youtube';
  name: string;
  handle: string;
  connectedAt: string;
  brand: string;
  tokenStatus: 'valid' | 'expiring' | 'expired';
  tokenExpires?: string;
}) {
  const icons = {
    facebook: Facebook,
    twitter: Twitter,
    linkedin: Linkedin,
    instagram: Instagram,
    youtube: Youtube,
  };
  const Icon = icons[platform];

  const platformColors = {
    facebook: 'text-blue-600',
    twitter: 'text-sky-500',
    linkedin: 'text-blue-700',
    instagram: 'text-pink-600',
    youtube: 'text-red-600',
  };

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-start gap-4">
        <div className={`p-2 bg-muted rounded-md ${platformColors[platform]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-sm text-muted-foreground">{handle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                Manage
              </button>
              <button className="text-sm text-destructive hover:text-destructive/80 cursor-pointer">
                Disconnect
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Connected {connectedAt}</span>
            <span>Linked to: {brand}</span>
            {tokenStatus === 'expiring' && tokenExpires && (
              <span className="flex items-center gap-1 text-yellow-600">
                <AlertCircle className="h-3 w-3" />
                Token expires in {tokenExpires}
                <button className="ml-1 text-primary hover:underline cursor-pointer">
                  Refresh
                </button>
              </span>
            )}
            {tokenStatus === 'valid' && tokenExpires && <span>Token expires: {tokenExpires}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectButton({
  platform,
  available,
  comingSoon,
}: {
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram' | 'youtube';
  available?: boolean;
  comingSoon?: boolean;
}) {
  const icons = {
    facebook: Facebook,
    twitter: Twitter,
    linkedin: Linkedin,
    instagram: Instagram,
    youtube: Youtube,
  };
  const Icon = icons[platform];

  const names = {
    facebook: 'Facebook',
    twitter: 'Twitter',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    youtube: 'YouTube',
  };

  if (comingSoon) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-card border rounded-lg opacity-50">
        <Icon className="h-8 w-8 text-muted-foreground mb-2" />
        <span className="text-sm font-medium">{names[platform]}</span>
        <span className="text-xs text-muted-foreground">Coming Soon</span>
      </div>
    );
  }

  return (
    <button className="flex flex-col items-center justify-center p-4 bg-card border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
      <Icon className="h-8 w-8 text-muted-foreground mb-2" />
      <span className="text-sm font-medium">{names[platform]}</span>
      <span className="text-xs text-primary">Connect</span>
    </button>
  );
}
