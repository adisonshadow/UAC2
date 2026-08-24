const { parentPort } = require('worker_threads');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function fileSize(filePath) {
  const stats = await fsp.stat(filePath);
  return stats.size;
}

async function placeFile(sourcePath, destPath) {
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  try {
    await fsp.rename(sourcePath, destPath);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await pipeline(fs.createReadStream(sourcePath), fs.createWriteStream(destPath));
    await fsp.unlink(sourcePath);
  }
}

if (!parentPort) {
  throw new Error('finalizeTusUploadWorker 只能在 worker_threads 中运行');
}

parentPort.on('message', async (job) => {
  const id = job?.id;
  try {
    if (job.action === 'hash') {
      const md5 = await hashFile(job.sourcePath);
      const size = await fileSize(job.sourcePath);
      parentPort.postMessage({ ok: true, id, result: { md5, size } });
      return;
    }
    if (job.action === 'place') {
      await placeFile(job.sourcePath, job.destPath);
      parentPort.postMessage({ ok: true, id, result: { placed: true } });
      return;
    }
    throw new Error(`未知 worker action: ${job.action}`);
  } catch (error) {
    parentPort.postMessage({ ok: false, id, error: error.message || String(error) });
  }
});
