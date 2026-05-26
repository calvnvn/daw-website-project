import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { BASE_UPLOAD_URL } from "./api";

/**
 * UTILITIES: Infrastructure Support
 * Core helpers for style orchestration and asset path normalization.
 */

// STYLING
// Merge and resolve Tailwind CSS class collisions intelligently
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ASSET RESOLUTION
// Transform raw database paths into valid, absolute resource URLs
export const getCleanImageUrl = (path: string | null | undefined): string => {
  if (!path) return "";

  // Preserve absolute protocols and local preview blobs
  if (path.startsWith("blob:") || path.startsWith("http")) {
    return path;
  }

  // Sanitize path by stripping redundant directory prefixes
  const cleanPath = path.replace(/^\/?uploads\/?/, "");

  // Compose absolute URL from base storage configuration
  const baseUrl = BASE_UPLOAD_URL.replace(/\/$/, "");
  const normalizedPath = cleanPath.startsWith("/")
    ? cleanPath
    : `/${cleanPath}`;

  return `${baseUrl}${normalizedPath}`;
};

// ERROR EXTRACTION
// Standardizes the extraction of error messages across different backend & OWL response shapes
export function getErrorMessage(error: any, fallback = "An unexpected error occurred."): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  
  const data = error.response?.data;
  if (data) {
    if (typeof data === "string") return data;
    if (data.message) return data.message;
    if (data.response) return data.response;
    if (data.error) return data.error;
  }
  
  if (error.message) return error.message;
  return fallback;
}

