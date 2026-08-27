import { downloadFile, escapeHtml, renderMarkdown, safeImageSource, slugify } from './utils.js';

function utf8Base64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function svgData(svg) { return `data:image/svg+xml;base64,${utf8Base64(svg)}`; }

function xml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hash(value) {
  return [...String(value ?? '')].reduce((total, char) => (total * 31 + char.codePointAt(0)) >>> 0, 2166136261);
}

function anchorName(value, fallback) {
  const name = String(value ?? '').split(/[：:—–，,（(]/, 1)[0].trim();
  return name || fallback;
}

function sigilVisual(seed) {
  const rotation = hash(seed.name) % 90;
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
  <rect width="1200" height="720" fill="#20241f"/>
  <g transform="translate(840 360) rotate(${rotation})" fill="none" stroke="#d7c19a">
    <circle r="248" opacity=".32"/><circle r="188" stroke-dasharray="4 16" opacity=".7"/><circle r="118" stroke="#b85432" stroke-width="3"/>
    <path d="M-260 0h520M0-260v520" opacity=".28"/><path d="m-82-82 164 164M82-82-82 82" opacity=".45"/>
    <circle r="24" fill="#174f46" stroke="#f2eee5" stroke-width="2"/>
  </g>
  <text x="76" y="100" fill="#d6a84f" font-family="Segoe UI, sans-serif" font-size="18" letter-spacing="6">WORLD GUIDE</text>
  <text x="76" y="235" fill="#fffaf0" font-family="Songti SC, STSong, serif" font-size="104">${xml(seed.name)}</text>
  <foreignObject x="80" y="285" width="550" height="210"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#c8c7be;font:28px/1.55 'Songti SC','STSong',serif;">${xml(seed.one_line)}</div></foreignObject>
  <text x="80" y="640" fill="#8d9289" font-family="Segoe UI, sans-serif" font-size="16" letter-spacing="2">${xml(seed.model_type)} · ${xml(seed.historical_depth)} · ${xml(seed.scale)}</text>
  </svg>`);
}

function mapVisual(seed) {
  const names = (seed.world_anchors?.places || []).slice(0, 5).map((item, index) => anchorName(item, `地域 ${index + 1}`));
  while (names.length < 5) names.push(['西部边地', '河谷市镇', '南方渡口', '北部高地', '东部远境'][names.length]);
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="720" viewBox="0 0 1000 720">
  <rect width="1000" height="720" fill="#e9e4d8"/>
  <path d="M96 528C220 420 180 214 360 150s278 40 352 178 96 208 196 250" fill="none" stroke="#174f46" stroke-width="9" opacity=".16"/>
  <path d="M120 520 310 370 480 455 650 245 855 405" fill="none" stroke="#555b52" stroke-width="2" stroke-dasharray="8 12"/>
  <g fill="#fbf9f4" stroke="#174f46" stroke-width="3">
    <circle cx="120" cy="520" r="24"/><circle cx="310" cy="370" r="34"/><circle cx="480" cy="455" r="23"/><circle cx="650" cy="245" r="38"/><circle cx="855" cy="405" r="28"/>
  </g>
  <g fill="#20241f" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="21">
    <text x="72" y="570">${xml(names[0])}</text><text x="258" y="426">${xml(names[1])}</text><text x="438" y="510">${xml(names[2])}</text><text x="598" y="188">${xml(names[3])}</text><text x="810" y="462">${xml(names[4])}</text>
  </g>
  <text x="60" y="78" fill="#b85432" font-family="Segoe UI, sans-serif" font-size="16" letter-spacing="5">TRAVEL ATLAS · ${xml(seed.name)}</text>
  <text x="60" y="112" fill="#555b52" font-family="Songti SC, STSong, serif" font-size="24">主要地域与通行路线示意</text>
  </svg>`);
}

