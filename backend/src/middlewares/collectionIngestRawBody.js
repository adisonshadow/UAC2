async function readRawBody(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      throw Object.assign(new Error('请求体超过 1MB 限制'), { status: 413 });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function collectionIngestRawBody() {
  return async (ctx, next) => {
    if (ctx.method === 'GET' || ctx.method === 'HEAD') {
      await next();
      return;
    }
    ctx.request.rawBody = await readRawBody(ctx.req);
    await next();
  };
}

module.exports = {
  collectionIngestRawBody,
  readRawBody,
};
