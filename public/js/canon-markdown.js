const text = (value) => String(value ?? '').trim();
const array = (value) => Array.isArray(value) ? value : [];
const snake = (item, snakeKey, camelKey) => item?.[snakeKey] ?? item?.[camelKey];

const treatmentLabels = {
  preserved: '原著保留',
  extended: '原著延续',
  fused: '时空融合',
};

function pushLabel(lines, label, value) {
  const content = Array.isArray(value) ? value.filter(Boolean).join('；') : text(value);
  if (content) lines.push(`- **${label}**：${content}`);
}

function parseDocument(markdown) {
  const document = { title: '', intro: [], sections: new Map() };
  let active = document.intro;
  for (const line of String(markdown || '').replace(/\r\n?/g, '\n').split('\n')) {
    const mainTitle = line.match(/^#\s+(.+)$/);
    const sectionTitle = line.match(/^##\s+(.+)$/);
    if (mainTitle) document.title = mainTitle[1].trim();
    else if (sectionTitle) {
      active = [];
      document.sections.set(sectionTitle[1].trim(), active);
    } else active.push(line);
  }
  return document;
}

function parseItems(lines = []) {
  const items = [];
  let active = null;
  for (const line of lines) {
    const heading = line.match(/^###\s+(.+)$/);
    if (heading) {
      active = { title: heading[1].trim(), lines: [] };
      items.push(active);
    } else if (active) active.lines.push(line);
  }
  return items;
}

function labelValue(lines, label) {
  const pattern = new RegExp(`^-\\s+\\*\\*${label}\\*\\*[：:]\\s*(.*)$`);
  return text(lines.map((line) => line.match(pattern)?.[1]).find(Boolean));
}

function listValue(lines, label) {
  const value = labelValue(lines, label);
  return value ? value.split(/[；\n]+/).map((item) => item.trim()).filter(Boolean) : [];
}

function bodyValue(lines) {
  return lines.filter((line) => !/^-\s+\*\*.+?\*\*[：:]/.test(line)).join('\n').trim();
}

function sectionText(document, title) {
  return (document.sections.get(title) || []).join('\n').trim();
}

function originalFor(items, index, title, keys) {
  return items.find((item) => keys.some((key) => text(item?.[key]) === title)) || items[index] || {};
}

function itemId(original, prefix, index) {
  return text(original?.id) || `${prefix}-${index + 1}`;
}

function c1Markdown(part) {
  const plan = part.source_plan || part.sourcePlan || {};
  const lines = [`# ${part.identity?.name || '未命名世界'}`, '', snake(part.identity, 'one_line', 'oneLine'), '', '## 世界最根本的事实', '', part.identity?.thesis || ''];
  if (snake(plan, 'primary_work', 'primaryWork') || array(snake(plan, 'secondary_works', 'secondaryWorks')).length || snake(plan, 'time_space_correspondence', 'timeSpaceCorrespondence') || plan.precedence) {
    lines.push('', '## 原著与世界边界', '');
    const primary = snake(plan, 'primary_work', 'primaryWork');
    if (primary) pushLabel(lines, '主世界', `《${primary}》`);
    const secondary = array(snake(plan, 'secondary_works', 'secondaryWorks'));
    if (secondary.length) pushLabel(lines, '次世界', secondary.map((item) => `《${item}》`).join('、'));
    pushLabel(lines, '时空接入', snake(plan, 'time_space_correspondence', 'timeSpaceCorrespondence'));
    pushLabel(lines, '主次原则', plan.precedence);
  }
  return lines.join('\n').trim();
}

function c2Markdown(part) {
  const spatial = part.spatial_order || part.spatialOrder || {};
  const lines = ['# 核心规律与地方关系', '', '## 核心规律'];
  array(part.axioms).forEach((item) => {
    lines.push('', `### ${item.statement || '未命名规律'}`, '');
    pushLabel(lines, '普通人能看到', item.consequences);
    pushLabel(lines, '边界与代价', item.limits);
  });
  lines.push('', '## 地方与空间', '', spatial.overview || '');
  array(spatial.regions).forEach((item) => {
    lines.push('', `### ${item.name || '未命名地点'}`, '', item.definition || '');
    pushLabel(lines, '类型', item.type);
    pushLabel(lines, '为什么重要', item.importance);
    pushLabel(lines, '与其他地方的关系', item.relations);
  });
  return lines.join('\n').trim();
}

function c3Markdown(part) {
  const lines = ['# 历史、居民与制度', '', '## 形成今天的历史'];
  array(part.history).forEach((item) => {
    lines.push('', `### ${item.era || '历史转折'}`, '', item.event || '');
    pushLabel(lines, '原因', item.causes);
    pushLabel(lines, '后果', item.consequences);
    pushLabel(lines, '今天仍可看到', snake(item, 'present_traces', 'presentTraces'));
  });
  for (const [title, items] of [['居民与社会', part.societies], ['组织与制度', part.institutions]]) {
    lines.push('', `## ${title}`);
    array(items).forEach((item) => {
      lines.push('', `### ${item.name || '未命名条目'}`, '', item.definition || '');
      pushLabel(lines, '类型', item.type);
      pushLabel(lines, '为什么重要', item.importance);
      pushLabel(lines, '关系', item.relations);
    });
  }
  return lines.join('\n').trim();
}

function c4Markdown(part, materialName) {
  const lines = ['# 日常生活与关键条目', '', '## 日常生活'];
  array(part.daily_life || part.dailyLife).forEach((item) => {
    lines.push('', `### ${item.topic || '生活事实'}`, '', item.fact || '');
    pushLabel(lines, '依赖', snake(item, 'depends_on', 'dependsOn'));
  });
  lines.push('', '## 重要名称');
  array(part.entities).forEach((item) => {
    lines.push('', `### ${item.name || '未命名条目'}`, '', item.definition || '');
    pushLabel(lines, '类型', item.type);
    pushLabel(lines, '为什么重要', item.importance);
    pushLabel(lines, '关系', item.relations);
  });
  const continuity = array(part.source_continuity || part.sourceContinuity);
  if (continuity.length) lines.push('', '## 原著材料如何进入正典');
  continuity.forEach((item) => {
    const researchId = snake(item, 'research_id', 'researchId');
    lines.push('', `### ${materialName(researchId) || item.originalName || researchId || '研究材料'}`, '', item.explanation || '');
    pushLabel(lines, '处理方式', item.treatment);
    pushLabel(lines, '对应时空', snake(item, 'time_space_correspondence', 'timeSpaceCorrespondence'));
    pushLabel(lines, '扩展理由', snake(item, 'extension_reason', 'extensionReason'));
  });
  if (part.tensions?.length) lines.push('', '## 仍在推动世界的矛盾', '', ...part.tensions.map((item) => `- ${item}`));
  if (part.unknowns?.length) lines.push('', '## 尚无定论', '', ...part.unknowns.map((item) => `- ${item}`));
  if (snake(part, 'evidence_policy', 'evidencePolicy')) lines.push('', '## 依据规则', '', snake(part, 'evidence_policy', 'evidencePolicy'));
  return lines.join('\n').trim();
}

export function canonPartAsMarkdown(batch, part, materialName = () => '') {
  if (batch === 'C1') return c1Markdown(part);
  if (batch === 'C2') return c2Markdown(part);
  if (batch === 'C3') return c3Markdown(part);
  if (batch === 'C4') return c4Markdown(part, materialName);
  return '';
}

export function canonPreviewMarkdown(markdown, parts = {}) {
  const references = new Map();
  const register = (items, label) => array(items).forEach((item) => {
    if (item?.id && text(label(item))) references.set(item.id, text(label(item)));
  });
  register(parts.C2?.axioms, (item) => item.statement);
  register(parts.C2?.spatial_order?.regions || parts.C2?.spatialOrder?.regions, (item) => item.name);
  register(parts.C3?.history, (item) => item.era || item.event);
  register(parts.C3?.societies, (item) => item.name);
  register(parts.C3?.institutions, (item) => item.name);
  register(parts.C4?.daily_life || parts.C4?.dailyLife, (item) => item.topic);
  register(parts.C4?.entities, (item) => item.name);

  return String(markdown || '')
    .replace(/\b(?:axiom|region|history|society|institution|life|entity)-\d+\b/g, (id) => references.get(id) || '已确认条目')
    .replace(/\b(preserved|extended|fused)\b/g, (_, treatment) => treatmentLabels[treatment])
    .replace(/\bsource_continuity\b/g, '原著承接说明')
    .replace(/\bcanon_refs\b/g, '对应条目')
    .replace(/\btreatment\b/g, '处理方式');
}

function parseC1(document, original) {
  const sourceLines = document.sections.get('原著与世界边界') || [];
  const books = (labelValue(sourceLines, '次世界').match(/《([^》]+)》/g) || []).map((item) => item.slice(1, -1));
  return {
    identity: { name: document.title, one_line: text(document.intro.join('\n')), thesis: sectionText(document, '世界最根本的事实') },
    source_plan: {
      ...(original.source_plan || original.sourcePlan || {}),
      primary_work: labelValue(sourceLines, '主世界').replace(/^《|》$/g, ''), secondary_works: books,
      time_space_correspondence: labelValue(sourceLines, '时空接入'), precedence: labelValue(sourceLines, '主次原则'),
    },
  };
}

function parseC2(document, original) {
  const oldAxioms = array(original.axioms);
  const axioms = parseItems(document.sections.get('核心规律')).map((block, index) => {
    const old = originalFor(oldAxioms, index, block.title, ['statement']);
    return { ...old, id: itemId(old, 'axiom', index), statement: block.title, consequences: listValue(block.lines, '普通人能看到'), limits: listValue(block.lines, '边界与代价') };
  });
  const oldSpatial = original.spatial_order || original.spatialOrder || {};
  const spatialLines = document.sections.get('地方与空间') || [];
  const oldRegions = array(oldSpatial.regions);
  const regions = parseItems(spatialLines).map((block, index) => {
    const old = originalFor(oldRegions, index, block.title, ['name']);
    return { ...old, id: itemId(old, 'region', index), name: block.title, definition: bodyValue(block.lines), type: labelValue(block.lines, '类型'), importance: labelValue(block.lines, '为什么重要'), relations: listValue(block.lines, '与其他地方的关系') };
  });
  const firstRegion = spatialLines.findIndex((line) => /^###\s+/.test(line));
  const overview = spatialLines.slice(0, firstRegion < 0 ? spatialLines.length : firstRegion).join('\n').trim();
  return { axioms, spatial_order: { ...oldSpatial, overview, regions } };
}

function parseNamedItems(lines, originals, prefix) {
  return parseItems(lines).map((block, index) => {
    const old = originalFor(originals, index, block.title, ['name']);
    return { ...old, id: itemId(old, prefix, index), name: block.title, definition: bodyValue(block.lines), type: labelValue(block.lines, '类型'), importance: labelValue(block.lines, '为什么重要'), relations: listValue(block.lines, '关系') };
  });
}

function parseC3(document, original) {
  const oldHistory = array(original.history);
  const history = parseItems(document.sections.get('形成今天的历史')).map((block, index) => {
    const old = originalFor(oldHistory, index, block.title, ['era']);
    return { ...old, id: itemId(old, 'history', index), era: block.title, event: bodyValue(block.lines), causes: listValue(block.lines, '原因'), consequences: listValue(block.lines, '后果'), present_traces: listValue(block.lines, '今天仍可看到') };
  });
  return {
    history,
    societies: parseNamedItems(document.sections.get('居民与社会'), array(original.societies), 'society'),
    institutions: parseNamedItems(document.sections.get('组织与制度'), array(original.institutions), 'institution'),
  };
}

function bulletSection(document, title) {
  return (document.sections.get(title) || []).map((line) => line.match(/^-\s+(.+)$/)?.[1]).filter(Boolean);
}

function parseC4(document, original, materialName) {
  const oldDaily = array(original.daily_life || original.dailyLife);
  const dailyLife = parseItems(document.sections.get('日常生活')).map((block, index) => {
    const old = originalFor(oldDaily, index, block.title, ['topic']);
    return { ...old, id: itemId(old, 'life', index), topic: block.title, fact: bodyValue(block.lines), depends_on: listValue(block.lines, '依赖') };
  });
  const entities = parseNamedItems(document.sections.get('重要名称'), array(original.entities), 'entity');
  const oldContinuity = array(original.source_continuity || original.sourceContinuity);
  const sourceContinuity = parseItems(document.sections.get('原著材料如何进入正典')).map((block, index) => {
    const old = oldContinuity.find((item) => materialName(snake(item, 'research_id', 'researchId')) === block.title) || oldContinuity[index] || {};
    return { ...old, research_id: snake(old, 'research_id', 'researchId'), canon_refs: array(snake(old, 'canon_refs', 'canonRefs')), treatment: labelValue(block.lines, '处理方式') || old.treatment, time_space_correspondence: labelValue(block.lines, '对应时空'), explanation: bodyValue(block.lines), extension_reason: labelValue(block.lines, '扩展理由') };
  });
  return {
    daily_life: dailyLife, entities, source_continuity: sourceContinuity, extensions: array(original.extensions),
    tensions: bulletSection(document, '仍在推动世界的矛盾'), unknowns: bulletSection(document, '尚无定论'),
    evidence_policy: sectionText(document, '依据规则'),
  };
}

export function canonPartFromMarkdown(batch, markdown, originalPart = {}, materialName = () => '') {
  const document = parseDocument(markdown);
  if (batch === 'C1') return parseC1(document, originalPart);
  if (batch === 'C2') return parseC2(document, originalPart);
  if (batch === 'C3') return parseC3(document, originalPart);
  if (batch === 'C4') return parseC4(document, originalPart, materialName);
  throw new Error('未知的世界基础步骤。');
}
