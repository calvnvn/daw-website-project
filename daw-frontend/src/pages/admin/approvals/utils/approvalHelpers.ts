export interface ApprovalDraft {
  notrans: string;
  nourut: string;
  module_name: string;
  action: string;
  target_id: string;
  payload: any;
  created_by: string;
  status: string;
  createdAt: string;
  rejection_reason?: string | null;
  kodeapp: string;
  level: number | string;
  nextApp?: string;
  jenispersetujuan?: string;
  currentHolderName?: string;
  currentHolderNik?: string;
  isMyQueue: boolean;
  owlStatus?: string | null;
  _isGhost?: boolean;
  current_level?: number;
  approver_roadmap?: string | any[];
}

export const isHtmlString = (str: any): boolean => {
  if (typeof str !== "string") return false;
  return /<[a-z][\s\S]*>/i.test(str);
};

export const cleanHtmlText = (val: any): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return "";
  let str = String(val);
  if (isHtmlString(str)) {
    str = str.replace(/<[^>]*>?/gm, "");
  }
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

export const isMeaningfulTextField = (key: string, val: any): boolean => {
  const skippedFields = [
    "order",
    "orderIndex",
    "parentId",
    "isActive",
    "templateType",
    "showDropCap",
    "lat",
    "lng",
    "category_id",
    "type",
    "externalLink",
    "pageId",
    "is_locked",
    "lock_ticket",
    "views",
    "view_count",
    "viewCount",
    "likes",
    "shares",
    "clicks",
    "readTime",
    "read_time",
    "status",
    "is_published",
    "published_at",
    "publish_date",
    "created_at",
    "updated_at",
  ];

  // Check if key ends with any skipped field (including nested keys)
  const isSkipped = skippedFields.some((field) => {
    return (
      key === field ||
      key.endsWith(`_${field}`) ||
      key.endsWith(`.${field}`) ||
      key.endsWith(`]_${field}`)
    );
  });
  if (isSkipped) return false;

  const hasMediaKeywords = [
    "image",
    "photo",
    "url",
    "file",
    "gallery",
    "existing_gallery",
    "sidebarLinks",
  ].some((kw) => key.toLowerCase().includes(kw));

  if (hasMediaKeywords) return false;

  if (val && typeof val === "object") return false;

  if (
    typeof val === "string" &&
    (val.startsWith("/uploads/") || val.includes("/uploads/"))
  ) {
    return false;
  }

  return true;
};

export const sanitizeForDiff = (data: any) => {
  if (!data || typeof data !== "object") return {};

  const systemFields = [
    "id",
    "createdAt",
    "updatedAt",
    "is_locked",
    "lock_ticket",
    "_system_note",
    "_filesToDelete",
    "status",
    "is_published",
    "published_at",
    "publish_date",
    "created_at",
    "updated_at",
    "views",
    "likes",
    "share_count",
    "view_count",
    "viewCount",
  ];

  const maybeParseJSON = (val: any) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
    }
    return val;
  };

  // 1. Clean first level system fields
  const cleanData = { ...data };
  systemFields.forEach((key) => delete cleanData[key]);

  // 2. Parse and flatten translations first
  let translations = cleanData._translations;
  translations = maybeParseJSON(translations);
  if (translations && typeof translations === "object") {
    if (translations.id) {
      for (const [key, val] of Object.entries(translations.id)) {
        cleanData[`terjemahan_id_${key}`] = val;
      }
    } else {
      for (const [recKey, fields] of Object.entries(translations)) {
        if (fields && typeof fields === "object") {
          for (const [fKey, val] of Object.entries(fields)) {
            cleanData[`terjemahan_${recKey}_${fKey}`] = val;
          }
        }
      }
    }
  }
  delete cleanData._translations;

  // 3. Deep flatten helper for arrays and objects
  const flatten = (obj: any, prefix = ""): any => {
    if (obj === null || obj === undefined) return {};
    const res: any = {};
    for (const [key, rawVal] of Object.entries(obj)) {
      if (systemFields.includes(key)) continue;

      const val = maybeParseJSON(rawVal);
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (val && typeof val === "object" && !Array.isArray(val)) {
        Object.assign(res, flatten(val, newKey));
      } else if (Array.isArray(val)) {
        val.forEach((item, index) => {
          if (item && typeof item === "object") {
            Object.assign(res, flatten(item, `${newKey}[${index + 1}]`));
          } else {
            res[`${newKey}[${index + 1}]`] = item;
          }
        });
      } else {
        res[newKey] = val;
      }
    }
    return res;
  };

  return flatten(cleanData);
};

