import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Facebook, Twitter, Linkedin, ExternalLink } from 'lucide-react';

interface PostsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PostsPage({ params }: PostsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PostsPageContent />;
}

function PostsPageContent() {
  const tNav = useTranslations('nav');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">{tNav('posts')}</h1>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <select className="px-3 py-2 bg-background border rounded-md text-sm">
          <option>All Brands</option>
          <option>OMECA</option>
          <option>TechCo</option>
        </select>
        <select className="px-3 py-2 bg-background border rounded-md text-sm">
          <option>All Platforms</option>
          <option>Twitter</option>
          <option>LinkedIn</option>
          <option>Facebook</option>
        </select>
        <select className="px-3 py-2 bg-background border rounded-md text-sm">
          <option>Last 7 days</option>
          <option>Last 30 days</option>
          <option>Last 90 days</option>
        </select>
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        <PostCard
          platform="twitter"
          brand="OMECA"
          content="Upgrade your kitchen with OMECA's professional-grade stainless steel cookware. Built for chefs who demand quality. Shop now!"
          publishedAt="2 hours ago"
          likes={245}
          comments={32}
          shares={18}
          url="#"
        />
        <PostCard
          platform="linkedin"
          brand="OMECA"
          content="Running a restaurant means making smart purchasing decisions. Here's how OMECA can help streamline your kitchen supply chain and reduce costs by up to 30%."
          publishedAt="Yesterday"
          likes={189}
          comments={28}
          shares={12}
          url="#"
        />
        <PostCard
          platform="facebook"
          brand="OMECA"
          content="New product alert! Introducing our commercial-grade induction cooktops. Energy efficient, precise temperature control, and built to last."
          publishedAt="3 days ago"
          likes={156}
          comments={21}
          shares={8}
          url="#"
        />
        <PostCard
          platform="twitter"
          brand="TechCo"
          content="Ship faster, not harder. Our new CI/CD pipeline integration reduces deployment time by 80%. Try it free for 14 days!"
          publishedAt="4 days ago"
          likes={312}
          comments={45}
          shares={67}
          url="#"
        />
      </div>
    </div>
  );
}

function PostCard({
  platform,
  brand,
  content,
  publishedAt,
  likes,
  comments,
  shares,
  url,
}: {
  platform: 'twitter' | 'linkedin' | 'facebook';
  brand: string;
  content: string;
  publishedAt: string;
  likes: number;
  comments: number;
  shares?: number;
  url: string;
}) {
  const icons = {
    twitter: Twitter,
    linkedin: Linkedin,
    facebook: Facebook,
  };
  const Icon = icons[platform];

  const platformColors = {
    twitter: 'text-sky-500',
    linkedin: 'text-blue-700',
    facebook: 'text-blue-600',
  };

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-start gap-4">
        <div className={`p-2 bg-muted rounded-md ${platformColors[platform]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{brand}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground capitalize">{platform}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{publishedAt}</span>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <p className="text-sm mb-4">{content}</p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{likes} likes</span>
            <span>{comments} comments</span>
            {shares !== undefined && <span>{shares} shares</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
