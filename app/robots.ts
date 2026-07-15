import type { MetadataRoute } from 'next';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private app areas and API — nothing useful for crawlers there.
      disallow: ['/dashboard', '/scans', '/account', '/api/'],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
