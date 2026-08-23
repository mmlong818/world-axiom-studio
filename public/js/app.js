import { api } from './api.js';
import { buildImagePrompts, buildSimplePreview, buildWikiPreview, downloadDeliverable } from './exporters.js?v=15';
import { cleanModelMarkdown, countSourceDossierFacts, escapeHtml, fileToBase64, getAuditBurden, getAuditViolations, hasAuditPassed, normalizeSourceDossier, parseModelJson, renderMarkdown, validateWorldModule } from './utils.js?v=5';
import { addWorldTask, archiveWorld, createBlankWorld, deleteArchivedWorld, getWorld, initializeWorldStore, listWorlds, putWorld, restoreWorld } from './world-store.js?v=9';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const MODEL_SETTINGS_KEY = 'world-axiom-model-settings-v1';
const MODEL_CREDENTIALS_KEY = 'world-axiom-model-credentials-v1';

const state = {
  source: { mode: 'brief', brief: '', ipTier: '自动判断', book: null },
  purpose: '世界之书', skin: '自动判断', buildIntent: 'auto', dials: {}, tone: '自动判断', focuses: [],
  providers: [], config: {}, credentialProvider: '', triage: null, sourceDossier: null, cards: [], selectedSeed: null,
  modules: {}, world: '', audit: null, summary: '', art: [], exportTab: 'wiki',
  currentWorldId: '', activeLibraryWorldId: '', libraryWorlds: [],
};

const screens = ['library', 'input', 'cards', 'forge', 'audit', 'export'];
const FORGE_BATCHES = ['L1', 'L2', 'L3', 'L4'];
const FORGE_FLOW_STEPS = [...FORGE_BATCHES, 'AUDIT'];
const MAX_AUTONOMOUS_REPAIR_ATTEMPTS = 4;
const batchLabels = { L1: ['第一、二部分 · 世界概览', '前提 · 运转 · 常识'], L2: ['第三、四部分 · 地方与历史', '关系 · 转折 · 当下'], L3: ['第五部分 · 人们怎样生活', '社会 · 生计 · 日常'], L4: ['第六部分 · 重要名称', '关键条目 · 关联 · 索引'], AUDIT: ['第五步 · 一致性审计', '规律 · 因果 · 风险'] };
const forgeNodeDetails = {
  L1: ['建立整体认识与运转方式', '回答这是什么世界、首先能看到什么，以及核心规则怎样影响普通生活。'],
  L2: ['连接地方格局与历史因果', '说明关键地方如何联系，以及哪些历史变化造就了今天的秩序。'],
  L3: ['补全居民生活与社会运行', '落实居住、食物、工作、交易、出行、教育、治疗和现实危险。'],
  L4: ['整理关键名称与查阅条目', '只保留理解整个世界不可缺少的名称，并建立与正文的关联。'],
};
const seedGenerationStages = [
  ['输入与约束', '已整理并发送给模型'],
  ['生成三个世界方向', '建立事实底稿，并比较三个真正不同的方向'],
  ['检查输入是否进入结果', '核对事实、约束和未知边界'],
  ['整理可选择卡片', '生成概述、关键差异和选择入口'],
];
const auditStages = [
  ['准备审计材料', '汇总世界正文、世界模型和事实底稿'],
  ['模型逐项检查', '检查自然规律、时空尺度、历史因果、资源与知识边界'],
  ['解析审计结果', '读取问题位置、影响和最小修补建议'],
  ['保存审计报告', '整理通过项并进入一致性审计页面'],
];
let detailedLoadingTimer = null;
let forgeNodeTimer = null;

function showToast(message, duration = 3_600) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.hidden = true; }, duration);
}

function resetDetailedLoading() {
  window.clearInterval(detailedLoadingTimer);
  detailedLoadingTimer = null;
  $('#loadingCard').classList.remove('is-detailed');
  $('#loadingOperation').hidden = true;
  $('#loadingTrack').dataset.mode = 'progress';
}

function showLoading(title, detail, progress = 18) {
  resetDetailedLoading();
  $('#loadingTitle').textContent = title;
  $('#loadingDetail').textContent = detail;
  $('#loadingBar').style.width = `${progress}%`;
  $('#loadingOverlay').hidden = false;
}

function updateLoading(title, detail, progress) {
  $('#loadingTitle').textContent = title;
  $('#loadingDetail').textContent = detail;
  $('#loadingBar').style.width = `${progress}%`;
}

function renderLoadingStages(stages, activeIndex) {
  $('#loadingStages').innerHTML = stages.map(([title, detail], index) => {
    const status = index < activeIndex ? 'is-done' : index === activeIndex ? 'is-active' : '';
    const marker = index < activeIndex ? '✓' : String(index + 1).padStart(2, '0');
    return `<li class="loading-stage ${status}"><i>${marker}</i><span><strong>${title}</strong><small>${detail}</small></span></li>`;
  }).join('');
}

function renderSeedLoadingStages(activeIndex) {
  renderLoadingStages(seedGenerationStages, activeIndex);
}

function startSeedGenerationLoading(providerName, modelName) {
  showLoading('正在构建 3 个世界方向', '完整请求已经送达模型，页面会持续显示真实等待时间。', 18);
  $('#loadingCard').classList.add('is-detailed');
  $('#loadingOperation').hidden = false;
  $('#loadingModel').textContent = `${providerName} · ${modelName || '默认模型'}`;
  $('#loadingTrack').dataset.mode = 'waiting';
  renderSeedLoadingStages(1);
  const startedAt = Date.now();
  const updateElapsed = () => {
    const seconds = Math.floor((Date.now() - startedAt) / 1_000);
    $('#loadingElapsed').textContent = `已等待 ${seconds} 秒`;
    $('#loadingAssurance').textContent = seconds < 15
      ? '模型正在完成事实底稿和三个方向；返回后会自动校验，无需重复点击。'
      : seconds < 40
        ? '模型仍在处理完整请求。系统收到结果后会检查你的输入是否真正进入产出。'
        : '仍在运行，不是页面卡住。长材料或推理型模型通常需要更长时间。';
  };
  updateElapsed();
  detailedLoadingTimer = window.setInterval(updateElapsed, 1_000);
}

function advanceSeedGeneration(stage, title, detail, progress) {
  renderSeedLoadingStages(stage);
  $('#loadingTrack').dataset.mode = 'progress';
  updateLoading(title, detail, progress);
}

function renderAuditLoadingStages(activeIndex) {
  renderLoadingStages(auditStages, activeIndex);
}

function startAuditLoading(providerName, modelName) {
  showLoading('正在做一致性审计', '审计材料已经准备完成，模型正在逐项检查整个世界。', 20);
  $('#loadingCard').classList.add('is-detailed');
  $('#loadingOperation').hidden = false;
  $('#loadingModel').textContent = `${providerName} · ${modelName || '默认模型'}`;
  $('#loadingTrack').dataset.mode = 'waiting';
  renderAuditLoadingStages(1);
  const startedAt = Date.now();
  const updateElapsed = () => {
    const seconds = Math.floor((Date.now() - startedAt) / 1_000);
    $('#loadingElapsed').textContent = `已审计 ${seconds} 秒`;
    $('#loadingAssurance').textContent = seconds < 15
      ? '模型正在读取完整正文并逐项核对；结果返回前不会假装完成后续步骤。'
      : seconds < 45
        ? '模型仍在检查规律、尺度和历史因果。收到结果后会立即解析问题位置。'
        : '审计仍在运行，不是页面卡住。世界正文越完整，逐项核对通常越久。';
  };
  updateElapsed();
  detailedLoadingTimer = window.setInterval(updateElapsed, 1_000);
}

