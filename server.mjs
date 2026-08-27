import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractBook } from './lib/extractors.mjs';
import { callTextModel, providerPresets } from './lib/providers.mjs';
import { discoverModels, testModelConnection } from './lib/model-routing.mjs';
import { buildPrompt } from './lib/prompts.mjs';
import { researchIdentifiedSource, validateResearchCoverage } from './lib/research.mjs';
import { mergeCanonSections, normalizeCanonSection, normalizeDirectionResult, normalizeResearchDossier, normalizeTaskBrief, normalizeWorldCanon, parseModelJson, validateAuditResult, validateExpandedModule, validateNarrativeResearch, validateSummaryAlignment, validateTaskResearchPlan } from './lib/workflow.mjs';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(appDir, 'public');
const port = Number(process.env.PORT || 4277);
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

function beginJsonStream(response) {
  response.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-store, no-transform',
    'x-content-type-options': 'nosniff',
    'x-accel-buffering': 'no',
  });
  response.flushHeaders?.();
  return (event) => response.write(`${JSON.stringify(event)}\n`);
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

function stageConfig(config, maxTokens) {
  const requested = Number(config?.maxTokens);
  return { ...(config ?? {}), maxTokens: Number.isFinite(requested) ? Math.min(maxTokens, Math.max(512, requested)) : maxTokens };
}

async function callStructuredStage(stage, payload, config, maxTokens, label, onTextDelta) {
  const { system, prompt } = buildPrompt(stage, payload, config?.outputLocale);
  const raw = await callTextModel(stageConfig(config, maxTokens), system, prompt, { onTextDelta });
  return parseModelJson(raw, label);
}

async function callTextStage(stage, payload, config, maxTokens, onTextDelta) {
  const { system, prompt } = buildPrompt(stage, payload, config?.outputLocale);
  return callTextModel(stageConfig(config, maxTokens), system, prompt, { onTextDelta });
}

async function runStructuredStageWithRepair({ stage, payload, config, maxTokens, label, normalize, attempts = 2, includePreviousResult = false, onEvent }) {
  let lastError;
  let previousResult;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const attemptPayload = lastError
      ? { ...payload, validationFeedback: lastError.message, ...(includePreviousResult && previousResult ? { previousResult } : {}) }
      : payload;
    try {
      onEvent?.({ type: 'phase', phase: attempt ? 'repairing' : 'writing', attempt: attempt + 1, reset: attempt > 0, message: attempt ? `正在根据校验结果修补第 ${attempt + 1} 版草稿` : '模型已经开始撰写，内容正在持续返回' });
      const raw = await callStructuredStage(stage, attemptPayload, config, maxTokens, attempt ? `${label}自动修复` : label, (text) => onEvent?.({ type: 'delta', text, attempt: attempt + 1 }));
      if (includePreviousResult) previousResult = raw;
      onEvent?.({ type: 'phase', phase: 'validating', attempt: attempt + 1, message: '草稿已经返回，正在检查结构、原著承接和内容完整性' });
      return normalize(raw);
    } catch (error) {
      if (/Claude CLI 在 \d+ 分钟内没有返回|无法启动 Claude CLI|Claude CLI 尚未登录|无法连接模型端点|连接模型端点.+超时|模型连接在传输中断开/.test(String(error?.message || ''))) throw error;
      lastError = error;
    }
  }
  throw new Error(`${label}自动修复失败：${lastError?.message || '没有得到可读取的结果。'}`);
}

async function streamResult(response, task) {
  const send = beginJsonStream(response);
  try {
    const result = await task(send);
    send({ type: 'result', data: result });
  } catch (error) {
    send({ type: 'error', error: error.message || '请求处理失败。' });
  } finally {
    response.end();
  }
}

async function buildCanonResult(body, onEvent) {
  const worldCanon = await runStructuredStageWithRepair({
    stage: 'canon', payload: body.payload, config: body.config, maxTokens: 16_000, label: '世界正典编辑器',
    normalize: (raw) => normalizeWorldCanon(raw, body.payload?.seed, body.payload?.researchDossier, body.payload?.taskBrief),
    includePreviousResult: true,
    onEvent,
  });
  return { worldCanon };
}

