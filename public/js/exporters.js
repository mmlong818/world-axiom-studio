import { downloadFile, escapeHtml, renderMarkdown, slugify } from './utils.js';
import { getLocale, t } from './i18n.js?v=6';

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
    <header><span>CONTENTS</span><h2>${t('世界之书目录')}</h2><p>${t('先理解整体，再逐步进入运转方式、地方、历史与生活；最后只保留必要条目供查阅。')}</p></header>
    <ol>${BOOK_SECTIONS.map(([number, label, , description]) => `<li><i>${number}</i><div><strong>${t(label)}</strong><span>${escapeHtml(t(description))}</span></div></li>`).join('')}</ol>
  </section>`;
}

function sourceLayerBand(seed) {
  const reconstructing = seed.construction_mode === 'reconstruct';
  const sourceBased = reconstructing || seed.construction_mode === 'source_expand';
  const layers = sourceBased
    ? ['原文／明确事实', '可追溯推断', '争议并列', '新增设计隔离', '未知保留']
    : ['概览', '运转', '地方', '历史', '生活', '名称'];
  const bandLabel = sourceBased ? '来源分层' : '成书路径';
  return `<section class="source-layer-band" aria-label="${t(bandLabel)}">
    <span>${t(bandLabel)}</span>
    <div>${layers.map((layer) => `<i>${t(layer)}</i>`).join('<b aria-hidden="true">→</b>')}</div>
  </section>`;
}

function sourceReferenceList(researchDossier) {
  const references = Array.isArray(researchDossier?.references) ? researchDossier.references : [];
  if (!references.length) return '';
  return `<section class="source-references" aria-label="${t('公开资料来源')}">
    <header><span>SOURCES</span><h2>${t('本次生成使用的公开资料')}</h2><p>${t('先复现原著的故事、人物、地方、风物与事件；只有资料不足时才在明确边界内扩展。')}</p></header>
    <ul>${references.map((reference) => {
      const href = /^https:\/\//i.test(reference.url || '') ? escapeHtml(reference.url) : '#';
      return `<li><a href="${href}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(reference.title)}</strong><span>${escapeHtml(reference.provider)} · ${escapeHtml(reference.kind)}</span></a></li>`;
    }).join('')}</ul>
  </section>`;
}

function sourceContinuityList(canon) {
  if (!canon?.sourcePlan?.primaryWork || !canon?.sourceContinuity?.length) return '';
  const treatment = { preserved: t('原著保留'), extended: t('原著延续'), fused: t('时空融合') };
  return `<section class="source-continuity-report" aria-label="${t('原著承接与扩展')}">
    <header><span>CONTINUITY</span><h2>${t('原著承接与扩展')}</h2><p><strong>${t('主世界：')}</strong>《${escapeHtml(canon.sourcePlan.primaryWork)}》${canon.sourcePlan.secondaryWorks?.length ? `　<strong>${t('次世界：')}</strong>${canon.sourcePlan.secondaryWorks.map((item) => `《${escapeHtml(item)}》`).join('、')}` : ''}</p><p><strong>${t('时空接入：')}</strong>${escapeHtml(canon.sourcePlan.timeSpaceCorrespondence || t('沿用原著时空'))}</p></header>
    <ol>${canon.sourceContinuity.map((item) => `<li><div><strong>${escapeHtml(item.originalName)}</strong><span>《${escapeHtml(item.source)}》 · ${escapeHtml(treatment[item.treatment] || item.treatment)}</span></div><p>${escapeHtml(item.explanation)}</p>${item.extensionReason ? `<small>${t('扩展理由：')}${escapeHtml(item.extensionReason)}</small>` : ''}</li>`).join('')}</ol>
  </section>`;
}

function wikiBody(data) {
  const seed = data.seed;
  const body = renderMarkdown(data.world);
  return `<article class="wiki-document">
    <header class="wiki-cover">
      <p class="eyebrow">WORLD BOOK · ${escapeHtml(seed.model_type || t('世界介绍'))}</p>
      <h1>${escapeHtml(seed.name)}</h1>
      <p>${escapeHtml(seed.one_line)}</p>
    </header>
    <section class="wiki-intro">
      <div><span>${t('世界命题')}</span><strong>${escapeHtml(seed.world_thesis || seed.one_line)}</strong></div>
      <div><span>${t('历史范围')}</span><strong>${escapeHtml(seed.historical_depth || t('尚无定论'))} · ${escapeHtml(seed.scale || t('范围未定'))}</strong></div>
      <div><span>${t('证据状态')}</span><strong>${seed.construction_mode === 'reconstruct' ? t('原著还原') : seed.construction_mode === 'source_expand' ? t('原著优先 · 缺口扩展') : t('原创模型')}</strong></div>
    </section>
    ${worldBookToc()}
    ${sourceLayerBand(seed)}
    ${sourceContinuityList(data.worldCanon)}
    ${sourceReferenceList(data.researchDossier)}
    <div class="wiki-prose prose">${body}</div>
    ${data.audit ? `<footer class="audit-stamp"><span>${t('一致性审计')}</span><strong>${escapeHtml(data.audit.score)} / 100</strong><small>${escapeHtml(data.audit.status)}</small></footer>` : ''}
  </article>`;
}

export function buildWikiPreview(data) { return wikiBody(data); }
export function buildSimplePreview(data) { return `<article class="prose simple-document">${renderMarkdown(data.summary)}</article>`; }

export function buildStandaloneWiki(data) {
  const title = escapeHtml(data.seed.name);
  return `<!doctype html><html lang="${getLocale()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title} · ${t('世界之书 Wiki')}</title><style>
  :root{--paper:#f4efe5;--surface:#fffdf8;--ink:#20241f;--soft:#5e625a;--line:#d6cebe;--green:#174f46;--rust:#b85432}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.72 "Segoe UI","Microsoft YaHei",sans-serif}.wiki-document{max-width:980px;margin:0 auto;padding:34px 46px 80px;background:var(--surface)}.wiki-cover{position:relative;min-height:360px;margin:-34px -46px 36px;padding:72px 58px;overflow:hidden;background:#20241f;color:#fffaf0}.wiki-cover:after{content:"";position:absolute;right:-100px;bottom:-140px;width:420px;height:420px;border:1px solid #ffffff40;border-radius:50%;box-shadow:0 0 0 54px #ffffff0b,0 0 0 108px #ffffff0b}.eyebrow{color:#d6a84f;font-size:11px;font-weight:700;letter-spacing:.12em}.wiki-cover h1{position:relative;z-index:1;margin:60px 0 14px;font:400 clamp(62px,11vw,116px)/.9 "Songti SC","STSong",serif;letter-spacing:-.04em}.wiki-cover p{position:relative;z-index:1;max-width:56ch;color:#ffffffb8;font:24px/1.55 "Songti SC","STSong",serif}.wiki-intro{display:grid;grid-template-columns:1.4fr .8fr .8fr;border-block:1px solid var(--line);margin:28px 0}.wiki-intro div{padding:18px;border-right:1px solid var(--line)}.wiki-intro div:last-child{border:0}.wiki-intro span{display:block;margin-bottom:6px;color:var(--rust);font-size:11px;letter-spacing:.06em}.wiki-intro strong{font:400 16px/1.6 "Songti SC","STSong",serif}.wiki-toc{display:grid;grid-template-columns:.8fr 1.2fr;gap:34px;margin:42px 0;padding:30px;border:1px solid var(--line);background:#f7f2e8}.wiki-toc header>span{color:var(--rust);font-size:10px;font-weight:700;letter-spacing:.18em}.wiki-toc h2{margin:12px 0 10px;font:400 30px/1.05 "Songti SC","STSong",serif}.wiki-toc header p{margin:0;color:var(--soft);font-size:12px}.wiki-toc ol{display:grid;grid-template-columns:1fr 1fr;margin:0;padding:0;list-style:none;border-top:1px solid var(--line)}.wiki-toc li{display:grid;grid-template-columns:34px 1fr;gap:8px;padding:12px 8px;border-bottom:1px solid var(--line)}.wiki-toc li:nth-child(odd){border-right:1px solid var(--line)}.wiki-toc i{color:var(--rust);font:700 10px/1.6 "Segoe UI",sans-serif;letter-spacing:.08em}.wiki-toc strong,.wiki-toc span{display:block}.wiki-toc strong{font:400 15px/1.3 "Songti SC","STSong",serif}.wiki-toc li span{margin-top:4px;color:var(--soft);font-size:10px;line-height:1.45}.source-layer-band{margin:28px 0;padding:14px 16px;border-left:3px solid var(--green);background:#174f460a}.source-layer-band>span{display:block;margin-bottom:8px;color:var(--green);font-size:10px;font-weight:700;letter-spacing:.12em}.source-layer-band div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.source-layer-band i{font-style:normal;font-size:11px}.source-layer-band b{color:#9b9e96;font-weight:400}.source-references{margin:30px 0;padding:22px;border:1px solid var(--line);background:#fff}.source-references header>span{color:var(--rust);font-size:10px;font-weight:700;letter-spacing:.16em}.source-references h2{margin:8px 0 7px;font:400 24px/1.2 "Songti SC","STSong",serif}.source-references header p{margin:0;color:var(--soft);font-size:12px}.source-references ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:18px 0 0;padding:0;list-style:none}.source-references a{display:block;min-height:72px;padding:12px;border:1px solid var(--line);color:var(--ink);text-decoration:none}.source-references strong,.source-references li span{display:block}.source-references strong{font:400 15px/1.4 "Songti SC","STSong",serif}.source-references li span{margin-top:5px;color:var(--soft);font-size:10px}.prose{max-width:76ch;margin:0 auto}.prose h2,.prose h3,.prose h4{font-family:"Songti SC","STSong",serif;font-weight:400;letter-spacing:-.02em}.prose h2{margin:54px 0 16px;padding-bottom:10px;border-bottom:1px solid var(--line);font-size:34px}.prose h3{margin:32px 0 10px;font-size:24px}.prose p,.prose li{max-width:72ch}.prose hr{margin:46px 0 10px;border:0;border-top:1px solid var(--line)}.trace{display:inline;color:#73786f;font-size:.78em}.residue{color:var(--rust);font-size:.78em}.audit-stamp{display:grid;grid-template-columns:1fr auto;gap:4px;margin:70px 0 0;padding:20px;border:1px solid var(--green);color:var(--green)}.audit-stamp strong{grid-row:span 2;font:400 32px/1 "Songti SC","STSong",serif}.audit-stamp small{color:var(--soft)}@media(max-width:700px){.wiki-document{padding:18px}.wiki-cover{margin:-18px -18px 24px;padding:45px 24px}.wiki-cover h1{margin-top:50px}.wiki-intro,.wiki-toc{grid-template-columns:1fr}.wiki-intro div{border-right:0;border-bottom:1px solid var(--line)}.wiki-toc{padding:20px}.wiki-toc ol,.source-references ul{grid-template-columns:1fr}.wiki-toc li:nth-child(odd){border-right:0}.source-layer-band b{display:none}}@media print{body{background:white}.wiki-document{max-width:none;padding:0}.wiki-cover{margin:0}}
  .source-continuity-report{margin:30px 0;padding:24px;border-left:3px solid var(--green);background:#174f460a}.source-continuity-report header>span{color:var(--green);font-size:10px;font-weight:700;letter-spacing:.16em}.source-continuity-report h2{margin:8px 0 10px;font:400 26px/1.2 "Songti SC","STSong",serif}.source-continuity-report header p{margin:5px 0;color:var(--soft);font-size:12px}.source-continuity-report ol{margin:20px 0 0;padding:0;list-style:none;border-top:1px solid #174f4630}.source-continuity-report li{display:grid;grid-template-columns:minmax(160px,.6fr) minmax(0,1.4fr);gap:5px 18px;padding:13px 0;border-bottom:1px solid #174f4626}.source-continuity-report li div{display:grid}.source-continuity-report li span,.source-continuity-report li small{color:var(--soft);font-size:10px}.source-continuity-report li p{margin:0;color:var(--soft);font-size:13px}.source-continuity-report li small{grid-column:2;color:var(--rust)}@media(max-width:700px){.source-continuity-report li{grid-template-columns:1fr}.source-continuity-report li small{grid-column:1}}
  </style></head><body>${wikiBody(data)}</body></html>`;
}

export function exportData(state) {
  return {
    schema_version: 'world-axiom-studio/0.3',
    generated_at: new Date().toISOString(),
    output_locale: getLocale(),
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
  };
}

export function downloadDeliverable(kind, state) {
  const base = slugify(state.selectedSeed?.name || t('世界观'));
  const data = { seed: state.selectedSeed, world: state.world, audit: state.audit, summary: state.summary, taskBrief: state.taskBrief, researchDossier: state.researchDossier, worldCanon: state.worldCanon };
  if (kind === 'wiki') downloadFile(`${base}-${slugify(t('世界之书'))}-wiki.html`, buildStandaloneWiki(data), 'text/html;charset=utf-8');
  else if (kind === 'simple') downloadFile(`${base}-${slugify(t('世界概览'))}.md`, state.summary, 'text/markdown;charset=utf-8');
  else if (kind === 'json') downloadFile(`${base}-${slugify(t('结构数据'))}.json`, JSON.stringify(exportData(state), null, 2), 'application/json;charset=utf-8');
}
