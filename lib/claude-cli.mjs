import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_TIMEOUT_MS = 15 * 60_000;

const claudeCliAliases = [
  { id: 'default', name: '默认（账号推荐）', description: '由 Claude Code 根据当前账号和组织策略选择；本机当前显示为 Opus 5。' },
  { id: 'best', name: 'Best', description: '始终使用当前账号可用的最强模型。' },
  { id: 'sonnet', name: 'Sonnet 5', description: '日常世界构建的质量与速度平衡档。' },
  { id: 'opus', name: 'Opus 5', description: '复杂世界、长链推理和高质量写作。' },
  { id: 'fable', name: 'Fable 5', description: '最复杂的叙事、创意写作和长时间任务。' },
  { id: 'haiku', name: 'Haiku 4.5', description: '快速、轻量的整理与改写。' },
  { id: 'opus[1m]', name: 'Opus 5 · 1M 上下文', description: '本机模型选择器提供的百万上下文 Opus；Enterprise 订阅已包含。' },
  { id: 'sonnet[1m]', name: 'Sonnet · 1M 上下文', description: '百万上下文 Sonnet；订阅账号可能需要额外使用额度。' },
  { id: 'opusplan', name: 'Opus Plan', description: '规划时使用 Opus，执行时切换 Sonnet。' },
];

function configuredClaudeModels() {
  const configured = [
    ['ANTHROPIC_MODEL', '本机默认模型'],
    ['ANTHROPIC_DEFAULT_OPUS_MODEL', '本机 Opus 映射'],
    ['ANTHROPIC_DEFAULT_SONNET_MODEL', '本机 Sonnet 映射'],
    ['ANTHROPIC_DEFAULT_HAIKU_MODEL', '本机 Haiku 映射'],
    ['ANTHROPIC_CUSTOM_MODEL_OPTION', '本机自定义模型'],
  ];
  return configured.flatMap(([key, name]) => {
    const id = String(process.env[key] || '').trim();
    return id ? [{ id, name, description: `来自环境变量 ${key}。` }] : [];
  });
}

export function getClaudeCliModels() {
  const models = [...claudeCliAliases, ...configuredClaudeModels()];
  return models.filter((item, index) => models.findIndex((candidate) => candidate.id === item.id) === index);
}

function resolveClaudeExecutable() {
  const configured = String(process.env.CLAUDE_CLI_PATH || '').trim();
  if (configured && fs.existsSync(configured)) return configured;
  const directories = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const relativeCandidates = process.platform === 'win32'
    ? ['claude.exe', path.join('node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')]
    : ['claude'];
  for (const directory of directories) {
    for (const candidate of relativeCandidates) {
      const resolved = path.join(directory.replace(/^"|"$/g, ''), candidate);
      if (fs.existsSync(resolved)) return resolved;
    }
  }
  throw new Error('没有找到 Claude CLI。请先安装 Claude Code，并在终端完成 claude auth login。');
}

function validateModel(value) {
  const model = String(value || 'sonnet').trim();
  if (!/^[a-zA-Z0-9._:/\[\]-]{1,160}$/.test(model)) throw new Error('Claude CLI 模型名称格式不正确。');
  return model;
}

function runClaude(args, { input = '', timeoutMs = DEFAULT_TIMEOUT_MS, onStdout } = {}) {
  const executable = resolveClaudeExecutable();
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: os.tmpdir(),
      env: process.env,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      const minutes = Math.max(1, Math.round(timeoutMs / 60_000));
      finish(reject, new Error(`Claude CLI 在 ${minutes} 分钟内没有返回。当前内容已保留，可以继续本节点或换用更快的模型。`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout.push(chunk);
      onStdout?.(chunk.toString('utf8'));
    });
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => finish(reject, new Error(`无法启动 Claude CLI：${error.message}`)));
    child.on('close', (code) => {
      const output = Buffer.concat(stdout).toString('utf8').trim();
      const errorOutput = Buffer.concat(stderr).toString('utf8').trim();
      if (code !== 0) return finish(reject, new Error(`Claude CLI 调用失败：${(errorOutput || output || `退出码 ${code}`).slice(0, 800)}`));
      finish(resolve, output);
    });
    child.stdin.end(input, 'utf8');
  });
}