async function buildCanonSectionResult(body, onEvent) {
  const section = String(body.payload?.section || '');
  const tokenLimits = { C1: 3_000, C2: 6_000, C3: 7_000, C4: 8_000 };
  if (!tokenLimits[section]) throw new Error('未知的世界基础步骤。');
  return runStructuredStageWithRepair({
    stage: 'canon_section', payload: body.payload, config: body.config, maxTokens: tokenLimits[section], label: `世界基础 ${section}`,
    normalize: (raw) => {
      const canonPart = normalizeCanonSection(raw, section, body.payload?.seed, body.payload?.taskBrief);
      const canonSections = { ...(body.payload?.canonSections || {}), [section]: canonPart };
      const worldCanon = section === 'C4'
        ? normalizeWorldCanon(mergeCanonSections(canonSections), body.payload?.seed, body.payload?.researchDossier, body.payload?.taskBrief)
        : null;
      return { canonPart, ...(worldCanon ? { worldCanon } : {}) };
    },
    includePreviousResult: true,
    onEvent,
  });
}

async function generateStageResult(body, onEvent) {
  const announce = (phase, message, attempt = 1, reset = false) => onEvent?.({ type: 'phase', phase, message, attempt, reset });
  const delta = (attempt = 1) => (text) => onEvent?.({ type: 'delta', text, attempt });
  if (body.stage === 'expand') {
    announce('writing', '模型已经开始撰写本节点，正文正在持续返回');
    const generated = await callTextStage('expand', body.payload, body.config, 16_000, delta());
    announce('validating', '正文已经返回，正在检查章节、长度和前后连续性');
    try {
      return { text: validateExpandedModule(generated, body.payload?.batch, body.payload?.worldCanon) };
    } catch (error) {
      announce('repairing', '首稿未通过完整性检查，正在保留已有内容并修补缺口', 2, true);
      const retried = await callTextStage('expand', { ...body.payload, validationFeedback: error.message }, body.config, 16_000, delta(2));
      announce('validating', '修补稿已经返回，正在进行最终检查', 2);
      return { text: validateExpandedModule(retried, body.payload?.batch, body.payload?.worldCanon) };
    }
  }
  if (body.stage === 'lint') {
    announce('writing', '审计模型正在逐项检查世界内容');
    const generated = await callStructuredStage('lint', body.payload, body.config, 12_000, '世界审计模型', delta());
    announce('validating', '审计结果已经返回，正在核对问题是否真实存在');
    try {
      return { text: JSON.stringify(validateAuditResult(generated, body.payload?.worldCanon)) };
    } catch (error) {
      announce('repairing', '审计结果不完整，正在复查缺失项目', 2, true);
      const retried = await callStructuredStage('lint', { ...body.payload, validationFeedback: error.message }, body.config, 12_000, '世界审计模型复查', delta(2));
      announce('validating', '复查结果已经返回，正在完成最终核对', 2);
      return { text: JSON.stringify(validateAuditResult(retried, body.payload?.worldCanon)) };
    }
  }
  if (body.stage === 'summary') {
    announce('writing', '模型正在把完整世界整理成简明版本');
    const generated = await callTextStage('summary', body.payload, body.config, 8_000, delta());
    announce('validating', '简版已经返回，正在检查与世界正典是否一致');
    try {
      return { text: validateSummaryAlignment(generated, body.payload?.worldCanon) };
    } catch (error) {
      announce('repairing', '简版存在遗漏或偏差，正在按正典修补', 2, true);
      const retried = await callTextStage('summary', { ...body.payload, validationFeedback: error.message }, body.config, 8_000, delta(2));
      announce('validating', '修补稿已经返回，正在完成最终检查', 2);
      return { text: validateSummaryAlignment(retried, body.payload?.worldCanon) };
    }
  }
  announce('writing', '模型已经开始生成，内容正在持续返回');
  const text = await callTextStage(body.stage, body.payload, body.config, 16_000, delta());
  announce('validating', '内容已经返回，正在整理最终结果');
  return { text };
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

  if (pathname === '/api/models/discover') {
    return sendJson(response, 200, await discoverModels(body.config ?? {}));
  }

  if (pathname === '/api/models/test') {
    return sendJson(response, 200, await testModelConnection(body.config ?? {}));
  }

  if (pathname === '/api/extract') {
    const result = await extractBook(body);
    return sendJson(response, 200, result);
  }

  if (pathname === '/api/workflow/understand') {
    const taskBrief = await runStructuredStageWithRepair({
      stage: 'understand_task', payload: body.payload, config: body.config, maxTokens: 4_000, label: '任务理解模型',
      normalize: (raw) => validateTaskResearchPlan(normalizeTaskBrief(raw, body.payload?.source)),
    });
    return sendJson(response, 200, { taskBrief });
  }

  if (pathname === '/api/workflow/retrieve') {
    const taskBrief = normalizeTaskBrief(body.taskBrief, body.source);
    if (taskBrief.mode === 'uploaded_book') {
      return sendJson(response, 200, { research: { attempted: false, detected: true, mode: 'uploaded_book', query: body.source?.brief || '', title: body.source?.book?.name || '上传书籍', workKind: '用户上传书籍', works: [], sources: [], warnings: [], identificationMethod: 'llm-v2' } });
    }
    const identification = { mode: taskBrief.mode, works: taskBrief.works, reasoning: taskBrief.interpretation };
    const research = await researchIdentifiedSource(body.source?.brief || '', identification);
    research.identificationMethod = 'llm-v2';
    return sendJson(response, 200, { research: validateResearchCoverage(research, taskBrief) });
  }

  if (pathname === '/api/workflow/analyze') {
    const taskBrief = normalizeTaskBrief(body.taskBrief, body.source);
    const researchDossier = await runStructuredStageWithRepair({
      stage: 'analyze_research', payload: { taskBrief, source: body.source, research: body.research }, config: body.config, maxTokens: 12_000, label: '资料研究模型',
      normalize: (raw) => validateNarrativeResearch(normalizeResearchDossier(raw, taskBrief, body.research?.sources), taskBrief),
    });
    return sendJson(response, 200, { researchDossier });
  }

  if (pathname === '/api/workflow/directions') {
    const taskBrief = normalizeTaskBrief(body.payload?.taskBrief, body.payload?.source);
    const directions = await runStructuredStageWithRepair({
      stage: 'directions', payload: body.payload, config: body.config, maxTokens: 4_000, label: '方向整理模型',
      normalize: (raw) => normalizeDirectionResult(raw, taskBrief, body.payload?.researchDossier),
      includePreviousResult: true,
    });
    return sendJson(response, 200, directions);
  }

  if (pathname === '/api/workflow/canon') {
    return sendJson(response, 200, await buildCanonResult(body));
  }

  if (pathname === '/api/workflow/canon-stream') {
    return streamResult(response, (send) => buildCanonResult(body, send));
  }

  if (pathname === '/api/workflow/canon-section') {
    return sendJson(response, 200, await buildCanonSectionResult(body));
  }

  if (pathname === '/api/workflow/canon-section-stream') {
    return streamResult(response, (send) => buildCanonSectionResult(body, send));
  }

  if (pathname === '/api/workflow/validate-canon') {
    const worldCanon = normalizeWorldCanon(body.worldCanon, body.seed, body.researchDossier, body.taskBrief);
    return sendJson(response, 200, { worldCanon });
  }

  if (pathname === '/api/workflow/validate-canon-section') {
    const section = String(body.section || '');
    const canonPart = normalizeCanonSection(body.canonPart, section, body.seed, body.taskBrief);
    const canonSections = { ...(body.canonSections || {}), [section]: canonPart };
    const worldCanon = section === 'C4' ? normalizeWorldCanon(mergeCanonSections(canonSections), body.seed, body.researchDossier, body.taskBrief) : null;
    return sendJson(response, 200, { canonPart, ...(worldCanon ? { worldCanon } : {}) });
  }

  if (pathname === '/api/generate') {
    return sendJson(response, 200, await generateStageResult(body));
  }

  if (pathname === '/api/generate-stream') {
    return streamResult(response, (send) => generateStageResult(body, send));
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
server.requestTimeout = 0;

const hasEnvProxy = Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY);
const supportsEnvProxy = Number(process.versions.node.split('.')[0]) >= 24;
const envProxyEnabled = process.execArgv.includes('--use-env-proxy') || process.env.NODE_USE_ENV_PROXY === '1';

if (hasEnvProxy && supportsEnvProxy && !envProxyEnabled) {
  console.log('检测到网络代理，正在通过代理模式重新启动服务。');
  const child = spawn(process.execPath, ['--use-env-proxy', fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    cwd: appDir,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  child.on('error', (error) => {
    console.error(`代理模式启动失败：${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code) => { process.exitCode = code ?? 0; });
} else {
  server.listen(port, host, () => {
    console.log(`铸界已启动：http://${host}:${port}`);
    console.log(`工作目录：${appDir}`);
  });
}
