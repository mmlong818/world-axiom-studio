async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    });
  } catch (error) {
    throw new Error(`无法连接本地服务：${error.message}`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `请求失败（${response.status}）`);
  return body;
}

export const api = {
  health: () => request('/api/health'),
  extractBook: (payload) => request('/api/extract', { method: 'POST', body: JSON.stringify(payload) }),
  generate: (stage, payload, config) => request('/api/generate', { method: 'POST', body: JSON.stringify({ stage, payload, config }) }),
  generateImage: (prompt, config) => request('/api/image', { method: 'POST', body: JSON.stringify({ prompt, config }) }),
};
