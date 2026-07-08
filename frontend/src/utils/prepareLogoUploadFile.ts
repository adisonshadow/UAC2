const LOGO_MAX_EDGE = 648;

export function isSvgFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return type === 'image/svg+xml' || name.endsWith('.svg');
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

function canvasToFile(canvas: HTMLCanvasElement, fileName: string, mimeType: string, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('图片处理失败'));
          return;
        }
        resolve(new File([blob], fileName, { type: mimeType }));
      },
      mimeType,
      quality,
    );
  });
}

/** 栅格图超过 maxEdge 时等比缩放；SVG 原样返回 */
export async function prepareLogoUploadFile(file: File, maxEdge = LOGO_MAX_EDGE): Promise<File> {
  if (isSvgFile(file)) {
    return file;
  }

  const img = await loadImageFromFile(file);
  const { naturalWidth: width, naturalHeight: height } = img;
  const scale = Math.min(maxEdge / width, maxEdge / height, 1);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('图片处理失败');
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const baseName = (file.name || 'logo').replace(/\.[^.]+$/, '') || 'logo';
  return canvasToFile(canvas, `${baseName}.webp`, 'image/webp', 0.9);
}

export { LOGO_MAX_EDGE };
