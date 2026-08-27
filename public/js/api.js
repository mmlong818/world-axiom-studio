const REQUEST_RETRY_DELAYS_MS = [0, 600, 1_600];

function isTransientConnectionError(message) {
  return /fetch failed|无法连接模型端点|连接模型端点.+超时|模型连接在传输中断开|无法解析模型端点|无法连接本地服务/i.test(String(message));
}

function retryMessage(error, attempts) {
  if (/已自动(?:尝试|重试)/.test(error.message)) return error;
  return new Error(`${error.message}（已自动尝试 ${attempts} 次）`);
}

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < REQUEST_RETRY_DELAYS_MS.length; attempt += 1) {
    if (REQUEST_RETRY_DELAYS_MS[attempt]) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_RETRY_DELAYS_MS[attempt]));
    }
    let response;
    try {
      response = await fetch(path, {
        ...options,
        headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
      });
    } catch (error) {
      lastError = new Error(`无法连接本地服务：${error.message}`);
      if (attempt < REQUEST_RETRY_DELAYS_MS.length - 1) continue;
      throw retryMessage(lastError, attempt + 1);
    }
    const body = await response.json().catch(() => ({}));
    if (response.ok) return body;
    lastError = new Error(body.error || `请求失败（${response.status}）`);
    if (!isTransientConnectionError(lastError.message)) throw lastError;
    if (attempt === REQUEST_RETRY_DELAYS_MS.length - 1) throw retryMessage(lastError, attempt + 1);
  }
  throw retryMessage(lastError || new Error('请求没有完成。'), REQUEST_RETRY_DELAYS_MS.length);
}

async function requestStream(path, options, onEvent) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
    });
  } catch (error) {
    throw new Error(`无法连接本地服务：${error.message}`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `请求失败（${response.status}）`);
  }
  if (!response.body || !String(response.headers.get('content-type')).includes('application/x-ndjson')) {
    return response.json();
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let result;
  const consume = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === 'error') throw new Error(event.error || '生成没有完成。');
    if (event.type === 'result') result = event.data;
    else onEvent?.(event);
  };
  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || '';
    lines.forEach(consume);
    if (done) break;
  }
  if (pending.trim()) consume(pending);
  if (!result) throw new Error('流式生成结束，但没有收到最终结果。');
  return result;
}

export const api = {
  health: () => request('/api/health'),
  discoverModels: (config) => request('/api/models/discover', { method: 'POST', body: JSON.stringify({ config }) }),
  testModelConnection: (config) => request('/api/models/test', { method: 'POST', body: JSON.stringify({ config }) }),
  extractBook: (payload) => request('/api/extract', { method: 'POST', body: JSON.stringify(payload) }),
  understandTask: (payload, config) => request('/api/workflow/understand', { method: 'POST', body: JSON.stringify({ payload, config }) }),
  retrieveSources: (taskBrief, source, config) => request('/api/workflow/retrieve', { method: 'POST', body: JSON.stringify({ taskBrief, source, config }) }),
  analyzeResearch: (taskBrief, source, research, config) => request('/api/workflow/analyze', { method: 'POST', body: JSON.stringify({ taskBrief, source, research, config }) }),
  generateDirections: (payload, config) => request('/api/workflow/directions', { method: 'POST', body: JSON.stringify({ payload, config }) }),
  buildCanon: (payload, config, onEvent) => onEvent
    ? requestStream('/api/workflow/canon-stream', { method: 'POST', body: JSON.stringify({ payload, config }) }, onEvent)
    : request('/api/workflow/canon', { method: 'POST', body: JSON.stringify({ payload, config }) }),
  buildCanonSection: (payload, config, onEvent) => onEvent
    ? requestStream('/api/workflow/canon-section-stream', { method: 'POST', body: JSON.stringify({ payload, config }) }, onEvent)
    : request('/api/workflow/canon-section', { method: 'POST', body: JSON.stringify({ payload, config }) }),
  validateCanon: (worldCanon, seed, researchDossier, taskBrief) => request('/api/workflow/validate-canon', { method: 'POST', body: JSON.stringify({ worldCanon, seed, researchDossier, taskBrief }) }),
  validateCanonSection: (section, canonPart, canonSections, seed, researchDossier, taskBrief) => request('/api/workflow/validate-canon-section', { method: 'POST', body: JSON.stringify({ section, canonPart, canonSections, seed, researchDossier, taskBrief }) }),
  generate: (stage, payload, config, onEvent) => onEvent
    ? requestStream('/api/generate-stream', { method: 'POST', body: JSON.stringify({ stage, payload, config }) }, onEvent)
    : request('/api/generate', { method: 'POST', body: JSON.stringify({ stage, payload, config }) }),
};
