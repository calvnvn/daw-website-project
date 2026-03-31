import { Helmet } from "react-helmet-async";
import { useSettings } from "@/contexts/SettingsContext";
import { getCleanImageUrl } from "@/lib/utils";

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
}

export default function SEO({
  title,
  description,
  image,
  url = typeof window !== "undefined"
    ? window.location.href
    : "https://daw.co.id",
  type = "website",
  author,
  publishedAt,
  updatedAt,
}: SEOProps) {
  // 1. AMBIL DATA DARI CONTEXT (Hasil inputan Admin tadi)
  const { settings } = useSettings();

  // Fallback values jika database kosong
  const siteName = settings?.companyName || "PT Dharma Agung Wijaya";
  const defaultDesc =
    "PT Dharma Agung Wijaya (DAW Group) is an operating holding company focusing on Renewable Energy and Natural Resources.";
  const metaDesc = description || defaultDesc;

  // 2. LOGO & FAVICON DINAMIS
  // Favicon: Hanya ikon (buat di tab)
  const dynamicFavicon = settings?.faviconUrl
    ? getCleanImageUrl(settings.faviconUrl)
    : "/favicon.png";

  // Logo: Buat sharing sosmed & JSON-LD
  const dynamicLogo = settings?.logoUrl
    ? getCleanImageUrl(settings.logoUrl)
    : "/logo-daw.png";

  // Base URL buat sosmed (WA/LinkedIn butuh full URL https://...)
  const baseUrl = window.location.origin;

  // 3. SMART TITLE LOGIC
  const pageTitle =
    title.includes("DAW") || title.includes(siteName)
      ? title
      : `${title} | ${siteName}`;

  // Assembly Absolute Image URL (Penting buat preview WA)
  const shareImage = image || dynamicLogo;
  const absoluteImage = shareImage.startsWith("http")
    ? shareImage
    : `${baseUrl}${shareImage}`;

  // 4. JSON-LD (Dinamis sesuai data Admin)
  const structuredData = {
    "@context": "https://schema.org",
    "@type": type === "article" ? "Article" : "Organization",
    ...(type === "article"
      ? {
          headline: title,
          description: metaDesc,
          image: absoluteImage,
          author: { "@type": "Organization", name: author || siteName },
          publisher: {
            "@type": "Organization",
            name: siteName,
            logo: { "@type": "ImageObject", url: `${baseUrl}${dynamicLogo}` },
          },
          datePublished: publishedAt || new Date().toISOString(),
          dateModified: updatedAt || new Date().toISOString(),
        }
      : {
          name: siteName,
          url: baseUrl,
          logo: `${baseUrl}${dynamicLogo}`,
          description: metaDesc,
          address: {
            "@type": "PostalAddress",
            streetAddress: settings?.address || "Jakarta, Indonesia",
          },
          contactPoint: {
            "@type": "ContactPoint",
            telephone: settings?.phone,
            email: settings?.email,
            contactType: "customer service",
          },
        }),
  };

  return (
    <Helmet>
      {/* --- DYNAMIC FAVICON (Ini yang bikin logo tab berubah) --- */}
      <link rel="icon" type="image/png" href={dynamicFavicon} />
      <link rel="apple-touch-icon" href={dynamicFavicon} />

      {/* --- STANDARD BROWSER SEO --- */}
      <title>{pageTitle}</title>
      <meta name="description" content={metaDesc} />
      <link rel="canonical" href={url} />

      {/* --- OPEN GRAPH (WA, LinkedIn, FB) --- */}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={absoluteImage} />

      {/* --- TWITTER --- */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={metaDesc} />
      <meta name="twitter:image" content={absoluteImage} />

      {/* --- JSON-LD --- */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
}
