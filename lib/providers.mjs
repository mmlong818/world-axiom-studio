const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_DOWNLOADED_IMAGE_BYTES = 20 * 1024 * 1024;

export const providerPresets = {
  openai: { label: 'OpenAI', protocol: 'openai', apiStyle: 'responses', tokenParameter: 'max_output_tokens', systemRole: 'developer', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.6-terra' },
  anthropic: { label: 'Anthropic Claude', protocol: 'anthropic', apiStyle: 'messages', tokenParameter: 'max_tokens', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5' },
  gemini: { label: 'Google Gemini', protocol: 'gemini', apiStyle: 'generateContent', tokenParameter: 'maxOutputTokens', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.7-flash' },
  deepseek: { label: 'DeepSeek', protocol: 'openai', apiStyle: 'chat', tokenParameter: 'max_tokens', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-pro' },
  zhipu: { label: '智谱 GLM', protocol: 'openai', apiStyle: 'chat', tokenParameter: 'max_tokens', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3' },
  kimi: { label: 'Kimi', protocol: 'openai', apiStyle: 'chat', tokenParameter: 'max_completion_tokens', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k3' },
  minimax: { label: 'MiniMax', protocol: 'openai', apiStyle: 'chat', tokenParameter: 'max_completion_tokens', baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M3' },
  qwen: { label: '通义千问', protocol: 'openai', apiStyle: 'chat', tokenParameter: 'max_tokens', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.7-max' },
  doubao: { label: '豆包', protocol: 'openai', apiStyle: 'responses', tokenParameter: 'max_output_tokens', systemRole: 'system', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-2-1-pro-260628' },
  xai: { label: 'xAI Grok', protocol: 'openai', apiStyle: 'responses', tokenParameter: 'max_output_tokens', systemRole: 'system', baseUrl: 'https://api.x.ai/v1', model: 'grok-4.5' },
  custom: { label: '自定义兼容端点', protocol: 'openai', apiStyle: 'chat', tokenParameter: 'auto', baseUrl: 'http://127.0.0.1:11434/v1', model: '' },
};

function cleanBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('模型端点不是有效网址。');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('模型端点只允许 http 或 https。');
  return url.toString().replace(/\/$/, '');
}

function endpoint(baseUrl, suffix) {
  const clean = cleanBaseUrl(baseUrl);
  return clean.endsWith(suffix) ? clean : `${clean}${suffix}`;
}

function normalizeApiKey(value) {
  return String(value ?? '').trim().replace(/^Bearer\s+/i, '').trim();
}

function validateApiKeyCharacters(apiKey) {
  if (apiKey && /[^\x21-\x7E]/.test(apiKey)) {
    throw new Error('API Key 格式不正确：不能包含中文、空格或换行。请只粘贴密钥本身，不要包含说明文字。');
  }
}

async function requestJson(url, init, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const signal = AbortSignal.timeout(timeoutMs);
  let response;
  try {
    response = await fetch(url, { ...init, signal });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('模型响应超时，请重试或换用更快的模型。');
    if (error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      throw new Error('连接模型端点超时。请确认代理或网络可用，或者切换到能够连接的模型服务。');
    }
    if (error.cause?.code === 'ECONNREFUSED') {
      throw new Error('模型端点拒绝连接。请检查端点地址和本地模型服务是否已经启动。');
    }
    throw new Error(`无法连接模型端点：${error.message}`);
  }

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const detail = body?.error?.message ?? body?.message ?? body?.raw ?? response.statusText;
    throw new Error(`模型调用失败（${response.status}）：${String(detail).slice(0, 500)}`);
  }
  return body;
}

function preferredOpenAITokenParameter(config) {
  if (config.tokenParameter && config.tokenParameter !== 'auto') return config.tokenParameter;
  const model = String(config.model ?? '').toLowerCase();
  let hostname = '';
  try {
    hostname = new URL(config.baseUrl).hostname.toLowerCase();
  } catch {
    // cleanBaseUrl 会在真正请求前给出统一的端点错误。
  }
  if (config.provider === 'openai' || hostname === 'api.openai.com' || /^(?:gpt-5|o[1-9](?:-|$))/.test(model)) {
    return 'max_completion_tokens';
  }
  return 'max_tokens';
}

function unsupportedTokenParameter(error, current, alternative) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('（400）')
    && message.includes(current)
    && message.includes(alternative)
    && (message.includes('unsupported') || message.includes('not supported') || message.includes('不支持'));
}

function unsupportedTemperature(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('（400）')
    && message.includes('temperature')
    && (message.includes('only the default') || message.includes('does not support') || message.includes('not supported') || message.includes('不支持'));
}

function requiresDefaultTemperature(config) {
  const model = String(config.model ?? '').toLowerCase();
  if (/^(?:gpt-5(?:[.-]|$)|o[1-9](?:-|$))/.test(model)) return true;
  if (/^claude-(?:opus|sonnet|fable|mythos)-(?:5(?:-|$)|4-[789](?:-|$))/.test(model)) return true;
  if (/^kimi-k(?:3|2\.[5-9])(?:-|$)/.test(model)) return true;
  return /^doubao-seed-2(?:-|$)/.test(model);
}

async function requestWithTemperatureFallback(request) {
  try {
    return await request(true);
  } catch (error) {
    if (!unsupportedTemperature(error)) throw error;
    return request(false);
  }
}

function getTextFromOpenAI(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((item) => item?.text ?? '').join('');
  if (typeof body?.output_text === 'string') return body.output_text;
  throw new Error('模型返回成功，但没有找到文本内容。');
}

function getTextFromResponses(body) {
  if (typeof body?.output_text === 'string' && body.output_text) return body.output_text;
  const text = body?.output
    ?.filter((item) => item?.type === 'message' || Array.isArray(item?.content))
    .flatMap((item) => item?.content ?? [])
    .filter((item) => item?.type === 'output_text' || typeof item?.text === 'string')
    .map((item) => item.text ?? '')
    .join('');
  if (text) return text;
  throw new Error('模型返回成功，但没有找到文本内容。');
}

function bearerHeaders(apiKey) {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  };
}

function safeRemoteImageUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('图片模型返回的网址无效。'); }
  if (url.protocol !== 'https:') throw new Error('图片模型返回的远程图片必须使用 HTTPS。');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    throw new Error('图片模型返回了不安全的本地网络地址。');
  }
  const private172 = host.match(/^172\.(\d+)\./)?.[1];
  if (private172 && Number(private172) >= 16 && Number(private172) <= 31) throw new Error('图片模型返回了不安全的本地网络地址。');
  return url.toString();
}

async function downloadRemoteImage(value) {
  const url = safeRemoteImageUrl(value);
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`无法下载图片模型返回的图片（${response.status}）。`);
  const contentType = String(response.headers.get('content-type') || '').split(';', 1)[0].toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType)) throw new Error('图片模型返回的网址不是受支持的图片格式。');
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > MAX_DOWNLOADED_IMAGE_BYTES) throw new Error('图片模型返回的图片超过 20 MB。');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_DOWNLOADED_IMAGE_BYTES) throw new Error('图片模型返回的图片为空或超过 20 MB。');
  return { dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`, sourceUrl: url };
}

async function callResponses(config, system, prompt) {
  const url = endpoint(config.baseUrl, '/responses');
  const temperature = Number.isFinite(config.temperature) ? config.temperature : 0.7;
  const includeInitialTemperature = !requiresDefaultTemperature(config);
  const body = await requestWithTemperatureFallback((includeTemperature) => {
    const requestBody = {
      model: config.model,
      input: [
        { role: config.systemRole || 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_output_tokens: config.maxTokens ?? 16_000,
    };
    if (includeInitialTemperature && includeTemperature) requestBody.temperature = temperature;
    return requestJson(url, {
      method: 'POST',
      headers: bearerHeaders(config.apiKey),
      body: JSON.stringify(requestBody),
    });
  });
  return getTextFromResponses(body);
}

async function callChatCompletions(config, system, prompt) {
  const url = endpoint(config.baseUrl, '/chat/completions');
  const maxTokens = config.maxTokens ?? 16_000;
  const temperature = Number.isFinite(config.temperature) ? config.temperature : 0.7;
  const request = async (tokenParameter, includeTemperature) => {
    const requestBody = {
      model: config.model,
      messages: [
        { role: config.systemRole || 'system', content: system },
        { role: 'user', content: prompt },
      ],
      [tokenParameter]: maxTokens,
    };
    if (includeTemperature) requestBody.temperature = temperature;
    return requestJson(url, {
      method: 'POST',
      headers: bearerHeaders(config.apiKey),
      body: JSON.stringify(requestBody),
    });
  };

  let tokenParameter = preferredOpenAITokenParameter(config);
  let includeTemperature = !requiresDefaultTemperature(config);
  let lastError;
  const attempted = new Set();
  while (attempted.size < 4) {
    const signature = `${tokenParameter}:${includeTemperature}`;
    if (attempted.has(signature)) throw lastError;
    attempted.add(signature);
    try {
      return getTextFromOpenAI(await request(tokenParameter, includeTemperature));
    } catch (error) {
      lastError = error;
      const alternative = tokenParameter === 'max_completion_tokens' ? 'max_tokens' : 'max_completion_tokens';
      if (unsupportedTokenParameter(error, tokenParameter, alternative)) {
        tokenParameter = alternative;
        continue;
      }
      if (includeTemperature && unsupportedTemperature(error)) {
        includeTemperature = false;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function callAnthropic(config, system, prompt) {
  const url = endpoint(config.baseUrl, '/messages');
  const temperature = Number.isFinite(config.temperature) ? config.temperature : 0.7;
  const includeInitialTemperature = !requiresDefaultTemperature(config);
  const body = await requestWithTemperatureFallback((includeTemperature) => {
    const requestBody = {
      model: config.model,
      system,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: config.maxTokens ?? 16_000,
    };
    if (includeInitialTemperature && includeTemperature) requestBody.temperature = temperature;
    return requestJson(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });
  });
  const content = body?.content?.map((item) => item?.text ?? '').join('');
  if (!content) throw new Error('Claude 返回成功，但没有找到文本内容。');
  return content;
}

async function callGemini(config, system, prompt) {
  const base = cleanBaseUrl(config.baseUrl);
  const model = encodeURIComponent(config.model);
  const url = `${base}/models/${model}:generateContent`;
  const temperature = Number.isFinite(config.temperature) ? config.temperature : 0.7;
  const body = await requestWithTemperatureFallback((includeTemperature) => {
    const generationConfig = { maxOutputTokens: config.maxTokens ?? 16_000 };
    if (includeTemperature) generationConfig.temperature = temperature;
    return requestJson(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      }),
    });
  });
  const content = body?.candidates?.[0]?.content?.parts?.map((item) => item?.text ?? '').join('');
  if (!content) throw new Error('Gemini 返回成功，但没有找到文本内容。');
  return content;
}

export async function callTextModel(input, system, prompt) {
  const preset = providerPresets[input.provider] ?? providerPresets.custom;
  const config = {
    ...preset,
    ...input,
    baseUrl: input.baseUrl || preset.baseUrl,
    model: input.model || preset.model,
    protocol: input.protocol || preset.protocol,
    temperature: Number(input.temperature ?? 0.7),
    apiKey: normalizeApiKey(input.apiKey),
  };
  if (!config.model) throw new Error('请填写模型 ID。');
  validateApiKeyCharacters(config.apiKey);
  if (!config.apiKey && !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/i.test(config.baseUrl)) {
    throw new Error('请填写 API Key；本地模型端点可以留空。');
  }

  if (config.protocol === 'anthropic') return callAnthropic(config, system, prompt);
  if (config.protocol === 'gemini') return callGemini(config, system, prompt);
  if (config.apiStyle === 'responses') return callResponses(config, system, prompt);
  return callChatCompletions(config, system, prompt);
}

export async function callImageModel(input, prompt) {
  const preset = providerPresets[input.provider] ?? providerPresets.openai;
  const baseUrl = input.baseUrl || preset.baseUrl;
  const apiKey = normalizeApiKey(input.apiKey);
  if (!input.model) throw new Error('请填写图片模型 ID。');
  if (!apiKey) throw new Error('请填写图片模型 API Key。');
  validateApiKeyCharacters(apiKey);
  const body = await requestJson(endpoint(baseUrl, '/images/generations'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      prompt,
      size: input.size || '1536x1024',
      n: 1,
    }),
  }, 300_000);
  const item = body?.data?.[0];
  if (item?.b64_json) return { dataUrl: `data:image/png;base64,${item.b64_json}` };
  if (item?.url) {
    try { return await downloadRemoteImage(item.url); }
    catch (error) { return { url: item.url, warning: `${error.message} 下载的离线 Wiki 将改用本地结构图。` }; }
  }
  throw new Error('图片模型返回成功，但没有找到图片。');
}