// ─── HUMAN-READABLE LABEL DICTIONARIES ───
export const MODULE_LABELS: Record<string, string> = {
  Project: "Proyek Portfolio",
  NewsArticle: "Artikel Berita",
  Management: "Manajemen & Direksi",
  BusinessSection: "Sektor Bisnis",
  BusinessMapMarker: "Penanda Lokasi Peta",
  MapCategory: "Kategori Peta",
  ImpactStats: "Statistik Dampak",
  HeroSlides: "Banner Utama Website",
  HomeSettings: "Pengaturan Halaman Utama",
  InvestmentSettings: "Pengaturan Investasi",
  Affiliate: "Perusahaan Afiliasi",
  Page: "Halaman Konten",
  PAGE: "Halaman Konten",
  Menu: "Menu Navigasi",
  MENU: "Menu Navigasi",
  Achievement: "Penghargaan",
  Philosophy: "Filosofi Perusahaan",
  PhilosophyPillar: "Pilar Filosofi",
  History: "Sejarah Perusahaan",
  AboutInfo: "Informasi Tentang Kami",
  Settings: "Pengaturan Umum",
};

export const ACTION_LABELS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  CREATE: {
    label: "Buat Baru",
    color: "text-emerald-700",
    bg: "bg-emerald-100 border-emerald-200",
  },
  UPDATE: {
    label: "Perbarui",
    color: "text-blue-700",
    bg: "bg-blue-100 border-blue-200",
  },
  DELETE: {
    label: "Hapus",
    color: "text-rose-700",
    bg: "bg-rose-100 border-rose-200",
  },
};

