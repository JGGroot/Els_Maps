/**
 * Converts an image data URL to grayscale
 * Uses luminance formula: 0.299*R + 0.587*G + 0.114*B
 */
export async function convertToGrayscale(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the original image
      ctx.drawImage(img, 0, 0);

      // Get image data and convert to grayscale
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Use luminance formula for perceptually accurate grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;     // R
        data[i + 1] = gray; // G
        data[i + 2] = gray; // B
        // Alpha (data[i + 3]) remains unchanged
      }

      ctx.putImageData(imageData, 0, 0);

      // Return as PNG to preserve quality
      resolve(canvas.toDataURL('image/png', 1.0));
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for grayscale conversion'));
    };

    img.src = dataUrl;
  });
}

/**
 * Converts a canvas context to grayscale in place
 * Useful for PDF rendering where we have direct canvas access
 */
export function convertCanvasToGrayscale(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
}
