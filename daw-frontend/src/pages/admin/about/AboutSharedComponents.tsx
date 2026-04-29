import React, { useState, useEffect, useMemo } from "react";
import { ImageOff, Edit } from "lucide-react";
import { getCleanImageUrl } from "@/lib/utils";

export interface PhotoPreviewerProps {
  file?: File | null;
  savedUrl?: string | null;
  isItemLocked?: boolean;
}

// SHARED PHOTO PREVIEWER
export const PhotoPreviewer = React.memo(
  ({ file, savedUrl, isItemLocked = false }: PhotoPreviewerProps) => {
    const [isDecoding, setIsDecoding] = useState(false);
    const [hasError, setHasError] = useState(false);

    const previewUrl = useMemo(() => {
      if (file) {
        try {
          return URL.createObjectURL(file);
        } catch (err) {
          console.error("🚨 Gagal memproses file gambar:", err);
          setHasError(true);
          return null;
        }
      }
      return savedUrl ? getCleanImageUrl(savedUrl) : null;
    }, [file, savedUrl]);

    useEffect(() => {
      setHasError(false);
      if (file) setIsDecoding(true);
    }, [previewUrl, file]);

    useEffect(() => {
      return () => {
        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      };
    }, [previewUrl]);

    return (
      <div
        className={`relative w-24 h-24 rounded-full border-4 border-slate-100 flex items-center justify-center overflow-hidden shadow-sm shrink-0 transition-all duration-300 ${
          isItemLocked
            ? "bg-slate-100 opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed"
            : "bg-white group"
        }`}>
        {/* FALLBACK LOGIC */}
        {previewUrl && !hasError ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
            onLoad={() => setIsDecoding(false)}
          />
        ) : (
          <div className="flex flex-col items-center animate-in fade-in duration-300">
            <ImageOff className="w-6 h-6 text-slate-300 mb-1" />
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
              No Image
            </span>
          </div>
        )}

        {/* LOADING SPINNER */}
        {isDecoding && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 ">
            <div className="w-5 h-5 border-2 border-daw-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* HOVER OVERLAY */}
        {!isItemLocked && (
          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <Edit className="w-5 h-5 text-white drop-shadow-md" />
          </div>
        )}
      </div>
    );
  },
);

PhotoPreviewer.displayName = "PhotoPreviewer";

export interface ManagementImageProps {
  src: string | null;
  alt: string;
}

// SHARED MANAGEMENT IMAGE
export const ManagementImage = React.memo(
  ({ src, alt }: ManagementImageProps) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
      setHasError(false);
    }, [src]);

    const finalSrc = useMemo(() => (src ? getCleanImageUrl(src) : null), [src]);

    if (!finalSrc || hasError) {
      return (
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
          <ImageOff className="w-4 h-4" />
        </div>
      );
    }

    return (
      <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-white shadow-sm">
        <img
          src={finalSrc}
          alt={alt}
          className="w-full h-full object-cover bg-slate-50"
          decoding="async"
          loading="lazy"
          onError={() => {
            console.error(`Gagal memuat gambar untuk: ${alt}`);
            setHasError(true);
          }}
        />
      </div>
    );
  },
);

ManagementImage.displayName = "ManagementImage";
