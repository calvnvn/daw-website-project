import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { BASE_UPLOAD_URL } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * REFACTORED: getCleanImageUrl
 * @description Safely resolves image paths for local previews (blob),
 * external links (http), and server-hosted assets (uploads).
 */
export const getCleanImageUrl = (path: string | null | undefined): string => {
  // 1. Fallback jika path kosong (Sangat disarankan memakai path gambar default)
  if (!path) return "";

  // 2. Jika path adalah Blob URL (Hasil dari URL.createObjectURL untuk preview)
  // atau sudah berupa Full URL (http/https), langsung kembalikan as-is.
  if (path.startsWith("blob:") || path.startsWith("http")) {
    return path;
  }

  // 3. Sanitasi path dari prefix "uploads" atau "/uploads" secara presisi menggunakan Regex
  // Ini mencegah double "uploads/uploads" di URL akhir.
  const cleanPath = path.replace(/^\/?uploads\/?/, "");

  // 4. Konstruksi URL Akhir
  // Menghapus slash di akhir BASE_UPLOAD_URL jika ada, lalu menggabungkannya dengan path bersih.
  const baseUrl = BASE_UPLOAD_URL.replace(/\/$/, "");
  const normalizedPath = cleanPath.startsWith("/")
    ? cleanPath
    : `/${cleanPath}`;

  return `${baseUrl}${normalizedPath}`;
};
