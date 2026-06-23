export const AI_CAPABILITIES = [
  { label: '文本生成', value: 'text' },
  { label: '图像理解', value: 'vision' },
  { label: '图像生成', value: 'image_generation' },
  { label: '语音输入', value: 'audio_input' },
  { label: '语音输出', value: 'audio_output' },
  { label: '向量嵌入', value: 'embedding' },
  { label: '工具调用', value: 'function_calling' },
];

export const AI_MODALITIES = [
  { label: '文本', value: 'text' },
  { label: '图片', value: 'image' },
  { label: '音频', value: 'audio' },
  { label: '视频', value: 'video' },
  { label: '文件', value: 'file' },
];

export const ADAPTER_TYPE_OPTIONS = [
  { label: 'OpenAI Compatible', value: 'openai_compatible' },
];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const EXECUTION_TYPE_OPTIONS = [
  { label: 'Client（前端执行）', value: 'client' },
  { label: 'Server HTTP', value: 'server_http' },
  { label: 'Server Builtin', value: 'server_builtin' },
];
