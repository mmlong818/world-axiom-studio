export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function parseModelJson(raw) {
  const cleaned = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch { /* scan below */ }
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('模型没有返回 JSON 对象。');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(cleaned.slice(start, index + 1));
    }
  }
  throw new Error('模型返回的 JSON 不完整。');
}

const DOSSIER_FACT_GROUPS = ['world_rules', 'places', 'peoples', 'institutions', 'history', 'daily_life', 'important_things'];

function cleanStringList(value, limit) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function cleanReferenceList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object' && /^https:\/\//i.test(String(item.url ?? '')))
    .map((item) => ({
      title: String(item.title ?? '').trim().slice(0, 160),
      url: String(item.url).trim().slice(0, 1_000),
      provider: String(item.provider ?? '').trim().slice(0, 80),
      kind: String(item.kind ?? '').trim().slice(0, 80),
    }))
    .filter((item) => item.title && item.url)
    .slice(0, 12);
}

export function normalizeSourceDossier(value, fallbackMode = 'original') {
  const input = value && typeof value === 'object' ? value : {};
  const facts = input.confirmed_facts && typeof input.confirmed_facts === 'object' ? input.confirmed_facts : {};
  return {
    mode: ['original', 'reconstruct', 'source_expand'].includes(input.mode)
      ? input.mode
      : input.mode === 'create' ? 'original' : fallbackMode,
    source_summary: String(input.source_summary ?? '').trim().slice(0, 1_200),
    confirmed_facts: Object.fromEntries(DOSSIER_FACT_GROUPS.map((group) => [group, cleanStringList(facts[group], 80)])),
    contested: cleanStringList(input.contested, 40),
    unknowns: cleanStringList(input.unknowns, 40),
    references: cleanReferenceList(input.references),
  };
}

export function countSourceDossierFacts(dossier) {
  return DOSSIER_FACT_GROUPS.reduce((total, group) => total + (Array.isArray(dossier?.confirmed_facts?.[group]) ? dossier.confirmed_facts[group].length : 0), 0);
}

const WORLD_MODULE_REQUIREMENTS = {
  L1: { minimum: 650, headings: ['一眼看懂这个世界', '世界如何运转'] },
  L2: { minimum: 850, headings: ['地方与彼此关系', '历史为何形成今天'] },
  L3: { minimum: 650, headings: ['人们怎样生活'] },
  L4: { minimum: 450, headings: ['重要名称与查阅条目'] },
};

export function validateWorldModule(batch, markdown) {
  const requirement = WORLD_MODULE_REQUIREMENTS[batch];
  if (!requirement) return { ok: false, contentLength: 0, problems: ['未知的世界正文部分'] };
  const text = String(markdown ?? '').trim();
  const contentLength = text.replace(/[#>*_`|\-\s]/g, '').length;
  const headings = [...text.matchAll(/^#{1,4}\s+(.+)$/gm)].map((match) => match[1].trim());
  const problems = [];
  if (contentLength < requirement.minimum) problems.push(`正文只有 ${contentLength} 个有效字符，至少需要 ${requirement.minimum} 个`);
  for (const requiredHeading of requirement.headings) {
    if (!headings.some((heading) => heading.includes(requiredHeading))) problems.push(`缺少“${requiredHeading}”标题`);
  }
  return { ok: problems.length === 0, contentLength, problems };
}

function inlineMarkdown(value) {
  let output = escapeHtml(value);
  output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  output = output.replace(/〔residue:\s*true〕/g, '<span class="residue">〔残留物〕</span>');
  return output;
}

function isTableSeparator(line) {
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
}

function tableCells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => inlineMarkdown(cell.trim()));
}

export function renderMarkdown(markdown) {
  const textOnlyMarkdown = String(markdown ?? '')
    .replace(/```(?:mermaid|plantuml|graphviz)[\s\S]*?```/gi, '')
    .replace(/!\[([^\]]*)\]\([^\n)]+\)/g, '$1')
    .replace(/<\/?(?:img|svg|figure|figcaption|table|thead|tbody|tr|th|td)\b[^>]*>/gi, '');
  const lines = textOnlyMarkdown.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let listType = null;
  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/〔trace:\s*[^〕]+〕/g, '').trimEnd();
    if (!line.trim()) { closeList(); continue; }
    if (/^\s*<!--\s*trace:[\s\S]*-->\s*$/.test(line)) { closeList(); continue; }
    if (/^\s*(?:-{3,}|\*{3,})\s*$/.test(line)) { closeList(); html.push('<hr>'); continue; }

    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      closeList();
      const headers = tableCells(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        const cells = tableCells(lines[index]);
        rows.push(headers.map((header, cellIndex) => `<strong>${header}：</strong>${cells[cellIndex] || '—'}`).join('；'));
        index += 1;
      }
      if (rows.length) html.push('<ul>', ...rows.map((row) => `<li>${row}</li>`), '</ul>');
      index -= 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { closeList(); const level = Math.min(heading[1].length + 1, 4); html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); continue; }
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) { closeList(); html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`); continue; }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      if (listType !== 'ul') { closeList(); listType = 'ul'; html.push('<ul>'); }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      if (listType !== 'ol') { closeList(); listType = 'ol'; html.push('<ol>'); }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  closeList();
  return html.join('\n');
}

export function slugify(value) {
  const slug = String(value ?? 'world')
    .trim()
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'world';
}

export function downloadFile(name, content, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

export function cleanModelMarkdown(value) {
  return String(value ?? '').trim().replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/, '');
}

export function getAuditViolations(audit) {
  const hasStructuredLists = Array.isArray(audit?.canon_violations) || Array.isArray(audit?.prose_violations);
  if (hasStructuredLists) {
    return [...(Array.isArray(audit?.canon_violations) ? audit.canon_violations : []), ...(Array.isArray(audit?.prose_violations) ? audit.prose_violations : [])];
  }
  return Array.isArray(audit?.violations) ? audit.violations : [];
}

export function getBlockingAuditViolations(audit) {
  return getAuditViolations(audit).filter((item) => String(item?.severity || '').toLowerCase() === 'high');
}

export function getAdvisoryAuditViolations(audit) {
  return getAuditViolations(audit).filter((item) => String(item?.severity || '').toLowerCase() !== 'high');
}

export function getAuditBurden(audit) {
  return getBlockingAuditViolations(audit).length * 4;
}

export function hasAuditPassed(audit) {
  return getBlockingAuditViolations(audit).length === 0;
}
