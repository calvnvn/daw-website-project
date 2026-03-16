import { Helmet } from "react-helmet-async";

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
  description = "PT Dharma Agung Wijaya (DAW) is a leading company committed to sustainable business practices, energy transition, and innovative investments.",
  image = "/daw-default-banner.jpg", // Pastikan nanti Abang punya gambar default ini di folder public
  url = typeof window !== "undefined"
    ? window.location.href
    : "https://daw.co.id",
  type = "website",
  author = "PT Dharma Agung Wijaya",
  publishedAt,
  updatedAt,
}: SEOProps) {
  const siteName = "PT Dharma Agung Wijaya";

  // SMART TITLE: Jika judul sudah ada "DAW", jangan ditumpuk panjang-panjang
  const pageTitle =
    title.includes("DAW") || title.includes(siteName)
      ? title
      : `${title} | ${siteName}`;

  // JSON-LD (Structured Data) - Format resmi standar Google
  const structuredData = {
    "@context": "https://schema.org",
    "@type": type === "article" ? "Article" : "Organization",
    ...(type === "article"
      ? {
          headline: title,
          description: description,
          image: image,
          author: {
            "@type": "Organization",
            name: author,
          },
          publisher: {
            "@type": "Organization",
            name: siteName,
            logo: {
              "@type": "ImageObject",
              url: "https://daw.co.id/logo-daw.png", // Ganti dengan URL asli jika sudah live
            },
          },
          datePublished: publishedAt || new Date().toISOString(),
          dateModified: updatedAt || new Date().toISOString(),
        }
      : {
          name: siteName,
          url: url,
          logo: "https://daw.co.id/logo-daw.png",
          description: description,
          address: {
            "@type": "PostalAddress",
            streetAddress: "Jl. Cendana Parc North 10 No.10, Kadu, Kec. Curug",
            addressLocality: "Kabupaten Tangerang",
            addressRegion: "Banten",
            postalCode: "15810",
            addressCountry: "ID",
          },
        }),
  };

  return (
    <Helmet>
      {/* --- STANDARD SEO (Dasar Google) --- */}
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* --- OPEN GRAPH (Preview WhatsApp, LinkedIn, Facebook) --- */}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={`Cover image for ${title}`} />

      {/* --- TWITTER CARDS (Preview platform X) --- */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* --- ADVANCED STRUCTURED DATA (Informasi Rahasia untuk Robot) --- */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
}
