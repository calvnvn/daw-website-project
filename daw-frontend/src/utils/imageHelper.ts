import imageCompression from "browser-image-compression";

/**
 * UTILITY: Image Optimizer
 * * @description Mengompres gambar di sisi client sebelum diunggah ke server.
 * Menjaga keseimbangan antara kualitas visual dan beban storage server.
 */

interface CompressionConfig {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

const DEFAULT_CONFIG: CompressionConfig = {
  maxSizeMB: 1, // Target di bawah 1MB
  maxWidthOrHeight: 1920, // Resolusi Full HD
  useWebWorker: true, // Pakai background process biar gak lag
};

export const compressImage = async (
  file: File,
  customConfig: CompressionConfig = {},
): Promise<File> => {
  const options = { ...DEFAULT_CONFIG, ...customConfig };

  try {
    console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    const compressedFile = await imageCompression(file, options);

    console.log(
      `Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
    );

    // Kembalikan file baru dengan nama yang sama agar backend tidak bingung
    return new File([compressedFile], file.name, {
      type: file.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error("Image compression failed:", error);
    // Jika gagal, kembalikan file asli (fail-safe)
    return file;
  }
};