function advanceAuditLoading(stage, title, detail, progress) {
  renderAuditLoadingStages(stage);
  $('#loadingTrack').dataset.mode = 'progress';
  updateLoading(title, detail, progress);
}

function setSeedGenerationBusy(busy) {
  $('#generateSeeds').disabled = busy;
  $('#regenerateCards').disabled = busy;
}

function hideLoading() {
  $('#loadingOverlay').hidden = true;
  resetDetailedLoading();
}

function setGenerationStatus(message, tone = 'progress') {
  const status = $('#generationStatus');
  status.textContent = message;
  status.dataset.tone = tone;
  status.hidden = false;
}

function clearGenerationStatus() {
  const status = $('#generationStatus');
  status.textContent = '';
  status.hidden = true;
  delete status.dataset.tone;
}

function setStepEnabled(step, enabled = true) {
  const button = $(`.step-link[data-step="${step}"]`);
  if (button) button.disabled = !enabled;
}

function navigate(step) {
  if (!screens.includes(step)) return;
  const isLibrary = step === 'library';
  document.body.classList.toggle('is-library-view', isLibrary);
  for (const screen of $$('.screen')) {
    const active = screen.dataset.screen === step;
    screen.hidden = !active;
    screen.classList.toggle('is-active', active);
  }
  for (const link of $$('.step-link')) {
    const active = link.dataset.step === step;
    link.classList.toggle('is-active', active);
    link.toggleAttribute('aria-current', active);
    const linkIndex = screens.indexOf(link.dataset.step);
    link.classList.toggle('is-complete', linkIndex < screens.indexOf(step) && !link.disabled);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const worldFilters = [{ id: 'all', label: '全部世界' }, { id: 'narrative', label: '我的世界' }];

function setSelectValue(select, value) {
  if (!value) return;
  if (![...select.options].some((option) => option.value === value)) select.add(new Option(value, value));
  select.value = value;
}

function loadModelSettings() {
  try { return JSON.parse(window.localStorage.getItem(MODEL_SETTINGS_KEY) || '{}'); }
  catch { return {}; }
}

function saveModelSettings() {
  const settings = {
    provider: $('#providerSelect').value,
    baseUrl: $('#baseUrlInput').value.trim(),
    model: $('#modelInput').value.trim(),
    temperature: Number($('#temperatureInput').value),
    imageBaseUrl: $('#imageBaseUrlInput').value.trim(),
    imageModel: $('#imageModelInput').value.trim(),
  };
  window.localStorage.setItem(MODEL_SETTINGS_KEY, JSON.stringify(settings));
}

function loadModelCredentials() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(MODEL_CREDENTIALS_KEY) || '{}');
    return { textByProvider: saved.textByProvider || {}, imageApiKey: saved.imageApiKey || '' };
  } catch { return { textByProvider: {}, imageApiKey: '' }; }
}

function saveVisibleCredentials(provider = $('#providerSelect').value) {
  const saved = loadModelCredentials();
  const apiKey = normalizeApiKey($('#apiKeyInput').value);
  const imageApiKey = normalizeApiKey($('#imageApiKeyInput').value);
  if (apiKey) saved.textByProvider[provider] = apiKey;
  else delete saved.textByProvider[provider];
  saved.imageApiKey = imageApiKey;
  window.localStorage.setItem(MODEL_CREDENTIALS_KEY, JSON.stringify(saved));
}

function restoreVisibleCredentials(provider = $('#providerSelect').value) {
  const saved = loadModelCredentials();
  $('#apiKeyInput').value = saved.textByProvider[provider] || '';
  $('#imageApiKeyInput').value = saved.imageApiKey || '';
  state.credentialProvider = provider;
}

function clearSavedCredentials() {
  window.localStorage.removeItem(MODEL_CREDENTIALS_KEY);
  $('#apiKeyInput').value = '';
  $('#imageApiKeyInput').value = '';
  showToast('本机保存的模型密钥已清除。');
}

function snapshotForStorage(lastScreen) {
  return {
    source: { mode: state.source.mode, brief: state.source.brief, ipTier: state.source.ipTier },
    purpose: state.purpose, skin: state.skin, buildIntent: state.buildIntent,
    dials: state.dials, tone: state.tone, focuses: state.focuses,
    triage: state.triage, sourceDossier: state.sourceDossier, cards: state.cards, selectedSeed: state.selectedSeed, modules: state.modules,
    world: state.world, audit: state.audit, summary: state.summary, exportTab: state.exportTab, lastScreen,
  };
}

async function saveCurrentWorld(lastScreen = 'input') {
  if (!state.currentWorldId) return;
  const record = await getWorld(state.currentWorldId);
  if (!record || record.status === 'archived') return;
  const selected = state.selectedSeed;
  record.title = selected?.name || record.title;
  record.oneLine = selected?.one_line || state.source.brief || record.oneLine;
  record.family = 'narrative';
  record.seed = selected || record.seed;
  record.status = state.summary ? 'ready' : state.cards.length ? 'in-progress' : 'draft';
  record.blueprint = {
    brief: state.source.brief, purpose: state.purpose, skin: state.skin, ipTier: state.source.ipTier,
    buildIntent: state.buildIntent, dials: state.dials, tone: state.tone, focuses: state.focuses,
  };
  record.snapshot = snapshotForStorage(lastScreen);
  await putWorld(record);
  $('#projectState').textContent = `${record.title} · ${record.status === 'ready' ? '可交付' : '正在生长'}`;
}

function applyBlueprint(record) {
  const blueprint = record.blueprint || {};
  state.triage = null; state.sourceDossier = null; state.cards = []; state.selectedSeed = null; state.modules = {};
  state.world = ''; state.audit = null; state.summary = ''; state.art = []; state.exportTab = 'wiki';
  ['cards', 'forge', 'audit', 'export'].forEach((step) => setStepEnabled(step, false));
  state.currentWorldId = record.id;
  state.buildIntent = blueprint.buildIntent || 'auto';
  state.source = { mode: 'brief', brief: blueprint.brief || '', ipTier: blueprint.ipTier || '自动判断', book: null };
  state.purpose = blueprint.purpose || '世界之书'; state.skin = blueprint.skin || '自动判断';
  state.dials = blueprint.dials || {}; state.tone = blueprint.tone || '自动判断'; state.focuses = blueprint.focuses || [];
  switchSource('brief');
  $('#briefInput').value = state.source.brief; $('#briefInput').dispatchEvent(new Event('input'));
  setSelectValue($('#ipTierSelect'), state.source.ipTier); setSelectValue($('#purposeSelect'), state.purpose);
  setSelectValue($('#skinSelect'), state.skin); setSelectValue($('#buildIntentSelect'), state.buildIntent);
  const dialControls = { scarcity: '#dialScarcity', abnormality: '#dialAbnormality', phase: '#dialPhase', stance: '#dialStance', scale: '#dialScale' };
  Object.entries(dialControls).forEach(([key, selector]) => {
    const control = $(selector);
    const value = String(state.dials[key] ?? '');
    control.value = [...control.options].some((option) => option.value === value) ? value : '交给系统';
    state.dials[key] = control.value;
  });
  setSelectValue($('#toneSelect'), state.tone);
  $$('#focusGrid input').forEach((input) => { input.checked = state.focuses.includes(input.value); });
  $('#forgeTitle').textContent = '世界正在被解释清楚';
  $('#forgeProgress').innerHTML = '';
  hideForgeActivity();
  refreshWorldPreview('waiting');
  $('#projectState').textContent = `${record.title} · 正在生长`;
}

