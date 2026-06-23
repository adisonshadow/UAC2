const config = require('../../config');
const { AIBaseError } = require('../../utils/aiErrors');

function buildUpstreamUrl(baseUrl) {
  if (baseUrl.endsWith('/v1')) {
    return `${baseUrl}/chat/completions`;
  }
  return `${baseUrl}/v1/chat/completions`;
}

function buildUpstreamBody(resolvedModel, body) {
  const {
    slug: _slug,
    modelId: _modelId,
    messages,
    stream = false,
    enable_thinking: enableThinking,
    ...rest
  } = body;

  const upstreamBody = {
    ...resolvedModel.defaultParams,
    ...rest,
    model: resolvedModel.upstreamModelId,
    messages,
    stream
  };

  // 兼容 DeepSeek / 通义等 OpenAI 兼容接口：未开启时显式关闭，避免模型默认输出 reasoning
  if (resolvedModel.adapterType === 'openai_compatible') {
    upstreamBody.enable_thinking = enableThinking === true;
  }

  return upstreamBody;
}

function buildHeaders(resolvedModel) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (resolvedModel.apiKey) {
    headers.Authorization = `Bearer ${resolvedModel.apiKey}`;
  }
  return headers;
}

async function forwardChat(resolvedModel, body, traceId) {
  if (!resolvedModel.apiKey) {
    throw new AIBaseError(
      'UPSTREAM_ERROR',
      'Provider API Key 未配置',
      traceId
    );
  }

  const upstreamBody = buildUpstreamBody(resolvedModel, body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.upstreamTimeoutMs);

  try {
    const response = await fetch(buildUpstreamUrl(resolvedModel.baseUrl), {
      method: 'POST',
      headers: buildHeaders(resolvedModel),
      body: JSON.stringify(upstreamBody),
      signal: controller.signal
    });

    return {
      response,
      stream: Boolean(upstreamBody.stream)
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AIBaseError('TIMEOUT', '上游大模型请求超时', traceId);
    }
    throw new AIBaseError(
      'UPSTREAM_ERROR',
      error.message || '上游大模型请求失败',
      traceId
    );
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  forwardChat,
  buildUpstreamBody,
  buildUpstreamUrl
};
