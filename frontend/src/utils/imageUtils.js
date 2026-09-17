/**
 * NiyamCheck Image Validation and Optimization Utilities
 * Ensures uploads are well-formed, within allowable limits, and optimized for mobile bandwidth.
 */

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Validates file type and file size.
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  // Check MIME type
  const isTypeAllowed =
    ALLOWED_MIME_TYPES.includes(file.type) ||
    file.name.match(/\.(jpe?g|png|webp)$/i);

  if (!isTypeAllowed) {
    return {
      valid: false,
      error: 'Unsupported image format. Please upload a JPEG, PNG, or WebP image.',
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowable limit of 20MB.`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'Uploaded file is empty (0 bytes).',
    };
  }

  return { valid: true };
}

/**
 * Resizes excessively large phone camera shots (e.g. 12MP/48MP) to max 1920px
 * preserving aspect ratio and text sharpness for OCR.
 */
export async function optimizeImageForUpload(file, maxDimension = 1920, quality = 0.88) {
  // If file is not an image or in a non-browser environment, return original
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  return new Promise((resolve) => {
    // If file is already small (< 1MB), skip canvas processing to preserve pristine bytes
    if (file.size < 1024 * 1024) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // If dimensions are within bounds, do not downscale
        if (width <= maxDimension && height <= maxDimension) {
          return resolve(file);
        }

        // Calculate proportional scale
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            const optimizedFile = new File([blob], file.name, {
              type: blob.type || 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(optimizedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
