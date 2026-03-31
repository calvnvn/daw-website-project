import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { BASE_UPLOAD_URL } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getCleanImageUrl = (path: string | null | undefined): string => {
  if (!path) return "";

  // 1. Kalau sudah full URL (http...), langsung balikin
  if (path.startsWith("http")) return path;

  // 2. Bersihkan path dari prefix "uploads" atau "/uploads" biar gak double
  const cleanPath = path.replace(/^\/?uploads\/?/, "");

  // 3. Gabungkan BASE_UPLOAD_URL dengan path yang sudah bersih
  // Pastikan tidak ada double slash di antara BASE_UPLOAD_URL dan path
  const baseUrl = BASE_UPLOAD_URL.replace(/\/$/, ""); // Buang slash di akhir base url kalau ada
  const finalPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;

  return `${baseUrl}${finalPath}`;
};
