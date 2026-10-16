import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/bikram', '/admin', '/b1kr4m-5h4d0w', '/administrator', '/cpanel', '/root', '/wp-admin', '/dashboard/'] }, sitemap: `${SITE_URL}/sitemap.xml` };
}
