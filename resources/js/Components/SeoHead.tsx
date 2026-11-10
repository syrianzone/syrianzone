import { Head, usePage } from '@inertiajs/react';

/**
 * Keeps the per-page <head> metadata in step with client-side navigation.
 *
 * The tags themselves are printed by the root Blade view on every full page
 * load, from the same `seo` shared prop (resolved once per request by
 * App\Support\Seo\SeoMeta). That makes them independent of what a page renders
 * on the server. This component therefore renders nothing during SSR, where it
 * would only duplicate them; in the browser it takes the server-printed tags
 * over (they carry the `inertia` attribute) and updates them as the visitor
 * moves between pages. See docs/guidelines/seo.md.
 */
export interface SeoData {
  title: string;
  /** The title a link preview shows: the page or record's own name. */
  og_title: string;
  description: string;
  type: string;
  image: string;
  image_type: string;
  url: string;
  canonical: string;
  robots: string;
  json_ld: string;
  twitter_site?: string | null;
}

export default function SeoHead() {
  const { seo } = usePage<{ seo?: SeoData }>().props;
  if (!seo || typeof window === 'undefined') return null;

  return (
    <Head>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <link rel="canonical" href={seo.canonical} />
      <meta name="robots" content={seo.robots} />
      <meta property="og:site_name" content="Syrian Zone" />
      <meta property="og:locale" content="ar_SY" />
      <meta property="og:title" content={seo.og_title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:type" content={seo.type} />
      <meta property="og:url" content={seo.url} />
      <meta property="og:image" content={seo.image} />
      <meta property="og:image:type" content={seo.image_type} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={seo.og_title} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.og_title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={seo.image} />
      {seo.twitter_site && <meta name="twitter:site" content={seo.twitter_site} />}
      {seo.json_ld && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: seo.json_ld }}
        />
      )}
    </Head>
  );
}
