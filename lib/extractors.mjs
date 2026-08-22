import path from 'node:path';
import AdmZip from 'adm-zip';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 2_000_000;
const MAX_SAMPLE_CHARS = 100_000;

const decodeEntities = (value) => value
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));

export function normalizeText(value) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n[ ]+/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function xmlToText(xml) {
  const withBreaks = xml
    .replace(/<\/?(?:p|div|h[1-6]|li|br|tr|section|chapter|w:p|w:br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return normalizeText(decodeEntities(withBreaks));
}

function safeZipEntries(buffer) {
  const zip = new AdmZip(buffer);
  return zip.getEntries().filter((entry) => !entry.isDirectory && !entry.entryName.includes('..'));
}

function extractDocx(buffer) {
  const entries = safeZipEntries(buffer);
  const document = entries.find((entry) => entry.entryName === 'word/document.xml');
  if (!document) throw new Error('这个 DOCX 中没有找到正文。');
  return xmlToText(document.getData().toString('utf8'));
}

function parseManifest(opf) {
  const manifest = new Map();
  for (const match of opf.matchAll(/<item\b[^>]*\bid=["']([^"']+)["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    manifest.set(match[1], match[2]);
  }
  const spine = [...opf.matchAll(/<itemref\b[^>]*\bidref=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  return { manifest, spine };
}

function extractEpub(buffer) {
  const entries = safeZipEntries(buffer);
  const byName = new Map(entries.map((entry) => [entry.entryName.replace(/\\/g, '/'), entry]));
  const container = byName.get('META-INF/container.xml')?.getData().toString('utf8') ?? '';
  const rootPath = container.match(/full-path=["']([^"']+)["']/i)?.[1];
  const opfEntry = rootPath ? byName.get(rootPath) : entries.find((entry) => entry.entryName.toLowerCase().endsWith('.opf'));

  let orderedEntries = [];
  if (opfEntry) {
    const opf = opfEntry.getData().toString('utf8');
    const { manifest, spine } = parseManifest(opf);
    const opfDir = path.posix.dirname(opfEntry.entryName.replace(/\\/g, '/'));
    orderedEntries = spine
      .map((id) => manifest.get(id))
      .filter(Boolean)
      .map((href) => path.posix.normalize(path.posix.join(opfDir, decodeURIComponent(href))))
      .map((name) => byName.get(name))
      .filter(Boolean);
  }

  if (!orderedEntries.length) {
    orderedEntries = entries
      .filter((entry) => /\.(?:xhtml|html|htm)$/i.test(entry.entryName))
      .sort((a, b) => a.entryName.localeCompare(b.entryName, 'zh-CN'));
  }

  if (!orderedEntries.length) throw new Error('这个 EPUB 中没有找到可读取的章节。');
  return normalizeText(orderedEntries.map((entry) => xmlToText(entry.getData().toString('utf8'))).join('\n\n'));
}

async function extractPdf(buffer) {
  // 直接载入库实现，避开 pdf-parse 入口文件在 ESM 动态导入时误触发的调试分支。
  const module = await import('pdf-parse/lib/pdf-parse.js');
  const parsePdf = module.default ?? module;
  const result = await parsePdf(buffer);
  const text = normalizeText(result.text ?? '');
  if (!text) throw new Error('这个 PDF 没有可提取文字，可能是扫描版。请先做 OCR，或改传 TXT/EPUB。');
  return text;
}

function extractPlain(buffer, extension) {
  const decoded = buffer.toString('utf8');
  if (extension === '.html' || extension === '.htm' || extension === '.xml') return xmlToText(decoded);
  return normalizeText(decoded);
}

function ruleBearingLines(text) {
  const patterns = [
    /(?:从那天起|在这个世界|任何人|凡是|所有人|只有|除非|一旦|不得|必须|不可能|代价是|意味着|规则|禁忌|法律|条例)/,
    /(?:always|never|must|cannot|unless|law|rule|forbidden|cost)/i,
  ];
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 18 && line.length <= 500 && patterns.some((pattern) => pattern.test(line)))
    .slice(0, 80)
    .join('\n');
}

export function sampleBookText(text) {
  const clean = normalizeText(text).slice(0, MAX_EXTRACTED_CHARS);
  if (clean.length <= MAX_SAMPLE_CHARS) return clean;

  const beginning = clean.slice(0, 22_000);
  const ending = clean.slice(-12_000);
  const rules = ruleBearingLines(clean).slice(0, 10_000);
  const excerptCount = 8;
  const excerptLength = 6_000;
  const distributed = Array.from({ length: excerptCount }, (_, index) => {
    const ratio = (index + 1) / (excerptCount + 1);
    const center = Math.floor(clean.length * ratio);
    const start = Math.max(0, Math.min(clean.length - excerptLength, center - Math.floor(excerptLength / 2)));
    return `【全书分布采样 ${index + 1}/${excerptCount} · 约 ${Math.round(ratio * 100)}%】\n${clean.slice(start, start + excerptLength)}`;
  });
  return [
    '【开篇与目录附近】', beginning,
    ...distributed,
    '【结尾采样】', ending,
    '【规则说明性段落命中】', rules,
  ].join('\n\n').slice(0, MAX_SAMPLE_CHARS);
}

export async function extractBook({ name, dataBase64 }) {
  if (!name || typeof name !== 'string') throw new Error('缺少文件名。');
  if (!dataBase64 || typeof dataBase64 !== 'string') throw new Error('没有收到文件内容。');
  const buffer = Buffer.from(dataBase64, 'base64');
  if (!buffer.length) throw new Error('文件是空的。');
  if (buffer.length > MAX_FILE_BYTES) throw new Error('文件超过 25 MB，请压缩或转成 TXT/EPUB 后重试。');

  const extension = path.extname(name).toLowerCase();
  let text;
  if (extension === '.pdf') text = await extractPdf(buffer);
  else if (extension === '.epub') text = extractEpub(buffer);
  else if (extension === '.docx') text = extractDocx(buffer);
  else if (['.txt', '.md', '.markdown', '.html', '.htm', '.xml', '.json'].includes(extension)) text = extractPlain(buffer, extension);
  else throw new Error('暂不支持这个格式。可上传 PDF、EPUB、DOCX、TXT、Markdown 或 HTML。');

  const capped = text.slice(0, MAX_EXTRACTED_CHARS);
  return {
    name,
    extension,
    characters: capped.length,
    truncated: text.length > MAX_EXTRACTED_CHARS,
    sample: sampleBookText(capped),
  };
}

export const extractionLimits = { MAX_FILE_BYTES, MAX_EXTRACTED_CHARS, MAX_SAMPLE_CHARS };