function relationVisual(seed) {
  const labels = [
    anchorName(seed.world_anchors?.peoples?.[0], '主要居民'),
    anchorName(seed.world_anchors?.institutions?.[0], '主要组织'),
    anchorName(seed.world_anchors?.flora_fauna_goods_customs?.[0], '重要事物'),
  ];
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="720" viewBox="0 0 900 720">
  <rect width="900" height="720" fill="#f7f2e8"/>
  <text x="55" y="72" fill="#b85432" font-family="Segoe UI, sans-serif" font-size="16" letter-spacing="5">WORLD RELATIONS</text>
  <g transform="translate(450 385)" fill="none" stroke-width="2">
    <path d="M0-245 212 122H-212Z" stroke="#bdb4a3"/>
    <path d="M0-148 128 74H-128Z" stroke="#174f46" stroke-dasharray="7 9"/>
    <circle r="54" fill="#20241f" stroke="#20241f"/>
    <path d="M0-54V-245M47 27l165 95M-47 27l-165 95" stroke="#b85432"/>
  </g>
  <g fill="#20241f" font-family="Songti SC, STSong, serif" font-size="30" text-anchor="middle">
    <text x="450" y="105">${labels[0]}</text><text x="710" y="570">${labels[1]}</text><text x="190" y="570">${labels[2]}</text>
  </g>
  <text x="450" y="392" fill="#fffaf0" font-family="Songti SC, STSong, serif" font-size="25" text-anchor="middle">${xml(seed.name)}</text>
  <text x="450" y="675" fill="#747a70" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="17" text-anchor="middle">居民、组织与重要事物之间的主要联系</text>
  </svg>`);
}

export function getVisuals(seed, art = [], options = {}) {
  const generated = art
    .map((item) => safeImageSource(item?.dataUrl || (!options.offlineOnly ? item?.url : '')))
    .filter(Boolean);
  return [generated[0] || sigilVisual(seed), generated[1] || mapVisual(seed), generated[2] || relationVisual(seed)];
}

const BOOK_SECTIONS = [
  ['01', '一眼看懂', 'constitution', '世界前提、整体面貌与最关键差异'],
  ['02', '如何运转', 'operation', '关键规律以及它们造成的日常后果'],
  ['03', '地方与关系', 'atlas', '主要地方及交通、资源与权力联系'],
  ['04', '历史为何如此', 'chronicle', '改变当下的转折及仍可见的后果'],
  ['05', '人们怎样生活', 'civilizations', '社会、生计与普通人的一天'],
  ['06', '重要名称', 'catalog', '理解世界不可缺少的少量条目与索引'],
];

function worldBookToc() {
  return `<section class="wiki-toc" aria-label="世界之书目录">
    <header><span>CONTENTS</span><h2>世界之书目录</h2><p>先理解整体，再逐步进入运转方式、地方、历史与生活；最后只保留必要条目供查阅。</p></header>
    <ol>${BOOK_SECTIONS.map(([number, label, , description]) => `<li><i>${number}</i><div><strong>${label}</strong><span>${escapeHtml(description)}</span></div></li>`).join('')}</ol>
  </section>`;
}

function sourceLayerBand(seed) {
  const reconstructing = seed.construction_mode === 'reconstruct';
  const sourceBased = reconstructing || seed.construction_mode === 'source_expand';
  const layers = sourceBased
    ? ['原文／明确事实', '可追溯推断', '争议并列', '新增设计隔离', '未知保留']
    : ['概览', '运转', '地方', '历史', '生活', '名称'];
  return `<section class="source-layer-band" aria-label="${sourceBased ? '来源分层' : '成书路径'}">
    <span>${sourceBased ? '来源分层' : '成书路径'}</span>
    <div>${layers.map((layer) => `<i>${layer}</i>`).join('<b aria-hidden="true">→</b>')}</div>
  </section>`;
}

function sourceReferenceList(researchDossier) {
  const references = Array.isArray(researchDossier?.references) ? researchDossier.references : [];
  if (!references.length) return '';
  return `<section class="source-references" aria-label="公开资料来源">
    <header><span>SOURCES</span><h2>本次生成使用的公开资料</h2><p>先复现原著的故事、人物、地方、风物与事件；只有资料不足时才在明确边界内扩展。</p></header>
    <ul>${references.map((reference) => {
      const href = /^https:\/\//i.test(reference.url || '') ? escapeHtml(reference.url) : '#';
      return `<li><a href="${href}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(reference.title)}</strong><span>${escapeHtml(reference.provider)} · ${escapeHtml(reference.kind)}</span></a></li>`;
    }).join('')}</ul>
  </section>`;
}

function sourceContinuityList(canon) {
  if (!canon?.sourcePlan?.primaryWork || !canon?.sourceContinuity?.length) return '';
  const treatment = { preserved: '原著保留', extended: '原著延续', fused: '时空融合' };
  return `<section class="source-continuity-report" aria-label="原著承接与扩展">
    <header><span>CONTINUITY</span><h2>原著承接与扩展</h2><p><strong>主世界：</strong>《${escapeHtml(canon.sourcePlan.primaryWork)}》${canon.sourcePlan.secondaryWorks?.length ? `　<strong>次世界：</strong>${canon.sourcePlan.secondaryWorks.map((item) => `《${escapeHtml(item)}》`).join('、')}` : ''}</p><p><strong>时空接入：</strong>${escapeHtml(canon.sourcePlan.timeSpaceCorrespondence || '沿用原著时空')}</p></header>
    <ol>${canon.sourceContinuity.map((item) => `<li><div><strong>${escapeHtml(item.originalName)}</strong><span>《${escapeHtml(item.source)}》 · ${escapeHtml(treatment[item.treatment] || item.treatment)}</span></div><p>${escapeHtml(item.explanation)}</p>${item.extensionReason ? `<small>扩展理由：${escapeHtml(item.extensionReason)}</small>` : ''}</li>`).join('')}</ol>
  </section>`;
}

function inlineVisual(source, alt, caption) {
  return `<figure class="wiki-visual wiki-inline-visual"><img src="${source}" alt="${escapeHtml(alt)}" width="1000" height="720" loading="lazy"><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
}

