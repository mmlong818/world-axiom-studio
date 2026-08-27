import { callTextModel, providerPresets } from './providers.mjs';
import { callClaudeCli, getClaudeCliStatus } from './claude-cli.mjs';

const DISCOVERY_TIMEOUT_MS = 45_000;

function cleanBaseUrl(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error('模型端点不是有效网址。'); }
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

function validateApiKey(apiKey, baseUrl) {
  if (apiKey && /[^\x21-\x7E]/.test(apiKey)) throw new Error('API Key 不能包含中文、空格或换行。请只粘贴密钥本身。');
  const local = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/i.test(baseUrl);
  if (!apiKey && !local) throw new Error('请先填写 API Key；本地模型端点可以留空。');
}

async function requestJson(url, headers) {
  let response;
  try { response = await fetch(url, { headers, signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS) }); }
  catch (error) { throw new Error(`无法读取模型列表：${error.message}`); }
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    const detail = body?.error?.message ?? body?.message ?? body?.raw ?? response.statusText;
    throw new Error(`模型列表请求失败（${response.status}）：${String(detail).slice(0, 500)}`);
  }
  return body;
}

function normalizeModel(item) {
  const id = String(item?.id || item?.name || '').replace(/^models\//, '').trim();
  const name = String(item?.displayName || item?.display_name || item?.name || id).replace(/^models\//, '').trim();
  const architecture = item?.architecture || {};
  return {
    id,
    name,
    description: String(item?.description || '').trim(),
    contextLength: Number(item?.context_length || item?.inputTokenLimit || item?.context_window || 0) || null,
    supportedParameters: Array.isArray(item?.supported_parameters) ? item.supported_parameters : [],
    inputModalities: architecture.input_modalities || [],
    outputModalities: architecture.output_modalities || [],
  };
}

function normalizeConfig(input) {
  const preset = providerPresets[input.provider] ?? providerPresets.custom;
  const transport = input.transport || preset.transport || 'api';
  if (transport === 'claude-cli') {
    return { ...preset, ...input, provider: 'claude-cli', transport, model: input.model || preset.model || 'sonnet' };
  }
  const baseUrl = cleanBaseUrl(input.baseUrl || preset.baseUrl);
  const apiKey = normalizeApiKey(input.apiKey);
  validateApiKey(apiKey, baseUrl);
  return {
    ...preset,
    ...input,
    transport,
    baseUrl,
    apiKey,
    model: String(input.model || preset.model || '').trim(),
    protocol: input.protocol || preset.protocol || 'openai',
    apiStyle: input.apiStyle || preset.apiStyle || 'chat',
    tokenParameter: input.tokenParameter || preset.tokenParameter || 'auto',
  };
}

function publicConfig(config) {
  const { apiKey: _apiKey, ...safe } = config;
  return safe;
}

export async function discoverModels(input = {}) {
  const config = normalizeConfig(input);
  if (config.transport === 'claude-cli') {
    const status = await getClaudeCliStatus();
    if (!status.loggedIn) throw new Error('Claude CLI 已安装但尚未登录。请先运行 claude auth login。');
    return { models: status.models, status, correctedConfig: publicConfig(config), source: 'claude-cli' };
  }

  let url;
  let headers;
  if (config.protocol === 'anthropic') {
    url = `${endpoint(config.baseUrl, '/models')}?limit=1000`;
    headers = { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' };
  } else if (config.protocol === 'gemini') {
    url = `${endpoint(config.baseUrl, '/models')}?pageSize=1000`;
    headers = { 'x-goog-api-key': config.apiKey };
  } else {
    url = endpoint(config.baseUrl, '/models');
    headers = config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {};
  }
  const body = await requestJson(url, headers);
  const sourceModels = Array.isArray(body.data) ? body.data : Array.isArray(body.models) ? body.models : [];
  const models = sourceModels.map(normalizeModel).filter((item) => item.id);
  if (!models.length) throw new Error('端点已连接，但没有返回可选择的模型。');
  return { models, correctedConfig: publicConfig(config), source: 'provider-api' };
}

export async function testModelConnection(input = {}) {
  const config = normalizeConfig(input);
  if (!config.model) throw new Error('请先从模型列表中选择一个模型。');
  if (config.transport === 'claude-cli') {
    const text = await callClaudeCli({ ...config, effort: 'low', timeoutMs: 90_000 }, '这是一次连接测试。', '只回复“连接成功”。');
    return {
      ok: true,
      message: `Claude CLI 已登录，${config.model} 可以正常返回结果。`,
      preview: text.slice(0, 80),
      correctedConfig: publicConfig(config),
      testedAt: new Date().toISOString(),
    };
  }
  const discovery = await discoverModels(config);
  if (!discovery.models.some((item) => item.id === config.model)) {
    throw new Error(`当前账号返回的模型列表中没有“${config.model}”。请重新选择。`);
  }
  let correctedConfig = {
    ...config,
    tokenParameter: config.provider === 'openrouter' || config.provider === 'custom' ? 'auto' : config.tokenParameter,
  };
  const styles = correctedConfig.protocol === 'openai' && correctedConfig.provider !== 'openrouter'
    ? [...new Set([correctedConfig.apiStyle, correctedConfig.apiStyle === 'responses' ? 'chat' : 'responses'])]
    : [correctedConfig.apiStyle];
  let text;
  let lastError;
  for (const apiStyle of styles) {
    try {
      text = await callTextModel({ ...correctedConfig, apiStyle, maxTokens: 256 }, '这是一次连接测试。', '只回复“连接成功”。');
      correctedConfig = { ...correctedConfig, apiStyle };
      break;
    } catch (error) {
      lastError = error;
      if (!/模型调用失败（(?:400|404|405|422)）/.test(String(error?.message || ''))) throw error;
    }
  }
  if (!text) throw lastError || new Error('模型连接测试没有返回文本。');
  return {
    ok: true,
    message: `${config.model} 已通过真实连接测试，配置已修正并可以保存启用。`,
    preview: text.slice(0, 80),
    correctedConfig: publicConfig(correctedConfig),
    testedAt: new Date().toISOString(),
  };
}