function restoreSnapshot(record) {
  applyBlueprint(record);
  const snapshot = record.snapshot;
  if (!snapshot) return 'input';
  Object.assign(state, snapshot, { currentWorldId: record.id });
  state.triage = snapshot.triage;
  state.sourceDossier = snapshot.sourceDossier || null;
  state.cards = (snapshot.cards || []).map(normalizeCard);
  state.selectedSeed = snapshot.selectedSeed ? normalizeCard(snapshot.selectedSeed, state.cards.findIndex((card) => card.seed_id === snapshot.selectedSeed.seed_id)) : null;
  state.modules = snapshot.modules || {}; state.world = snapshot.world || ''; state.audit = snapshot.audit; state.summary = snapshot.summary || '';
  if (state.cards.length) { renderSeedCards(); setStepEnabled('cards'); }
  if (state.selectedSeed) {
    updateCompass(state.selectedSeed); setStepEnabled('forge'); refreshWorldPreview();
    const completed = FORGE_BATCHES.findIndex((batch) => !state.modules[batch]);
    const completedCount = completed === -1 ? FORGE_BATCHES.length : completed;
    renderForgeProgress(FORGE_FLOW_STEPS, completedCount === FORGE_BATCHES.length && state.audit ? FORGE_FLOW_STEPS.length : completedCount);
    if (completedCount === FORGE_BATCHES.length) showForgeAuditState(state.audit ? 'complete' : 'active');
    else showForgeNode(FORGE_BATCHES[completedCount], completedCount, 'paused');
    $('#resumeForge').hidden = completedCount === FORGE_BATCHES.length;
  }
  if (state.audit) { renderAudit(); setStepEnabled('audit'); }
  if (state.summary) { renderExport(); setStepEnabled('export'); }
  return snapshot.lastScreen && screens.includes(snapshot.lastScreen) ? snapshot.lastScreen : 'input';
}

async function renderLibrary() {
  state.libraryWorlds = await listWorlds();
  const query = $('#worldSearch').value.trim().toLocaleLowerCase('zh-CN');
  const family = $('#familyFilter').value || 'all';
  const kind = $('#worldKindFilter').value || 'active';
  const filtered = state.libraryWorlds.filter((world) => {
    const haystack = [world.title, world.oneLine, world.sourceReference, ...(world.tags || []), ...(world.tasks || []).map((task) => task.title)].join(' ').toLocaleLowerCase('zh-CN');
    const matchesStatus = kind === 'all' || (kind === 'archived' ? world.status === 'archived' : world.status !== 'archived');
    return (!query || haystack.includes(query))
      && (family === 'all' || world.family === family)
      && matchesStatus;
  }).sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived') || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const activeWorlds = state.libraryWorlds.filter((world) => world.status !== 'archived');
  const archivedWorlds = state.libraryWorlds.filter((world) => world.status === 'archived');
  const taskCount = activeWorlds.reduce((total, world) => total + (world.tasks || []).filter((task) => task.status !== 'done').length, 0);
  $('#libraryStats').innerHTML = `<div class="library-stat"><strong>${activeWorlds.length}</strong><span>个进行中的世界</span></div><div class="library-stat"><strong>${archivedWorlds.length}</strong><span>个已归档世界</span></div><div class="library-stat"><strong>${taskCount}</strong><span>项待推进任务</span></div>`;
  $('#worldResultCount').textContent = `${filtered.length} 个结果`;
  const statusLabels = { draft: '草稿', 'in-progress': '生成中', ready: '可交付', archived: '已归档' };
  $('#worldGrid').innerHTML = filtered.length ? filtered.map((world) => {
    const done = (world.tasks || []).filter((item) => item.status === 'done').length;
    return `<button class="world-card ${world.status === 'archived' ? 'is-archived' : ''}" type="button" data-world-id="${escapeHtml(world.id)}">
      <div class="world-card-top"><span class="world-family">世界之书</span><span class="world-kind">${escapeHtml(statusLabels[world.status] || '进行中')}</span></div>
      <h3>${escapeHtml(world.title)}</h3><p>${escapeHtml(world.oneLine)}</p>
      <div class="world-card-foot"><span class="world-tags">${(world.tags || []).slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</span><span class="world-progress">${done}/${world.tasks?.length || 0} 项任务</span></div>
    </button>`;
  }).join('') : state.libraryWorlds.length
    ? '<div class="world-empty"><strong>这里没有匹配的世界</strong><p>可以更换关键词、谱系或状态筛选。</p></div>'
    : '<div class="world-empty"><strong>还没有世界</strong><p>从一句世界说明或一组已有材料开始，构建进度会自动保存在这里。</p><button class="primary-button small" type="button" data-create-world>创建第一个世界</button></div>';
}

async function openWorldDetail(worldId) {
  const world = await getWorld(worldId);
  if (!world) return;
  state.activeLibraryWorldId = world.id;
  const archived = world.status === 'archived';
  const statusLabels = { draft: '草稿', 'in-progress': '生成中', ready: '可交付', archived: '已归档' };
  const updated = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(world.updatedAt || world.createdAt));
  $('#worldDetailEyebrow').textContent = archived ? 'ARCHIVED WORLD' : 'YOUR WORLD';
  $('#worldDetailTitle').textContent = world.title;
  $('#worldDetailBody').innerHTML = `<p class="world-detail-lead">${escapeHtml(world.oneLine)}</p>
    <div class="world-detail-meta"><div><span>构建方式</span><strong>${world.seed?.construction_mode === 'reconstruct' ? '还原已有世界' : '创造新世界'}</strong></div><div><span>当前状态</span><strong>${escapeHtml(statusLabels[world.status] || '进行中')}</strong></div><div><span>最近更新</span><strong>${escapeHtml(updated)}</strong></div></div>
    ${archived ? '<div class="world-focus"><strong>这个世界已归档。</strong>恢复后才能继续生成或追加任务；永久删除后无法找回。</div>' : ''}
    <h3>世界任务</h3><ul class="world-task-list">${(world.tasks || []).map((item) => `<li><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.kind)} · ${item.status === 'done' ? '完成' : '待推进'}</small></li>`).join('') || '<li><span>还没有任务</span><small>可在下方追加</small></li>'}</ul>`;
  $('#taskEntryForm').hidden = archived;
  $('#archiveWorldButton').hidden = archived;
  $('#continueWorldButton').hidden = archived;
  $('#restoreWorldButton').hidden = !archived;
  $('#deleteWorldButton').hidden = !archived;
  if (!$('#worldDetailDialog').open) $('#worldDetailDialog').showModal();
}

async function continueActiveWorld() {
  const record = await getWorld(state.activeLibraryWorldId);
  if (!record || record.status === 'archived') return;
  const target = restoreSnapshot(record);
  $('#worldDetailDialog').close();
  setStepEnabled('input'); navigate(target === 'library' ? 'input' : target);
  await renderLibrary();
}

async function archiveActiveWorld() {
  if (!state.activeLibraryWorldId) return;
  await archiveWorld(state.activeLibraryWorldId);
  $('#worldDetailDialog').close();
  await renderLibrary();
  showToast('世界已归档。需要继续时，可以从“已归档”中恢复。');
}

async function restoreActiveWorld() {
  if (!state.activeLibraryWorldId) return;
  await restoreWorld(state.activeLibraryWorldId);
  $('#worldDetailDialog').close();
  $('#worldKindFilter').value = 'active';
  await renderLibrary();
  showToast('世界已恢复，可以继续生成和编辑。');
}

