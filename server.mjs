import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractBook } from './lib/extractors.mjs';
import { callImageModel, callTextModel, providerPresets } from './lib/providers.mjs';
import { buildPrompt } from './lib/prompts.mjs';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(appDir, 'public');
const port = Number(process.env.PORT || 4177);
const host = process.env.HOST || '127.0.0.1';
const MAX_JSON_BYTES = 36 * 1024 * 1024;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) throw new Error('请求过大，请缩小文件或输入内容。');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new Error('请求内容不是有效 JSON。');
  }
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/health') {
    return sendJson(response, 200, {
      ok: true,
      version: '0.1.0',
      providers: Object.entries(providerPresets).map(([id, value]) => ({ id, ...value })),
    });
  }

  if (request.method !== 'POST') return sendJson(response, 405, { error: '只支持 POST。' });
  const body = await readJson(request);

  if (pathname === '/api/extract') {
    const result = await extractBook(body);
    return sendJson(response, 200, result);
  }

  if (pathname === '/api/generate') {
    const { system, prompt } = buildPrompt(body.stage, body.payload);
    const text = await callTextModel(body.config ?? {}, system, prompt);
    return sendJson(response, 200, { text });
  }

  if (pathname === '/api/image') {
    const result = await callImageModel(body.config ?? {}, String(body.prompt ?? '').slice(0, 8_000));
    return sendJson(response, 200, result);
  }

  return sendJson(response, 404, { error: '接口不存在。' });
}

async function serveStatic(response, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(publicDir, relative);
  const publicPrefix = `${path.resolve(publicDir)}${path.sep}`;
  if (resolved !== path.join(publicDir, 'index.html') && !resolved.startsWith(publicPrefix)) {
    return sendJson(response, 403, { error: '路径无效。' });
  }
  try {
    const data = await fs.readFile(resolved);
    response.writeHead(200, {
      'content-type': mime[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy': "default-src 'self' data: blob:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http: https:; font-src 'self' data:; frame-ancestors 'none'",
    });
    response.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(response, 404, { error: '页面不存在。' });
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(request, response, url.pathname);
    else await serveStatic(response, decodeURIComponent(url.pathname));
  } catch (error) {
    sendJson(response, 400, { error: error.message || '请求处理失败。' });
  }
});

server.listen(port, host, () => {
  console.log(`万象铸界已启动：http://${host}:${port}`);
  console.log(`工作目录：${appDir}`);
});