export const FIELD_LABELS: Record<string, string> = {
  title: "Judul",
  name: "Nama",
  excerpt: "Ringkasan",
  content: "Isi Konten",
  cover_image: "Gambar Sampul",
  gallery: "Galeri Foto",
  seo_title: "Judul SEO",
  meta_description: "Deskripsi Meta SEO",
  slug: "Alamat URL",
  status: "Status Publikasi",
  category: "Kategori",
  category_id: "Kategori",
  role: "Jabatan",
  description: "Deskripsi",
  photoUrl: "Foto Profil",
  label: "Label Menu",
  author: "Penulis",
  published_at: "Tanggal Terbit",
  order: "Urutan Tampil",
  level: "Tingkat Jabatan",
  spiritText: "Teks Semangat",
  missionText: "Teks Misi",
  visionText: "Teks Visi",
  introHeadline: "Judul Pengantar",
  introBody: "Isi Pengantar",
  heroTitle: "Judul Banner",
  heroSubtitle: "Subjudul Banner",
  lat: "Koordinat Lintang",
  lng: "Koordinat Bujur",
  locationName: "Nama Lokasi",
  address: "Alamat",
  type: "Jenis",
  isActive: "Status Aktif",
  templateType: "Jenis Template Halaman",
  subtitle: "Subjudul",
  metaDescription: "Deskripsi Meta SEO",
  showDropCap: "Huruf Kapital Besar",
  sidebarLinks: "Tautan Sidebar",
  text: "Teks",
  year: "Tahun",
  icon: "Ikon",
  value: "Nilai",
  suffix: "Satuan",
  desc: "Deskripsi Singkat",
  philosophyTitle: "Judul Filosofi",
  url: "Tautan URL",
  image: "Gambar",
  buttonText: "Teks Tombol",
  buttonLink: "Tautan Tombol",
  parentId: "Menu Induk",
  externalLink: "Tautan Eksternal",
  pageId: "Halaman Tujuan",
  orderIndex: "Urutan Menu",
  existing_gallery: "Galeri Tersimpan",
  // Translation fields
  terjemahan_id_title: "Terjemahan (ID): Judul",
  terjemahan_id_excerpt: "Terjemahan (ID): Ringkasan",
  terjemahan_id_content: "Terjemahan (ID): Isi Konten",
  terjemahan_id_name: "Terjemahan (ID): Nama",
  terjemahan_id_role: "Terjemahan (ID): Jabatan",
  terjemahan_id_description: "Terjemahan (ID): Deskripsi",
  terjemahan_id_label: "Terjemahan (ID): Label",
  terjemahan_id_subtitle: "Terjemahan (ID): Subjudul",
  terjemahan_id_introHeadline: "Terjemahan (ID): Judul Pengantar",
  terjemahan_id_introBody: "Terjemahan (ID): Isi Pengantar",
  terjemahan_id_spiritText: "Terjemahan (ID): Teks Semangat",
  terjemahan_id_missionText: "Terjemahan (ID): Teks Misi",
  terjemahan_id_visionText: "Terjemahan (ID): Teks Visi",
  terjemahan_id_philosophyTitle: "Terjemahan (ID): Judul Filosofi",
  terjemahan_id_text: "Terjemahan (ID): Teks",
  terjemahan_id_locationName: "Terjemahan (ID): Nama Lokasi",
  terjemahan_id_address: "Terjemahan (ID): Alamat",
  terjemahan_id_desc: "Terjemahan (ID): Deskripsi",
  // Nested parent field labels
  histories: "Timeline Sejarah",
  achievements: "Penghargaan",
  pillars: "Pilar Filosofi",
  stats: "Statistik Dampak",
  members: "Anggota Direksi",
  mapMarkers: "Penanda Peta",
};

export const getFieldLabel = (field: string): string => {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];

  // Formatting for array properties, e.g. histories[1]_title
  const arrayMatch = field.match(/^([a-zA-Z0-9]+)\[(\d+)\]_(.+)$/);
  if (arrayMatch) {
    const parentField = arrayMatch[1];
    const index = arrayMatch[2];
    const subfield = arrayMatch[3];
    
    const parentLabel = FIELD_LABELS[parentField] || parentField.replace(/^\w/, (c) => c.toUpperCase());
    const subLabel = getFieldLabel(subfield);
    
    return `${parentLabel} (Item ${index}) - ${subLabel}`;
  }

  // Fallback: prettify any terjemahan_id_ prefix
  if (field.startsWith("terjemahan_id_")) {
    const rawField = field.replace("terjemahan_id_", "");
    return `Terjemahan (ID): ${
      FIELD_LABELS[rawField] ||
      rawField
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .trim()
    }`;
  }
  // Fallback: prettify snake_case/camelCase
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
};

export const getModuleLabel = (moduleName: string): string => {
  return MODULE_LABELS[moduleName] || moduleName;
};

export const getActionInfo = (action: string) => {
  return (
    ACTION_LABELS[action] || {
      label: action,
      color: "text-slate-700",
      bg: "bg-slate-100 border-slate-200",
    }
  );
};

export const getHumanTargetName = (draft: ApprovalDraft): string => {
  const p = draft.payload;
  if (!p) return `#${draft.target_id?.slice(0, 8) || "N/A"}`;
  return (
    p.title ||
    p.name ||
    p.label ||
    p.introHeadline ||
    p.heroTitle ||
    p.locationName ||
    p.philosophyTitle ||
    `#${draft.target_id?.slice(0, 8) || "N/A"}`
  );
};
export const timeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Baru saja";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} jam yang lalu`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} hari yang lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const getInitials = (name: string) => {
  const cleanName = name?.trim();
  if (!cleanName) return "U";

  const parts = cleanName.split(/[\s.]+/);

  if (parts.length > 1 && parts[1].length > 0) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return cleanName.substring(0, 2).toUpperCase();
};
