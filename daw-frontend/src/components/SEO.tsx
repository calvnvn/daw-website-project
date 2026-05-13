import { Helmet } from "react-helmet-async";
import { useSettings } from "@/contexts/SettingsContext";
import { getCleanImageUrl } from "@/lib/utils";

interface SEOProps {
  title: string;
  seoTitle?: string; // Menambahkan dukungan eksplisit untuk kolom seo_title dari database
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
  preloadImage?: string | null;
}

export default function SEO({
  title,
  seoTitle,
  description,
  image,
  url,
  type = "website",
  author,
  publishedAt,
  updatedAt,
  preloadImage,
}: SEOProps) {
  const { settings } = useSettings();

  // 1. SINGLE SOURCE OF TRUTH UNTUK DOMAIN
  // Fetching VITE_SITE_URL dari .env, dengan fallback ke origin browser.
  const envSiteUrl = import.meta.env.VITE_SITE_URL;
  const SITE_URL = envSiteUrl
    ? envSiteUrl.replace(/\/$/, "")
    : typeof window !== "undefined"
      ? window.location.origin
      : "https://daw.co.id";

  // 2. SANITASI CANONICAL URL
  // Avoid window.location.href dan hanya mengambil pathname murni untuk memastikan tidak ada Duplicate Content.
  const cleanPath =
    typeof window !== "undefined" ? window.location.pathname : "";
  const canonicalUrl = url || `${SITE_URL}${cleanPath}`;

  // 3. FALLBACK DATA
  const siteName = settings?.companyName || "PT Dharma Agung Wijaya";
  const defaultDesc =
    "PT Dharma Agung Wijaya (DAW Group) is an operating holding company focusing on Renewable Energy and Natural Resources.";
  const metaDesc = description || defaultDesc;

  // 4. ASSET
  const dynamicFavicon = settings?.faviconUrl
    ? getCleanImageUrl(settings.faviconUrl)
    : "/favicon.png";

  const dynamicLogo = settings?.logoUrl
    ? getCleanImageUrl(settings.logoUrl)
    : "/logo-daw.png";

  const absoluteLogo = dynamicLogo.startsWith("http")
    ? dynamicLogo
    : `${SITE_URL}${dynamicLogo.startsWith("/") ? "" : "/"}${dynamicLogo}`;

  // 5. PRIORITY ENGINE UNTUK TITLE
  const activeTitle = seoTitle || title;
  const pageTitle =
    activeTitle.includes("DAW") ||
    activeTitle.includes(siteName) ||
    activeTitle.includes("Dharma Agung Wijaya")
      ? activeTitle
      : `${activeTitle} | ${siteName}`;

  // 6. ABSOLUTE IMAGE URL UNTUK OPEN GRAPH
  const shareImage = image ? getCleanImageUrl(image) : dynamicLogo;
  const absoluteImage = shareImage.startsWith("http")
    ? shareImage
    : `${SITE_URL}${shareImage.startsWith("/") ? "" : "/"}${shareImage}`;

  // 7. STRUCTURED DATA (JSON-LD)
  const structuredData = {
    "@context": "https://schema.org",
    "@type": type === "article" ? "Article" : "Organization",
    ...(type === "article"
      ? {
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": canonicalUrl,
          },
          headline: activeTitle,
          description: metaDesc,
          image: absoluteImage,
          author: { "@type": "Organization", name: author || siteName },
          publisher: {
            "@type": "Organization",
            name: siteName,
            logo: { "@type": "ImageObject", url: absoluteLogo },
          },
          datePublished: publishedAt || new Date().toISOString(),
          dateModified: updatedAt || new Date().toISOString(),
        }
      : {
          name: siteName,
          url: SITE_URL,
          logo: absoluteLogo,
          description: metaDesc,
          address: {
            "@type": "PostalAddress",
            streetAddress: settings?.address || "Jakarta, Indonesia",
          },
          contactPoint:
            settings?.phone || settings?.email
              ? {
                  "@type": "ContactPoint",
                  telephone: settings?.phone || "",
                  email: settings?.email || "",
                  contactType: "customer service",
                }
              : undefined,
        }),
  };

  return (
    <Helmet>
      {preloadImage &&
        typeof preloadImage === "string" &&
        preloadImage.trim() !== "" && (
          <link
            key={`preload-${preloadImage}`}
            rel="preload"
            as="image"
            href={getCleanImageUrl(preloadImage)}
            fetchPriority="high"
          />
        )}

      <link rel="icon" type="image/png" href={dynamicFavicon} />
      <link rel="apple-touch-icon" href={dynamicFavicon} />

      <title>{pageTitle}</title>
      <meta name="description" content={metaDesc} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={absoluteImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={metaDesc} />
      <meta name="twitter:image" content={absoluteImage} />

      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
}
