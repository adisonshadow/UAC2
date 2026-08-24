const LOGO_MAX_EDGE = 648;

export function isSvgFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return type === 'image/svg+xml' || name.endsWith('.svg');
}

function fileNameAndType(file: File): { type: string; name: string } {
  return {
    type: (file.type || '').toLowerCase(),
    name: (file.name || '').toLowerCase(),
  };
}

function isPngFile(file: File): boolean {
  const { type, name } = fileNameAndType(file);
  return type === 'image/png' || name.endsWith('.png');
}

function isGifFile(file: File): boolean {
  const { type, name } = fileNameAndType(file);
  return type === 'image/gif' || name.endsWith('.gif');
}

function isWebpFile(file: File): boolean {
  const { type, name } = fileNameAndType(file);
  return type === 'image/webp' || name.endsWith('.webp');
}

/** PNG / GIF / 带透明通道的 WebP 导出时保留 alpha，不再转成不透明格式 */
function resolveRasterOutput(file: File): { mimeType: string; ext: string; quality: number } {
  if (isPngFile(file)) {
    return { mimeType: 'image/png', ext: 'png', quality: 1 };
  }
  if (isGifFile(file)) {
    return { mimeType: 'image/png', ext: 'png', quality: 1 };
  }
  if (isWebpFile(file)) {
    return { mimeType: 'image/webp', ext: 'webp', quality: 0.9 };
  }
  return { mimeType: 'image/jpeg', ext: 'jpg', quality: 0.9 };
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

/** 栅格图超过 maxEdge 时等比缩放；PNG/GIF 保留透明通道，不转为 WebP。SVG 原样返回 */
export async function prepareLogoUploadFile(file: File, maxEdge = LOGO_MAX_EDGE): Promise<File> {
  if (isSvgFile(file)) {
    return file;
  }

  const img = await loadImageFromFile(file);
  const { naturalWidth: width, naturalHeight: height } = img;
  const scale = Math.min(maxEdge / width, maxEdge / height, 1);
  if (scale === 1) {
    return file;
  }

  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    throw new Error('图片处理失败');
  }
  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const { mimeType, ext, quality } = resolveRasterOutput(file);
  const baseName = (file.name || 'logo').replace(/\.[^.]+$/, '') || 'logo';
  return canvasToFile(canvas, `${baseName}.${ext}`, mimeType, quality);
}

export { LOGO_MAX_EDGE };
