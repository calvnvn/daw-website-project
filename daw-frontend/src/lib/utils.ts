import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { BASE_UPLOAD_URL } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getCleanImageUrl = (path: string | null | undefined): string => {
  if (!path) return "";

  if (path.startsWith("http")) return path;

  const cleanPath = path.replace(/^\/?uploads/, "");

  const normalizedPath = cleanPath.startsWith("/")
    ? cleanPath
    : `/${cleanPath}`;

  return `${BASE_UPLOAD_URL}${normalizedPath}`;
};