async function requestDeleteActiveWorld() {
  const world = await getWorld(state.activeLibraryWorldId);
  if (!world || world.status !== 'archived') return;
  $('#deleteWorldMessage').textContent = `“${world.title}”及其任务和生成记录将被永久删除，且无法恢复。`;
  $('#deleteWorldDialog').showModal();
}

async function confirmDeleteActiveWorld() {
  if (!state.activeLibraryWorldId) return;
  const worldId = state.activeLibraryWorldId;
  await deleteArchivedWorld(worldId);
  state.activeLibraryWorldId = '';
  $('#deleteWorldDialog').close();
  $('#worldDetailDialog').close();
  await renderLibrary();
  showToast('已永久删除这个世界。');
}

function resetDownstream(from = 'cards') {
  const index = screens.indexOf(from);
  if (index <= screens.indexOf('cards')) { state.cards = []; state.triage = null; state.sourceDossier = null; }
  if (index <= screens.indexOf('forge')) { state.selectedSeed = null; state.modules = {}; state.world = ''; }
  if (index <= screens.indexOf('audit')) state.audit = null;
  if (index <= screens.indexOf('export')) { state.summary = ''; state.art = []; }
  screens.slice(index).forEach((step) => setStepEnabled(step, false));
  if (index <= screens.indexOf('forge')) {
    $('#forgeTitle').textContent = '世界正在被解释清楚';
    $('#forgeProgress').innerHTML = '';
    hideForgeActivity();
    refreshWorldPreview('waiting');
  }
}

