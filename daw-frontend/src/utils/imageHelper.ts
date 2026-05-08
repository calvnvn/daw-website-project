import imageCompression from "browser-image-compression";

/**
 * UTILITY: Client-Side Image Optimizer
 * Orchestrates resource-efficient compression to balance visual fidelity with storage constraints.
 */

interface CompressionConfig {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

// INITIALIZATION: System Defaults
// Define performance thresholds for target filesize and resolution
const DEFAULT_CONFIG: CompressionConfig = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

export const compressImage = async (
  file: File,
  customConfig: CompressionConfig = {},
): Promise<File> => {
  // Bypass compression for vector graphics and animated formats to preserve integrity
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  // Merge situational overrides with standardized system options
  const options = { ...DEFAULT_CONFIG, ...customConfig };

  try {
    console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    // Execute asynchronous compression pipeline via background web workers
    const compressedFile = await imageCompression(file, options);

    console.log(
      `Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
    );

    // Synchronize filename extension with the resulting MIME type context
    let newFilename = file.name;
    if (file.type !== compressedFile.type) {
      const newExtension = compressedFile.type.split("/")[1]; // e.g., 'jpeg'
      newFilename = newFilename.replace(/\.[^/.]+$/, `.${newExtension}`);
    }

    // Reconstruct the immutable File object for upstream multi-part processing
    return new File([compressedFile], newFilename, {
      type: compressedFile.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error("Image compression failed:", error);
    // Fallback to original asset reference upon pipeline failure
    return file;
  }
};
