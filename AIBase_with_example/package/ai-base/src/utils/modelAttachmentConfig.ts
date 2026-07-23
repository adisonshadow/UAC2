/** 模型输入模态（与后台 model_io_tags.modality 一致） */
export type ModelInputModality = 'text' | 'image' | 'audio' | 'video' | 'file';

const ATTACHMENT_MODALITIES: ModelInputModality[] = ['image', 'audio', 'video', 'file'];

const IMAGE_ACCEPT = 'image/*';
const AUDIO_ACCEPT = 'audio/*';
const VIDEO_ACCEPT = 'video/*';
const DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.xml,.html,.htm,.ts,.tsx,.js,.jsx,.py';

const MODALITY_ACCEPT: Record<string, string> = {
  image: IMAGE_ACCEPT,
  audio: AUDIO_ACCEPT,
  video: VIDEO_ACCEPT,
  file: DOCUMENT_ACCEPT,
};

const TEXT_LIKE_EXTENSIONS = new Set([
  'txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'log', 'yaml', 'yml',
  'ts', 'tsx', 'js', 'jsx', 'py',
]);

export function supportsModelAttachments(inputTags?: string[]): boolean {
  if (!inputTags?.length) return false;
  return inputTags.some((tag) => ATTACHMENT_MODALITIES.includes(tag as ModelInputModality));
}

export function getModelAttachmentAccept(inputTags?: string[]): string | undefined {
  if (!inputTags?.length) return undefined;
  const parts = inputTags
    .map((tag) => MODALITY_ACCEPT[tag])
    .filter(Boolean);
  return parts.length ? [...new Set(parts)].join(',') : undefined;
}

function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

export function resolveFileModality(file: File, inputTags?: string[]): ModelInputModality | null {
  const tags = inputTags || [];
  const mime = (file.type || '').toLowerCase();
  const ext = fileExtension(file.name);

  if (mime.startsWith('image/') && tags.includes('image')) return 'image';
  if (mime.startsWith('audio/') && tags.includes('audio')) return 'audio';
  if (mime.startsWith('video/') && tags.includes('video')) return 'video';
  if (tags.includes('file')) {
    if (mime.startsWith('image/') || mime.startsWith('audio/') || mime.startsWith('video/')) {
      return null;
    }
    if (
      DOCUMENT_ACCEPT.split(',').some((item) => item.replace('.', '') === ext)
      || TEXT_LIKE_EXTENSIONS.has(ext)
      || mime.includes('pdf')
      || mime.includes('document')
      || mime.includes('sheet')
      || mime.includes('presentation')
    ) {
      return 'file';
    }
  }
  return null;
}

export function isFileAllowedForModel(file: File, inputTags?: string[]): boolean {
  return resolveFileModality(file, inputTags) != null;
}

export function isTextLikeDocument(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  const ext = fileExtension(file.name);
  return mime.startsWith('text/') || TEXT_LIKE_EXTENSIONS.has(ext);
}