function switchSource(mode) {
  state.source.mode = mode;
  for (const tab of $$('.source-tab')) {
    const active = tab.dataset.source === mode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  $('#panel-brief').hidden = mode !== 'brief';
  $('#panel-book').hidden = mode !== 'book';
}

function collectInputs() {
  const sourceMode = state.source.mode;
  const brief = sourceMode === 'book' ? $('#bookIntent').value.trim() : $('#briefInput').value.trim();
  state.source = {
    ...state.source,
    mode: sourceMode,
    brief,
    ipTier: $('#ipTierSelect').value,
  };
  state.purpose = $('#purposeSelect').value;
  state.skin = $('#skinSelect').value;
  state.buildIntent = $('#buildIntentSelect').value;
  state.dials = {
    scarcity: $('#dialScarcity').value,
    abnormality: $('#dialAbnormality').value,
    phase: $('#dialPhase').value,
    stance: $('#dialStance').value,
    scale: $('#dialScale').value,
  };
  state.tone = $('#toneSelect').value;
  state.focuses = $$('#focusGrid input:checked').map((input) => input.value);
  return state;
}

function validateSource() {
  if (state.source.mode === 'brief' && !state.source.brief) {
    $('#briefInput').setAttribute('aria-invalid', 'true');
    $('#briefInput').focus();
    throw new Error('请写下一个世界命题或已知事实。短句也可以，例如：山海经的世界。');
  }
  $('#briefInput').removeAttribute('aria-invalid');
  if (state.source.mode === 'book' && !state.source.book?.sample) throw new Error('请先上传并解析一本书。');
}

function normalizeApiKey(value) {
  return String(value ?? '').trim().replace(/^Bearer\s+/i, '').trim();
}

function modelConfig() {
  const provider = $('#providerSelect').value;
  const preset = state.providers.find((item) => item.id === provider) ?? {};
  return {
    provider,
    protocol: preset.protocol,
    baseUrl: $('#baseUrlInput').value.trim(),
    model: $('#modelInput').value.trim(),
    apiKey: normalizeApiKey($('#apiKeyInput').value),
    temperature: Number($('#temperatureInput').value),
  };
}

function imageConfig() {
  return {
    provider: 'openai', protocol: 'openai',
    baseUrl: $('#imageBaseUrlInput').value.trim(),
    model: $('#imageModelInput').value.trim(),
    apiKey: normalizeApiKey($('#imageApiKeyInput').value || $('#apiKeyInput').value),
  };
}

function validateLiveConfig(config) {
  const localEndpoint = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/i.test(config.baseUrl);
  if (!config.apiKey && !localEndpoint) {
    throw new Error('当前页面没有 API Key。为了安全，刷新页面后需要在“模型与接口”中重新填写。');
  }
  if (config.apiKey && /[^\x21-\x7E]/.test(config.apiKey)) {
    $('#apiKeyInput').setAttribute('aria-invalid', 'true');
    if (!$('#settingsDialog').open) $('#settingsDialog').showModal();
    throw new Error('API Key 格式不正确：不能包含中文、空格或换行。请只粘贴密钥本身，不要包含说明文字。');
  }
  $('#apiKeyInput').removeAttribute('aria-invalid');
  return config;
}

function compactCardText(value, fallback, maxLength) {
  const text = String(value || fallback).trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function normalizeCard(card, index) {
  const fallback = `card-${index + 1}`;
  const constructionMode = card?.construction_mode || (state.buildIntent === 'reconstruct' ? 'reconstruct' : 'create');
  const evidence = card?.evidence ?? {};
  return {
    seed_id: card?.seed_id || fallback,
    name: String(card?.name || `候选世界 ${index + 1}`).slice(0, 30),
    one_line: card?.one_line || '一个尚待展开的世界。',
    construction_mode: constructionMode,
    model_type: card?.model_type || card?.paradox_type || '综合演化型',
    world_thesis: card?.world_thesis || card?.one_line || '这个世界的存在方式尚待展开。',
    overview: compactCardText(card?.overview || card?.world_thesis || card?.one_line, '这是一个尚待选择并展开的世界方向。', 360),
    overview_facets: {
      foundation: compactCardText(card?.overview_facets?.foundation, '世界基础待定', 42),
      change: compactCardText(card?.overview_facets?.change, '变化方向待定', 42),
      civilization: compactCardText(card?.overview_facets?.civilization || card?.civilization_pattern, '文明图景待定', 42),
    },
    historical_depth: card?.historical_depth || '历史深度待定',
    civilization_pattern: card?.civilization_pattern || '居民生活方式待定',
    world_anchors: {
      places: Array.isArray(card?.world_anchors?.places) ? card.world_anchors.places.slice(0, 6) : [],
      peoples: Array.isArray(card?.world_anchors?.peoples) ? card.world_anchors.peoples.slice(0, 5) : [],
      institutions: Array.isArray(card?.world_anchors?.institutions) ? card.world_anchors.institutions.slice(0, 5) : [],
      flora_fauna_goods_customs: Array.isArray(card?.world_anchors?.flora_fauna_goods_customs) ? card.world_anchors.flora_fauna_goods_customs.slice(0, 8) : [],
      historical_events: Array.isArray(card?.world_anchors?.historical_events) ? card.world_anchors.historical_events.slice(0, 5) : [],
    },
    evidence: {
      confirmed: Array.isArray(evidence.confirmed) ? evidence.confirmed : [],
      inferred: Array.isArray(evidence.inferred) ? evidence.inferred : [],
      contested: Array.isArray(evidence.contested) ? evidence.contested : [],
      unknowns: Array.isArray(evidence.unknowns) ? evidence.unknowns : [],
    },
    unknowns: Array.isArray(card?.unknowns) ? card.unknowns.slice(0, 4) : Array.isArray(evidence.unknowns) ? evidence.unknowns.slice(0, 4) : [],
    scale: card?.scale || '', skin: state.skin,
    best_for: card?.best_for || '',
  };
}

function renderTriage() {
  const triage = state.triage ?? {};
  const reconstructing = triage.construction_mode === 'reconstruct';
  const factCount = countSourceDossierFacts(state.sourceDossier);
  const chips = [
    `<span class="triage-chip is-primary">${reconstructing ? '还原已有世界' : '创造新世界'}</span>`,
    `<span class="triage-chip">范围：${escapeHtml(state.dials.scale || '由系统判断')}</span>`,
    `<span class="triage-chip">${reconstructing ? '同一世界 · 3 种概述方式' : '3 份世界概述 · 选择后展开'}</span>`,
  ];
  if (factCount) chips.push(`<span class="triage-chip">${reconstructing ? '材料底稿' : '输入约束'}：${factCount} 项</span>`);
  $('#triageStrip').innerHTML = chips.join('');
}

function renderSeedCards() {
  renderTriage();
  $('#seedCardGrid').innerHTML = state.cards.map((card, index) => `
    <article class="seed-card" data-number="0${index + 1}">
      <div class="seed-card-head"><span class="seed-type">${card.construction_mode === 'reconstruct' ? '还原视角' : '世界模型'} · ${escapeHtml(card.model_type)}</span><h3>${escapeHtml(card.name)}</h3></div>
      <p class="seed-overview">${escapeHtml(card.overview)}</p>
      <div class="overview-facets" aria-label="世界观概述要点">
        <div><span>世界基础</span><strong>${escapeHtml(card.overview_facets.foundation)}</strong></div>
        <div><span>变化方向</span><strong>${escapeHtml(card.overview_facets.change)}</strong></div>
        <div><span>文明图景</span><strong>${escapeHtml(card.overview_facets.civilization)}</strong></div>
      </div>
      <div class="candidate-next-step"><span>选择之后</span><strong>再生成完整世界之书</strong><small>整体概览、运转方式、地方关系、历史来由、日常生活与重要名称将在下一步展开</small></div>
      <button class="primary-button select-seed" type="button" data-card-index="${index}"><span>采用「${escapeHtml(card.name)}」模型</span><svg><use href="#i-arrow"/></svg></button>
    </article>`).join('');
}

function updateCompass(seed) {
  if (!seed) return;
  $('.compass-core span').textContent = seed.name;
  $('.compass-core small').textContent = seed.model_type;
  const evidenceState = seed.construction_mode === 'reconstruct' ? `${seed.evidence?.confirmed?.length || 0} 明确 / ${seed.evidence?.unknowns?.length || 0} 未知` : '设计模型';
  const facts = [seed.model_type, seed.historical_depth || '未定', evidenceState, seed.scale || '未定'];
  $$('.compass-facts strong').forEach((node, index) => { node.textContent = facts[index]; });
  $('#compassQuote').textContent = `“${seed.world_thesis}”`;
  $('#projectState').textContent = `${seed.name} · ${seed.model_type}`;
}

async function handleGenerateSeeds() {
  try {
    clearGenerationStatus();
    collectInputs(); validateSource();
    const config = validateLiveConfig(modelConfig());
    const providerName = $('#providerSelect option:checked')?.textContent || '真实模型';
    startSeedGenerationLoading(providerName, config.model);
    setSeedGenerationBusy(true);
    if (!state.currentWorldId) {
      const project = await createBlankWorld();
      state.currentWorldId = project.id;
    }
    resetDownstream('cards');
    setGenerationStatus(`正在通过${providerName}生成三份世界观概述；等待时间和处理内容会显示在页面中。`);
    const response = await api.generate('seeds', {
      source: { ...state.source, bookSample: state.source.book?.sample }, dials: state.dials, tone: state.tone, focuses: state.focuses,
      purpose: state.purpose, skin: state.skin, buildIntent: state.buildIntent,
    }, config);
    advanceSeedGeneration(2, '模型已经返回，正在检查结果', '确认三个方向完整，并核对用户输入是否真正影响结果。', 72);
    const result = parseModelJson(response.text);
    if (!Array.isArray(result.cards) || result.cards.length < 3) throw new Error('模型没有返回 3 个完整世界模型。');
    state.triage = result.triage ?? {};
    const constructionMode = state.triage.construction_mode || (state.buildIntent === 'reconstruct' ? 'reconstruct' : 'create');
    state.sourceDossier = normalizeSourceDossier(result.source_dossier, constructionMode);
    if (countSourceDossierFacts(state.sourceDossier) === 0) {
      const reason = constructionMode === 'reconstruct' ? '材料事实底稿' : '用户输入约束';
      throw new Error(`模型没有返回${reason}。请重试；系统不会在输入没有进入结果时继续生成完整世界。`);
    }
    advanceSeedGeneration(3, '输入约束已经确认', '正在把三个方向整理成可以直接比较的世界模型卡片。', 88);
    state.cards = result.cards.slice(0, 3).map(normalizeCard);
    advanceSeedGeneration(4, '三个世界方向已经完成', '即将进入选择页面。', 100);
    clearGenerationStatus();
    renderSeedCards(); setStepEnabled('cards'); navigate('cards'); await saveCurrentWorld('cards');
  } catch (error) {
    setGenerationStatus(`生成未完成：${error.message}`, 'error');
    showToast(error.message, 12_000);
  }
  finally { setSeedGenerationBusy(false); hideLoading(); }
}

function renderForgeProgress(batches, activeIndex = -1, errorIndex = -1) {
  $('#forgeProgress').innerHTML = batches.map((batch, index) => {
    const status = index < activeIndex ? 'is-done' : index === activeIndex ? 'is-active' : index === errorIndex ? 'is-error' : '';
    const icon = index < activeIndex ? '✓' : String(index + 1).padStart(2, '0');
    return `<div class="forge-step ${status}"><i>${icon}</i><span><strong>${batchLabels[batch][0]}</strong><small>${batchLabels[batch][1]}</small></span></div>`;
  }).join('');
}

function stopForgeNodeTimer() {
  window.clearInterval(forgeNodeTimer);
  forgeNodeTimer = null;
}

function forgeNextLabel(index) {
  const nextBatch = FORGE_FLOW_STEPS[index + 1];
  return nextBatch ? `下一节点：${batchLabels[nextBatch][0]}` : '下一步：查看审计结果';
}

function showForgeNode(batch, index, stateName = 'active', message = '') {
  stopForgeNodeTimer();
  const activity = $('#forgeActivity');
  const [title, detail] = forgeNodeDetails[batch];
  activity.hidden = false;
  activity.dataset.state = stateName;
  activity.setAttribute('aria-busy', String(stateName === 'active'));
  $('#forgeNodeCode').textContent = `${stateName === 'error' ? '未完成' : stateName === 'paused' ? '等待继续' : '正在进行'} · 节点 ${String(index + 1).padStart(2, '0')} / ${String(FORGE_FLOW_STEPS.length).padStart(2, '0')}`;
  $('#forgeNodeTitle').textContent = `${stateName === 'paused' ? '等待继续：' : stateName === 'error' ? '节点中断：' : '正在'}${title}`;
  $('#forgeNodeDetail').textContent = message || detail;
  $('#forgeNodeCompleted').textContent = `已完成 ${index} / ${FORGE_FLOW_STEPS.length}`;
  $('#forgeNodeNext').textContent = stateName === 'error' || stateName === 'paused' ? '点击“从中断处继续”后会从这里恢复' : forgeNextLabel(index);
  $('#forgeNodeElapsed').textContent = stateName === 'paused' ? '等待操作' : stateName === 'error' ? '已停止' : '已等待 0 秒';
  if (stateName !== 'active') return;

  const startedAt = Date.now();
  forgeNodeTimer = window.setInterval(() => {
    const seconds = Math.floor((Date.now() - startedAt) / 1_000);
    $('#forgeNodeElapsed').textContent = `已等待 ${seconds} 秒`;
    if (seconds >= 45) $('#forgeNodeDetail').textContent = `${detail} 当前节点仍在生成，不是页面卡住。`;
    else if (seconds >= 20) $('#forgeNodeDetail').textContent = `${detail} 模型仍在撰写并保持与前文一致。`;
  }, 1_000);
}

function showForgeNodeCheck(batch, index) {
  stopForgeNodeTimer();
  $('#forgeActivity').dataset.state = 'checking';
  $('#forgeActivity').setAttribute('aria-busy', 'true');
  $('#forgeNodeCode').textContent = `正在校验 · 节点 ${String(index + 1).padStart(2, '0')} / ${String(FORGE_FLOW_STEPS.length).padStart(2, '0')}`;
  $('#forgeNodeTitle').textContent = `正在检查${forgeNodeDetails[batch][0]}`;
  $('#forgeNodeDetail').textContent = '模型已经返回；正在检查必要章节、正文长度和与前文的连续性。';
  $('#forgeNodeNext').textContent = '校验通过后会保存正文并进入下一节点';
}

function showForgeAuditState(stateName = 'active', message = '') {
  stopForgeNodeTimer();
  const activity = $('#forgeActivity');
  activity.hidden = false;
  const complete = stateName === 'complete';
  const failed = stateName === 'error';
  activity.dataset.state = complete ? 'complete' : failed ? 'error' : 'checking';
  activity.setAttribute('aria-busy', String(!complete && !failed));
  $('#forgeNodeCode').textContent = `${complete ? '全部完成' : failed ? '审计中断' : '正在进行'} · 节点 05 / 05`;
  $('#forgeNodeElapsed').textContent = complete ? '审计报告已保存' : failed ? '等待重新审计' : '正文 4 个节点已保存';
  $('#forgeNodeTitle').textContent = complete ? '世界正文与一致性审计均已完成' : failed ? '一致性审计没有完成' : '正在进入一致性审计';
  $('#forgeNodeDetail').textContent = message || (complete ? '世界的规律、尺度、历史因果、资源与知识边界已经完成检查。' : failed ? '正文已经安全保存，可以从审计页面重新检查。' : '完整正文已经构建；接下来检查规律、尺度、历史因果和知识边界。');
  $('#forgeNodeCompleted').textContent = `已完成 ${complete ? 5 : 4} / 5`;
  $('#forgeNodeNext').textContent = complete ? '下一步：查看审计结果' : failed ? '下一步：重新审计' : '审计过程会继续分阶段展示进度';
}

function hideForgeActivity() {
  stopForgeNodeTimer();
  $('#forgeActivity').hidden = true;
  $('#forgeActivity').removeAttribute('aria-busy');
  delete $('#forgeActivity').dataset.state;
}

function refreshWorldPreview(emptyState = 'waiting') {
  if (state.world) {
    $('#worldPreview').innerHTML = renderMarkdown(state.world);
    return;
  }
  const building = emptyState === 'building';
  $('#worldPreview').innerHTML = `<div class="empty-state"><svg><use href="#i-layers"/></svg><strong>${building ? '正在构建这个世界' : '等待选择世界模型'}</strong><span>${building ? '每完成一个节点，新的世界正文就会出现在这里。上方会持续显示当前正在进行的工作。' : '选中后，这里会依照因果顺序构建完整世界。'}</span></div>`;
}

async function selectSeed(index) {
  state.selectedSeed = state.cards[index];
  if (!state.selectedSeed) return;
  state.modules = {};
  state.world = '';
  updateCompass(state.selectedSeed);
  $('#forgeTitle').textContent = `正在解释「${state.selectedSeed.name}」`;
  refreshWorldPreview('building');
  renderForgeProgress(FORGE_FLOW_STEPS, 0);
  showForgeNode(FORGE_BATCHES[0], 0, 'paused', '世界模型已经选定，正在准备第一个正文节点。');
  setStepEnabled('forge'); navigate('forge');
  await saveCurrentWorld('forge');
  await expandWorld(true);
}

async function expandWorld(restart = false) {
  if (!state.selectedSeed) return;
  if (restart) { state.modules = {}; state.world = ''; refreshWorldPreview('building'); }
  const firstMissing = FORGE_BATCHES.findIndex((batch) => !state.modules[batch]);
  const startIndex = firstMissing === -1 ? FORGE_BATCHES.length : firstMissing;
  $('#resumeForge').hidden = true;
  $('#resumeForge').disabled = true;
  renderForgeProgress(FORGE_FLOW_STEPS, startIndex);
  try {
    const config = validateLiveConfig(modelConfig());
    for (let index = startIndex; index < FORGE_BATCHES.length; index += 1) {
      const batch = FORGE_BATCHES[index];
      renderForgeProgress(FORGE_FLOW_STEPS, index);
      showForgeNode(batch, index);
      const response = await api.generate('expand', { batch, seed: state.selectedSeed, sourceDossier: state.sourceDossier, previous: state.world }, config);
      showForgeNodeCheck(batch, index);
      const markdown = cleanModelMarkdown(response.text);
      const validation = validateWorldModule(batch, markdown);
      if (!validation.ok) throw new Error(`${batchLabels[batch][0]}不完整：${validation.problems.join('；')}。`);
      state.modules[batch] = markdown;
      state.world = FORGE_BATCHES.map((key) => state.modules[key]).filter(Boolean).join('\n\n---\n\n');
      refreshWorldPreview();
      await saveCurrentWorld('forge');
    }
    renderForgeProgress(FORGE_FLOW_STEPS, FORGE_BATCHES.length);
    showForgeAuditState('active');
    await runAudit(true);
  } catch (error) {
    const failedIndex = FORGE_BATCHES.findIndex((batch) => !state.modules[batch]);
    const targetIndex = failedIndex === -1 ? Math.min(startIndex, FORGE_BATCHES.length - 1) : failedIndex;
    renderForgeProgress(FORGE_FLOW_STEPS, -1, targetIndex);
    showForgeNode(FORGE_BATCHES[targetIndex], targetIndex, 'error', error.message);
    $('#resumeForge').hidden = false;
    showToast(`展开中断：${error.message}`, 6_000);
  } finally {
    $('#resumeForge').disabled = false;
  }
}

async function runAudit(autoNavigate = false) {
  try {
    if (!state.world) throw new Error('世界正文尚未生成。');
    const config = validateLiveConfig(modelConfig());
    const providerName = $('#providerSelect option:checked')?.textContent || '真实模型';
    startAuditLoading(providerName, config.model);
    const response = await api.generate('lint', { seed: state.selectedSeed, sourceDossier: state.sourceDossier, world: state.world }, config);
    advanceAuditLoading(2, '模型检查已经完成', '正在解析问题位置、影响范围和最小修补建议。', 72);
    state.audit = parseModelJson(response.text);
    advanceAuditLoading(3, '审计结果已经读懂', '正在整理通过项、问题清单并保存本次报告。', 88);
    renderAudit(); setStepEnabled('audit'); await saveCurrentWorld('audit');
    renderForgeProgress(FORGE_FLOW_STEPS, FORGE_FLOW_STEPS.length);
    showForgeAuditState('complete');
    advanceAuditLoading(4, '一致性审计已经完成', '审计报告已保存，即将进入结果页面。', 100);
    if (autoNavigate) navigate('audit');
  } catch (error) {
    if (state.world && FORGE_BATCHES.every((batch) => state.modules[batch])) {
      renderForgeProgress(FORGE_FLOW_STEPS, -1, FORGE_BATCHES.length);
      showForgeAuditState('error', error.message);
    }
    showToast(error.message, 5_000);
  }
  finally { hideLoading(); }
}

function renderAudit() {
  const audit = state.audit ?? { score: 0, status: '未审计', violations: [], passed_rules: [] };
  const violations = getAuditViolations(audit);
  $('#auditHero').innerHTML = `<div class="score-ring" style="--score:${Number(audit.score) || 0}"><span>${escapeHtml(audit.score || 0)}<small>STRUCTURE</small></span></div><div class="audit-summary"><h3>${escapeHtml(audit.status)}</h3><p>${escapeHtml(audit.untapped_potential || '没有发现结构性硬伤。')}</p></div>`;
  $('#violationCount').textContent = `${violations.length} 项`;
  $('#violationsList').innerHTML = violations.length ? violations.map((item) => `<article class="violation"><svg><use href="#i-alert"/></svg><div><strong>${escapeHtml(item.rule)} · ${escapeHtml(item.location)}</strong><p>${escapeHtml(item.problem)}</p><small>最小修补：${escapeHtml(item.minimal_fix)}</small></div></article>`).join('') : '<div class="passed-list"><span class="passed-rule"><svg><use href="#i-check"/></svg>没有硬性违规</span></div>';
  $('#passedRules').innerHTML = (audit.passed_rules ?? []).map((rule) => `<span class="passed-rule"><svg><use href="#i-check"/></svg>${escapeHtml(rule)}</span>`).join('');
  const repairButton = $('#repairWorld');
  repairButton.hidden = violations.length === 0;
  $('span', repairButton).textContent = violations.length ? `让 AI 自主修补 ${violations.length} 项问题` : '审计已通过';
}

async function runAutonomousRepairAttempt(config, attempt) {
  updateLoading('AI 正在自主修补', `第 ${attempt} 轮：修补当前剩余的 ${getAuditViolations(state.audit).length} 项问题。`, 12 + attempt * 14);
  const response = await api.generate('repair', { seed: state.selectedSeed, sourceDossier: state.sourceDossier, world: state.world, audit: state.audit }, config);
  const repairedWorld = cleanModelMarkdown(response.text);
  if (!repairedWorld || repairedWorld === state.world) return null;

  updateLoading('正在复核修补结果', `第 ${attempt} 轮：确认修改是否解决问题且没有引入新矛盾。`, 20 + attempt * 16);
  const auditResponse = await api.generate('lint', { seed: state.selectedSeed, sourceDossier: state.sourceDossier, world: repairedWorld }, config);
  const nextAudit = parseModelJson(auditResponse.text);
  return {
    world: repairedWorld,
    audit: hasAuditPassed(nextAudit) ? { ...nextAudit, status: '通过', violations: [] } : nextAudit,
  };
}

async function repairWorld() {
  let completedAttempts = 0;
  let stalledAttempts = 0;
  try {
    showLoading('AI 正在自主修补', '只改审计指出的问题；每轮修补后都会重新检查。', 18);
    const config = validateLiveConfig(modelConfig());
    let previousBurden = getAuditBurden(state.audit);
    let previousScore = Number(state.audit?.score) || 0;

    for (let attempt = 1; attempt <= MAX_AUTONOMOUS_REPAIR_ATTEMPTS; attempt += 1) {
      completedAttempts = attempt;
      const result = await runAutonomousRepairAttempt(config, attempt);
      if (!result) {
        navigate('audit');
        showToast('AI 没有产生有效修改，已停止自动重试并保留当前版本。', 10_000);
        return;
      }

      state.world = result.world;
      state.audit = result.audit;
      renderAudit();
      await saveCurrentWorld('audit');

      if (hasAuditPassed(state.audit)) {
        updateLoading('自主修补已通过', `经过 ${attempt} 轮修补，正在整理最终世界档案。`, 92);
        await finalizeWorld();
        return;
      }

      const currentBurden = getAuditBurden(state.audit);
      const currentScore = Number(state.audit?.score) || 0;
      const improved = currentBurden < previousBurden || currentScore > previousScore;
      stalledAttempts = improved ? 0 : stalledAttempts + 1;
      previousBurden = currentBurden;
      previousScore = currentScore;
      if (stalledAttempts >= 2) break;
    }

    navigate('audit');
    const remaining = getAuditViolations(state.audit).length;
    const stopReason = stalledAttempts >= 2 ? '连续两轮没有改善' : '达到安全重试上限';
    showToast(`AI 已自主尝试 ${completedAttempts} 轮，因${stopReason}而停止。当前版本和剩余 ${remaining} 项问题已保留。`, 12_000);
  } catch (error) {
    navigate('audit');
    showToast(`自主修补中断：${error.message}。当前已完成的修改已保留。`, 12_000);
  }
  finally { hideLoading(); }
}

async function finalizeWorld() {
  try {
    showLoading('正在整理世界档案', '把完整世界压缩成 3 分钟概览。', 56);
    const response = await api.generate('summary', { seed: state.selectedSeed, sourceDossier: state.sourceDossier, world: state.world }, validateLiveConfig(modelConfig()));
    state.summary = cleanModelMarkdown(response.text);
    renderExport(); setStepEnabled('export'); navigate('export'); await saveCurrentWorld('export'); await renderLibrary();
  } catch (error) { showToast(error.message, 5_000); }
  finally { hideLoading(); }
}

function exportPayload() { return { seed: state.selectedSeed, world: state.world, audit: state.audit, summary: state.summary, art: state.art }; }

function renderExport() {
  $('#exportPreview').innerHTML = state.exportTab === 'wiki' ? buildWikiPreview(exportPayload()) : buildSimplePreview(exportPayload());
  $$('.export-tab').forEach((tab) => {
    const active = tab.dataset.exportTab === state.exportTab;
    tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active));
  });
}

