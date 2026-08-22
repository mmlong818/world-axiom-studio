import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(appDir, 'server.mjs');
const nodeMajor = Number(process.versions.node.split('.')[0]);
const hasProxy = Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY);
const supportsEnvProxy = nodeMajor >= 24;
const args = [...(hasProxy && supportsEnvProxy ? ['--use-env-proxy'] : []), serverPath];

if (hasProxy && !supportsEnvProxy) {
  console.warn('检测到系统代理，但当前 Node.js 版本不能自动接管代理；建议升级到 Node.js 24 或更高版本。');
}

const child = spawn(process.execPath, args, {
  cwd: appDir,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (error) => {
  console.error(`服务启动失败：${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
