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
  description = "PT Dharma Agung Wijaya (DAW Group) is an operating holding company focusing on Renewable Energy and Natural Resources (Agribusiness), committed to living in harmony with mother nature.",
  image = "/daw-default-banner.jpg", // Pastikan file ini ada di folder public/ (1200x630px)
  url = typeof window !== "undefined"
    ? window.location.href
    : "https://daw.co.id",
  type = "website",
  author = "PT Dharma Agung Wijaya",
  publishedAt,
  updatedAt,
}: SEOProps) {
  const siteName = "PT Dharma Agung Wijaya";

  // Ganti baseUrl jika domain utama bukan daw.co.id (misal: .com atau .id)
  const baseUrl = "https://daw.co.id";

  // 1. SMART TITLE LOGIC
  const pageTitle =
    title.includes("DAW") || title.includes(siteName)
      ? title
      : `${title} | ${siteName}`;

  // 2. ABSOLUTE IMAGE URL ASSEMBLY
  // Penting: WhatsApp/LinkedIn tidak bisa baca gambar jika URL-nya relatif (hanya /nama-file.jpg)
  const absoluteImage = image.startsWith("http") ? image : `${baseUrl}${image}`;

  // 3. JSON-LD (Structured Data for Google Search Engine)
  const structuredData = {
    "@context": "https://schema.org",
    "@type": type === "article" ? "Article" : "Organization",
    ...(type === "article"
      ? {
          headline: title,
          description: description,
          image: absoluteImage,
          author: {
            "@type": "Organization",
            name: author,
          },
          publisher: {
            "@type": "Organization",
            name: siteName,
            logo: {
              "@type": "ImageObject",
              url: `${baseUrl}/logo-daw.png`, // Pastikan file logo-daw.png ada di folder public/
            },
          },
          datePublished: publishedAt || new Date().toISOString(),
          dateModified: updatedAt || new Date().toISOString(),
        }
      : {
          name: siteName,
          url: baseUrl,
          logo: `${baseUrl}/logo-daw.png`,
          description: description,
          address: {
            "@type": "PostalAddress",
            streetAddress:
              "Alamanda Tower, 22nd Floor, Jl. TB Simatupang Kav 23-24 Cilandak Barat",
            addressLocality: "Jakarta Selatan",
            addressRegion: "DKI Jakarta",
            postalCode: "12430",
            addressCountry: "ID",
          },
        }),
  };

  return (
    <Helmet>
      {/* --- STANDARD BROWSER SEO --- */}
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* --- OPEN GRAPH SYSTEM (Standard for WA, LinkedIn, Facebook) --- */}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:alt" content={`Preview for ${title}`} />

      {/* --- TWITTER CARDS --- */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />

      {/* --- GOOGLE BOT SPECIAL (JSON-LD) --- */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </Helmet>
  );
}

/** * TIPS PRODUCTION UNTUK DEVELOPER (CALVIN):
 * 1. Gunakan 'LinkedIn Post Inspector' (online tool gratis) untuk ngetes link.
 * 2. Karena ini React SPA, pastikan hosting di-set untuk "Fallthrough to index.html"
 * agar URL seperti /page/energy tidak 404 saat di-refresh.
 * 3. File 'daw-default-banner.jpg' dan 'logo-daw.png' harus ditaruh di folder ROOT public/,
 * BUKAN di src/assets/ agar path baseUrl/logo-daw.png valid.
 */