async function generateArt() {
  const config = imageConfig();
  if (!config.apiKey) {
    $('#settingsDialog').showModal();
    showToast('请在“图片模型”中填写接口与密钥。');
    return;
  }
  try {
    state.art = [];
    const prompts = buildImagePrompts(state.selectedSeed);
    showLoading('正在生成世界配图', '第 1 / 3 张 · 世界封面', 16);
    for (let index = 0; index < prompts.length; index += 1) {
      updateLoading('正在生成世界配图', `第 ${index + 1} / 3 张 · ${['世界封面','关键地点','普通人生活'][index]}`, 20 + index * 30);
      const image = await api.generateImage(prompts[index], config);
      state.art.push(image);
      if (image.warning) showToast(image.warning, 8_000);
    }
    renderExport(); showToast('3 张配图已替换进 Wiki。');
  } catch (error) { showToast(error.message, 6_000); }
  finally { hideLoading(); }
}

async function handleBook(file) {
  if (!file) return;
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error('文件超过 25 MB。');
    showLoading('正在读取书籍', '只抽取结构所需片段，不保存原文。', 22);
    const dataBase64 = await fileToBase64(file);
    updateLoading('正在抽取章节', '采样开篇、中段、结尾与规则段落。', 56);
    const result = await api.extractBook({ name: file.name, dataBase64 });
    state.source.book = result;
    $('#fileName').textContent = result.name;
    $('#fileMeta').textContent = `${result.extension.toUpperCase()} · ${result.characters.toLocaleString('zh-CN')} 字符${result.truncated ? ' · 已截取' : ''}`;
    $('#fileCard').hidden = false; $('#bookDropzone').hidden = true;
    showToast('书籍已解析，可以开始还原世界。');
  } catch (error) { state.source.book = null; $('#bookInput').value = ''; showToast(error.message, 6_000); }
  finally { hideLoading(); }
}

