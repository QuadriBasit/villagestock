export async function extractDominantColor(file: File | Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        // Resize down to speed up extraction and blend noisy pixels
        const MAX_SIZE = 100;
        const scale = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const colorCounts: Record<string, number> = {};
        let dominantColor = null;
        let maxCount = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip completely transparent pixels
          if (a < 128) continue;
          
          // Downsample space (e.g. step size 10) to cluster similar colors
          const rBin = Math.round(r / 15) * 15;
          const gBin = Math.round(g / 15) * 15;
          const bBin = Math.round(b / 15) * 15;

          // Skip colors that are too close to pure white or pure black
          const brightness = (rBin * 299 + gBin * 587 + bBin * 114) / 1000;
          if (brightness > 240 || brightness < 20) continue;

          const rgb = `${rBin},${gBin},${bBin}`;
          colorCounts[rgb] = (colorCounts[rgb] || 0) + 1;

          if (colorCounts[rgb] > maxCount) {
            maxCount = colorCounts[rgb];
            dominantColor = { r: rBin, g: gBin, b: bBin };
          }
        }

        if (dominantColor) {
          // Convert to HEX
          const toHex = (c: number) => {
            const hex = Math.min(c, 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          };
          resolve(`#${toHex(dominantColor.r)}${toHex(dominantColor.g)}${toHex(dominantColor.b)}`);
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export async function compressImageToDataUrl(file: File | Blob, maxSize = 600): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // JPEG format with 0.8 quality to keep DB sizes very small
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