function insertAfterSectionHeading(html, heading, addition) {
  const marker = `<h2>${escapeHtml(heading)}</h2>`;
  return html.includes(marker) ? html.replace(marker, `${marker}${addition}`) : `${html}${addition}`;
}

export function interleaveWikiVisuals(html, visuals) {
  const map = inlineVisual(visuals[1], '世界主要地域、聚落与道路关系示意', '地方关系 · 主要地域、聚落与通行路线');
  const relations = inlineVisual(visuals[2], '居民、组织与重要事物之间的关系图', '世界关系 · 居民、组织与重要事物如何联系');
  const withMap = insertAfterSectionHeading(html, '地方与彼此关系', map);
  return insertAfterSectionHeading(withMap, '人们怎样生活', relations);
}

function wikiBody(data, forExport = false) {
  const seed = data.seed;
  const visuals = getVisuals(seed, data.art, { offlineOnly: forExport });
  const body = interleaveWikiVisuals(renderMarkdown(data.world), visuals);
  return `<article class="wiki-document">
    <header class="wiki-cover">
      <p class="eyebrow">WORLD BOOK · ${escapeHtml(seed.model_type || '世界介绍')}</p>
      <h1>${escapeHtml(seed.name)}</h1>
      <p>${escapeHtml(seed.one_line)}</p>
    </header>
    <figure class="hero-visual"><img src="${visuals[0]}" alt="${escapeHtml(seed.name)} 的世界徽记与结构摘要" width="1200" height="720"></figure>
    <section class="wiki-intro">
      <div><span>世界命题</span><strong>${escapeHtml(seed.world_thesis || seed.one_line)}</strong></div>
      <div><span>历史范围</span><strong>${escapeHtml(seed.historical_depth || '尚无定论')} · ${escapeHtml(seed.scale || '范围未定')}</strong></div>
      <div><span>证据状态</span><strong>${seed.construction_mode === 'reconstruct' ? '原著还原' : seed.construction_mode === 'source_expand' ? '原著优先 · 缺口扩展' : '原创模型'}</strong></div>
    </section>
    ${worldBookToc()}
    ${sourceLayerBand(seed)}
    ${sourceContinuityList(data.worldCanon)}
    ${sourceReferenceList(data.researchDossier)}
    <div class="wiki-prose prose">${body}</div>
    ${data.audit ? `<footer class="audit-stamp"><span>一致性审计</span><strong>${escapeHtml(data.audit.score)} / 100</strong><small>${escapeHtml(data.audit.status)}</small></footer>` : ''}
  </article>${forExport ? '' : '<p class="preview-note">预览已包含可离线保存的结构图。下载后不依赖本应用。</p>'}`;
}