function removeBook() {
  state.source.book = null; $('#bookInput').value = ''; $('#fileCard').hidden = true; $('#bookDropzone').hidden = false;
}

function applyProviderPreset() {
  const preset = state.providers.find((item) => item.id === $('#providerSelect').value);
  if (!preset) return;
  $('#baseUrlInput').value = preset.baseUrl || '';
  $('#modelInput').value = preset.model || '';
}

function updateProviderBadge() {
  $('#modeBadge').textContent = $('#providerSelect option:checked')?.textContent || '真实模型';
}

function loadExample() {
  switchSource('brief');
  $('#briefInput').value = '这是一个被永久云层覆盖的海洋星球。人类聚落依附会迁徙的浮岛生存，能源来自潮汐，已知文明至少经历过两次跨洋迁徙。请介绍它的山河、城市、居民、历史、日常生活与代表风物。';
  $('#briefInput').dispatchEvent(new Event('input'));
  $('#buildIntentSelect').value = 'create'; $('#skinSelect').value = '科幻'; $('#purposeSelect').value = '世界之书';
  $('#dialScarcity').value = '能量与物资'; $('#dialPhase').value = '鼎盛的表面之下'; $('#dialStance').value = '只能局部适应'; $('#dialScale').value = '大陆或整颗星球';
  $('#toneSelect').value = '克制现实';
  $$('#focusGrid input').forEach((input) => { input.checked = input.value === '日常与生计'; });
  showToast('示例已填入，可以直接生成。');
}

