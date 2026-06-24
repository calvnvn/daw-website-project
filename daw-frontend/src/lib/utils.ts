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

  // Preserve local preview blobs
  if (path.startsWith("blob:")) {
    return path;
  }

  // Normalize absolute URLs that contain /uploads/ (e.g. http://localhost:5550/uploads/file.webp)
  // This ensures images uploaded in one environment work correctly in another
  if (path.includes("/uploads/")) {
    const filename = path.split("/uploads/").pop();
    if (filename) {
      const baseUrl = BASE_UPLOAD_URL.replace(/\/$/, "");
      return `${baseUrl}/${filename}`;
    }
  }

  // Preserve external URLs that don't involve /uploads/
  if (path.startsWith("http")) {
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

// TYPE GUARDS
// Narrow down unknown errors to expected shapes
export interface ApiError {
  response?: {
    data?: {
      message?: string;
      response?: string;
      error?: string;
    };
  };
  message?: string;
}

export function isApiError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null;
}

// ERROR EXTRACTION
// Standardizes the extraction of error messages across different backend & OWL response shapes
export function getErrorMessage(error: unknown, fallback = "An unexpected error occurred."): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  
  if (isApiError(error)) {
    const data = error.response?.data;
    if (data) {
      if (typeof data === "string") return data;
      if (data.message) return data.message;
      if (data.response) return data.response;
      if (data.error) return data.error;
    }
    if (error.message) return error.message;
  }
  
  return fallback;
}