export function buildClaudeCliArgs(input, instruction, { stream = false } = {}) {
  const model = validateModel(input.model);
  const effort = ['low', 'medium', 'high', 'xhigh', 'max'].includes(input.effort) ? input.effort : 'medium';
  return [
    '-p',
    '--output-format', stream ? 'stream-json' : 'json',
    ...(stream ? ['--include-partial-messages', '--verbose'] : []),
    '--model', model,
    '--effort', effort,
    '--system-prompt', instruction,
    '--safe-mode',
    '--disable-slash-commands',
    '--prompt-suggestions', 'false',
    '--no-session-persistence',
    '--permission-mode', 'dontAsk',
    '--tools', '',
    '--no-chrome',
  ];
}

export async function getClaudeCliStatus() {
  const version = await runClaude(['--version'], { timeoutMs: 15_000 });
  const raw = await runClaude(['auth', 'status', '--json'], { timeoutMs: 15_000 });
  let status;
  try { status = JSON.parse(raw); }
  catch { throw new Error('Claude CLI 已安装，但无法读取登录状态。请运行 claude auth login。'); }
  return {
    installed: true,
    loggedIn: Boolean(status.loggedIn),
    authMethod: status.authMethod || '',
    apiProvider: status.apiProvider || '',
    subscriptionType: status.subscriptionType || '',
    organization: status.orgName || '',
    version: version.replace(/\s*\(Claude Code\)\s*/i, '').trim(),
    models: getClaudeCliModels(),
  };
}

function streamClaudeText(onTextDelta) {
  let pending = '';
  let finalText = '';
  return {
    consume(chunk) {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let message;
        try { message = JSON.parse(line); } catch { continue; }
        const delta = message?.type === 'stream_event'
          && message?.event?.type === 'content_block_delta'
          && message?.event?.delta?.type === 'text_delta'
          ? message.event.delta.text : '';
        if (delta) onTextDelta?.(delta);
        if (message?.type === 'result' && typeof message.result === 'string') finalText = message.result;
      }
    },
    result(raw) {
      if (finalText) return finalText;
      for (const line of `${pending}\n${raw}`.split(/\r?\n/).reverse()) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          if (message?.type === 'result' && typeof message.result === 'string') return message.result;
        } catch {
          // 单次 JSON 输出或非 JSON 文本交给原有解析逻辑处理。
        }
      }
      return '';
    },
  };
}

export async function callClaudeCli(input, system, prompt, { onTextDelta } = {}) {
  validateModel(input.model);
  const status = await getClaudeCliStatus();
  if (!status.loggedIn) throw new Error('Claude CLI 尚未登录。请先在终端运行 claude auth login。');
  const instruction = [
    '你正在为一个本地世界观工具提供文本结果。',
    '把标准输入中的“系统要求”视为最高优先级，把“用户任务”视为本次任务。',
    '不要调用工具，不要修改文件，只输出任务要求的最终文本。',
  ].join('');
  const inputText = `系统要求：\n${system}\n\n用户任务：\n${prompt}`;
  const streaming = typeof onTextDelta === 'function';
  const stream = streaming ? streamClaudeText(onTextDelta) : null;
  const raw = await runClaude(buildClaudeCliArgs(input, instruction, { stream: streaming }), {
    input: inputText,
    timeoutMs: Number(input.timeoutMs) || DEFAULT_TIMEOUT_MS,
    onStdout: stream ? (chunk) => stream.consume(chunk) : undefined,
  });
  if (streaming) {
    const text = stream.result(raw);
    if (!text) throw new Error('Claude CLI 返回成功，但没有找到文本内容。');
    return text;
  }
  let result;
  try { result = JSON.parse(raw); }
  catch { return raw; }
  const text = result?.result ?? result?.content ?? result?.text;
  if (!text || typeof text !== 'string') throw new Error('Claude CLI 返回成功，但没有找到文本内容。');
  return text;
}