export function buildWikiPreview(data) { return wikiBody(data, false); }
export function buildSimplePreview(data) { return `<article class="prose simple-document">${renderMarkdown(data.summary)}</article>`; }

export function buildStandaloneWiki(data) {
  const title = escapeHtml(data.seed.name);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title} · 世界之书 Wiki</title><style>
  :root{--paper:#f4efe5;--surface:#fffdf8;--ink:#20241f;--soft:#5e625a;--line:#d6cebe;--green:#174f46;--rust:#b85432}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.72 "Segoe UI","Microsoft YaHei",sans-serif}img{display:block;max-width:100%}.wiki-document{max-width:980px;margin:0 auto;padding:34px 46px 80px;background:var(--surface)}.wiki-cover{position:relative;min-height:360px;margin:-34px -46px 36px;padding:72px 58px;overflow:hidden;background:#20241f;color:#fffaf0}.wiki-cover:after{content:"";position:absolute;right:-100px;bottom:-140px;width:420px;height:420px;border:1px solid #ffffff40;border-radius:50%;box-shadow:0 0 0 54px #ffffff0b,0 0 0 108px #ffffff0b}.eyebrow{color:#d6a84f;font-size:11px;font-weight:700;letter-spacing:.12em}.wiki-cover h1{position:relative;z-index:1;margin:60px 0 14px;font:400 clamp(62px,11vw,116px)/.9 "Songti SC","STSong",serif;letter-spacing:-.04em}.wiki-cover p{position:relative;z-index:1;max-width:56ch;color:#ffffffb8;font:24px/1.55 "Songti SC","STSong",serif}.hero-visual{margin:0 0 30px}.hero-visual img{width:100%;border:1px solid var(--line)}.wiki-intro{display:grid;grid-template-columns:1.4fr .8fr .8fr;border-block:1px solid var(--line);margin:28px 0}.wiki-intro div{padding:18px;border-right:1px solid var(--line)}.wiki-intro div:last-child{border:0}.wiki-intro span{display:block;margin-bottom:6px;color:var(--rust);font-size:11px;letter-spacing:.06em}.wiki-intro strong{font:400 16px/1.6 "Songti SC","STSong",serif}.wiki-toc{display:grid;grid-template-columns:.8fr 1.2fr;gap:34px;margin:42px 0;padding:30px;border:1px solid var(--line);background:#f7f2e8}.wiki-toc header>span{color:var(--rust);font-size:10px;font-weight:700;letter-spacing:.18em}.wiki-toc h2{margin:12px 0 10px;font:400 30px/1.05 "Songti SC","STSong",serif}.wiki-toc header p{margin:0;color:var(--soft);font-size:12px}.wiki-toc ol{display:grid;grid-template-columns:1fr 1fr;margin:0;padding:0;list-style:none;border-top:1px solid var(--line)}.wiki-toc li{display:grid;grid-template-columns:34px 1fr;gap:8px;padding:12px 8px;border-bottom:1px solid var(--line)}.wiki-toc li:nth-child(odd){border-right:1px solid var(--line)}.wiki-toc i{color:var(--rust);font:700 10px/1.6 "Segoe UI",sans-serif;letter-spacing:.08em}.wiki-toc strong,.wiki-toc span{display:block}.wiki-toc strong{font:400 15px/1.3 "Songti SC","STSong",serif}.wiki-toc li span{margin-top:4px;color:var(--soft);font-size:10px;line-height:1.45}.source-layer-band{margin:28px 0;padding:14px 16px;border-left:3px solid var(--green);background:#174f460a}.source-layer-band>span{display:block;margin-bottom:8px;color:var(--green);font-size:10px;font-weight:700;letter-spacing:.12em}.source-layer-band div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.source-layer-band i{font-style:normal;font-size:11px}.source-layer-band b{color:#9b9e96;font-weight:400}.source-references{margin:30px 0;padding:22px;border:1px solid var(--line);background:#fff}.source-references header>span{color:var(--rust);font-size:10px;font-weight:700;letter-spacing:.16em}.source-references h2{margin:8px 0 7px;font:400 24px/1.2 "Songti SC","STSong",serif}.source-references header p{margin:0;color:var(--soft);font-size:12px}.source-references ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:18px 0 0;padding:0;list-style:none}.source-references a{display:block;min-height:72px;padding:12px;border:1px solid var(--line);color:var(--ink);text-decoration:none}.source-references strong,.source-references li span{display:block}.source-references strong{font:400 15px/1.4 "Songti SC","STSong",serif}.source-references li span{margin-top:5px;color:var(--soft);font-size:10px}.wiki-visual{border:1px solid var(--line);background:#e9e4d8}.wiki-inline-visual{margin:22px 0 34px}.wiki-visual img{width:100%;height:auto;aspect-ratio:16/10;object-fit:cover}.wiki-visual figcaption{padding:8px 10px;color:var(--soft);font-size:11px}.prose{max-width:76ch;margin:0 auto}.prose h2,.prose h3,.prose h4{font-family:"Songti SC","STSong",serif;font-weight:400;letter-spacing:-.02em}.prose h2{margin:54px 0 16px;padding-bottom:10px;border-bottom:1px solid var(--line);font-size:34px}.prose h3{margin:32px 0 10px;font-size:24px}.prose p,.prose li{max-width:72ch}.prose hr{margin:46px 0 10px;border:0;border-top:1px solid var(--line)}.trace{display:inline;color:#73786f;font-size:.78em}.residue{color:var(--rust);font-size:.78em}.prose table{width:100%;border-collapse:collapse;font-size:13px}.prose th,.prose td{padding:9px;border:1px solid var(--line);text-align:left;vertical-align:top}.prose th{background:#ebe5d9}.table-wrap{overflow:auto}.audit-stamp{display:grid;grid-template-columns:1fr auto;gap:4px;margin:70px 0 0;padding:20px;border:1px solid var(--green);color:var(--green)}.audit-stamp strong{grid-row:span 2;font:400 32px/1 "Songti SC","STSong",serif}.audit-stamp small{color:var(--soft)}@media(max-width:700px){.wiki-document{padding:18px}.wiki-cover{margin:-18px -18px 24px;padding:45px 24px}.wiki-cover h1{margin-top:50px}.wiki-intro,.wiki-toc{grid-template-columns:1fr}.wiki-intro div{border-right:0;border-bottom:1px solid var(--line)}.wiki-toc{padding:20px}.wiki-toc ol,.source-references ul{grid-template-columns:1fr}.wiki-toc li:nth-child(odd){border-right:0}.source-layer-band b{display:none}}@media print{body{background:white}.wiki-document{max-width:none;padding:0}.wiki-cover{margin:0}}
  .source-continuity-report{margin:30px 0;padding:24px;border-left:3px solid var(--green);background:#174f460a}.source-continuity-report header>span{color:var(--green);font-size:10px;font-weight:700;letter-spacing:.16em}.source-continuity-report h2{margin:8px 0 10px;font:400 26px/1.2 "Songti SC","STSong",serif}.source-continuity-report header p{margin:5px 0;color:var(--soft);font-size:12px}.source-continuity-report ol{margin:20px 0 0;padding:0;list-style:none;border-top:1px solid #174f4630}.source-continuity-report li{display:grid;grid-template-columns:minmax(160px,.6fr) minmax(0,1.4fr);gap:5px 18px;padding:13px 0;border-bottom:1px solid #174f4626}.source-continuity-report li div{display:grid}.source-continuity-report li span,.source-continuity-report li small{color:var(--soft);font-size:10px}.source-continuity-report li p{margin:0;color:var(--soft);font-size:13px}.source-continuity-report li small{grid-column:2;color:var(--rust)}@media(max-width:700px){.source-continuity-report li{grid-template-columns:1fr}.source-continuity-report li small{grid-column:1}}
  </style></head><body>${wikiBody(data, true)}</body></html>`;
}

export function exportData(state) {
  return {
    schema_version: 'world-axiom-studio/0.3',
    generated_at: new Date().toISOString(),
    source: { mode: state.source.mode, brief: state.source.brief, book_name: state.source.book?.name ?? null, ip_tier: state.source.ipTier },
    purpose: state.purpose,
    construction_mode: state.selectedSeed?.construction_mode || state.buildIntent,
    skin: state.skin,
    task_brief: state.taskBrief,
    research_dossier: state.researchDossier,
    seed: state.selectedSeed,
    world_canon: state.worldCanon,
    modules: state.modules,
    audit: state.audit,
    simplified_markdown: state.summary,
    image_prompts: buildImagePrompts(state.selectedSeed),
  };
}

export function buildImagePrompts(seed) {
  const places = (seed.world_anchors?.places || []).slice(0, 3).join('；');
  const peoples = (seed.world_anchors?.peoples || []).slice(0, 2).join('；');
  const wind = (seed.world_anchors?.flora_fauna_goods_customs || []).slice(0, 3).join('；');
  const shared = `为世界“${seed.name}”绘制可直接收入世界之书的横向图版。世界概述：${seed.overview || seed.world_thesis || seed.one_line}。代表地点：${places || '依据世界概述表现'}。主要居民：${peoples || '依据世界概述表现'}。代表风物：${wind || '依据世界概述表现'}。画面必须具体表现地貌、天气、建筑材料、居民活动与可辨认物件；避免文字、标识、水印、紫色和泛用奇幻符号。采用克制的编辑插画质感、暖纸色、深墨绿与锈红。`;
  return [
    `${shared}\n作为世界封面，同时呈现最有辨识度的地貌、气候、聚落和普通居民。`,
    `${shared}\n作为地方关系全景，以道路、水系、物产与聚落之间的实际联系组织画面，不画无意义的大城拼贴。`,
    `${shared}\n作为重要名称图版，选择一种确实影响世界运转的地点、生物、组织或器物，表现其外观、使用场景和与当地生活的关系。`,
  ];
}

export function downloadDeliverable(kind, state) {
  const base = slugify(state.selectedSeed?.name || '世界观');
  const data = { seed: state.selectedSeed, world: state.world, audit: state.audit, summary: state.summary, art: state.art, taskBrief: state.taskBrief, researchDossier: state.researchDossier, worldCanon: state.worldCanon };
  if (kind === 'wiki') downloadFile(`${base}-世界之书-wiki.html`, buildStandaloneWiki(data), 'text/html;charset=utf-8');
  else if (kind === 'simple') downloadFile(`${base}-世界概览.md`, state.summary, 'text/markdown;charset=utf-8');
  else if (kind === 'json') downloadFile(`${base}-结构数据.json`, JSON.stringify(exportData(state), null, 2), 'application/json;charset=utf-8');
}
