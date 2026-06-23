const { AIBaseError } = require('../../utils/aiErrors');

function messageHasImage(messages) {
  if (!Array.isArray(messages)) {
    return false;
  }
  return messages.some((message) => {
    if (Array.isArray(message.content)) {
      return message.content.some((part) => part.type === 'image_url');
    }
    return false;
  });
}

function messageHasAudio(messages) {
  if (!Array.isArray(messages)) {
    return false;
  }
  return messages.some((message) => {
    if (Array.isArray(message.content)) {
      return message.content.some((part) => part.type === 'input_audio' || part.type === 'audio');
    }
    return false;
  });
}

function validateRequest(resolvedModel, body, traceId) {
  const { messages, tools } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AIBaseError('INVALID_REQUEST', 'messages 为必填且不能为空', traceId);
  }

  if (messageHasImage(messages)) {
    const supportsVision = resolvedModel.capabilities.includes('vision')
      || resolvedModel.inputTags.includes('image');
    if (!supportsVision) {
      throw new AIBaseError(
        'CAPABILITY_MISMATCH',
        '当前模型不支持图像输入',
        traceId
      );
    }
  }

  if (messageHasAudio(messages)) {
    if (!resolvedModel.inputTags.includes('audio')) {
      throw new AIBaseError(
        'CAPABILITY_MISMATCH',
        '当前模型不支持音频输入',
        traceId
      );
    }
  }

  if (Array.isArray(tools) && tools.length > 0) {
    if (!resolvedModel.capabilities.includes('function_calling')) {
      throw new AIBaseError(
        'CAPABILITY_MISMATCH',
        '当前模型不支持 function_calling',
        traceId
      );
    }
  }
}

module.exports = {
  validateRequest
};