async function createNewWorld() {
  const project = await createBlankWorld();
  applyBlueprint(project);
  setStepEnabled('input'); navigate('input');
  await renderLibrary();
}

function bindEvents() {
  $('#backToLibrary').addEventListener('click', async () => {
    const activeScreen = $('.screen:not([hidden])')?.dataset.screen || 'input';
    if (activeScreen === 'input') collectInputs();
    await saveCurrentWorld(activeScreen);
    await renderLibrary(); navigate('library');
  });
  $('#createBlankWorld').addEventListener('click', createNewWorld);
  $('#worldGrid').addEventListener('click', (event) => {
    const createButton = event.target.closest('[data-create-world]');
    if (createButton) { createNewWorld(); return; }
    const card = event.target.closest('[data-world-id]');
    if (card) openWorldDetail(card.dataset.worldId);
  });
  $('#worldSearch').addEventListener('input', renderLibrary);
  $('#familyFilter').addEventListener('change', renderLibrary);
  $('#worldKindFilter').addEventListener('change', renderLibrary);
  $('#closeWorldDetail').addEventListener('click', () => $('#worldDetailDialog').close());
  $('#continueWorldButton').addEventListener('click', continueActiveWorld);
  $('#archiveWorldButton').addEventListener('click', archiveActiveWorld);
  $('#restoreWorldButton').addEventListener('click', restoreActiveWorld);
  $('#deleteWorldButton').addEventListener('click', requestDeleteActiveWorld);
  $('#cancelDeleteWorld').addEventListener('click', () => $('#deleteWorldDialog').close());
  $('#confirmDeleteWorld').addEventListener('click', confirmDeleteActiveWorld);
  $('#taskEntryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = $('#newTaskTitle').value.trim();
    if (!title || !state.activeLibraryWorldId) return;
    await addWorldTask(state.activeLibraryWorldId, title, $('#newTaskKind').value);
    $('#newTaskTitle').value = '';
    await renderLibrary(); await openWorldDetail(state.activeLibraryWorldId);
  });
  $$('.source-tab').forEach((tab) => tab.addEventListener('click', () => switchSource(tab.dataset.source)));
  $('#briefInput').addEventListener('input', (event) => { $('#briefCount').textContent = `${event.target.value.length} / 8000`; });
  $('#bookInput').addEventListener('change', (event) => handleBook(event.target.files[0]));
  $('#removeBook').addEventListener('click', removeBook);
  const dropzone = $('#bookDropzone');
  ['dragenter','dragover'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); }));
  ['dragleave','drop'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); }));
  dropzone.addEventListener('drop', (event) => handleBook(event.dataTransfer.files[0]));
  $('#loadExample').addEventListener('click', loadExample);
  $('#generateSeeds').addEventListener('click', handleGenerateSeeds);
  $('#regenerateCards').addEventListener('click', handleGenerateSeeds);
  $('#seedCardGrid').addEventListener('click', (event) => { const button = event.target.closest('[data-card-index]'); if (button) selectSeed(Number(button.dataset.cardIndex)); });
  $('#resumeForge').addEventListener('click', () => expandWorld(false));
  $('#rerunAudit').addEventListener('click', () => runAudit(false));
  $('#repairWorld').addEventListener('click', repairWorld);
  $('#skipRepair').addEventListener('click', finalizeWorld);
  $$('.export-tab').forEach((tab) => tab.addEventListener('click', () => { state.exportTab = tab.dataset.exportTab; renderExport(); }));
  $$('.download-card').forEach((button) => button.addEventListener('click', () => downloadDeliverable(button.dataset.download, state)));
  $('#generateArt').addEventListener('click', generateArt);
  $$('.step-link').forEach((button) => button.addEventListener('click', () => { if (!button.disabled) navigate(button.dataset.step); }));
  const dialog = $('#settingsDialog');
  ['#openSettings','#openSettingsMobile'].forEach((selector) => $(selector).addEventListener('click', () => dialog.showModal()));
  $('#providerSelect').addEventListener('change', () => {
    if (state.credentialProvider) saveVisibleCredentials(state.credentialProvider);
    applyProviderPreset(); restoreVisibleCredentials(); updateProviderBadge();
  });
  $('#temperatureInput').addEventListener('input', (event) => { $('#temperatureOutput').value = event.target.value; });
  $('#clearSavedKeys').addEventListener('click', clearSavedCredentials);
  $('#saveSettings').addEventListener('click', () => {
    updateProviderBadge(); saveModelSettings(); saveVisibleCredentials(); dialog.close();
    showToast('模型设置和密钥已保存在这个本地浏览器中。');
  });
}

async function init() {
  bindEvents();
  $('#familyFilter').innerHTML = worldFilters.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('');
  await initializeWorldStore();
  await renderLibrary();
  try {
    const health = await api.health();
    state.providers = health.providers ?? [];
    $('#providerSelect').innerHTML = state.providers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('');
    const savedSettings = loadModelSettings();
    const savedProvider = state.providers.some((item) => item.id === savedSettings.provider) ? savedSettings.provider : 'openai';
    $('#providerSelect').value = savedProvider; applyProviderPreset();
    if (savedSettings.baseUrl) $('#baseUrlInput').value = savedSettings.baseUrl;
    if (savedSettings.model) $('#modelInput').value = savedSettings.model;
    if (Number.isFinite(savedSettings.temperature)) {
      $('#temperatureInput').value = String(savedSettings.temperature);
      $('#temperatureOutput').value = String(savedSettings.temperature);
    }
    if (savedSettings.imageBaseUrl) $('#imageBaseUrlInput').value = savedSettings.imageBaseUrl;
    if (savedSettings.imageModel) $('#imageModelInput').value = savedSettings.imageModel;
    restoreVisibleCredentials(savedProvider);
    $('#healthStatus').textContent = `本地服务 ${health.version} 已连接`;
  } catch (error) {
    $('#healthStatus').textContent = '本地服务未连接';
    showToast(error.message, 6_000);
  }
  updateProviderBadge(); navigate('library');
}

init();
