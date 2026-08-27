import { api } from './api.js?v=6';
import { canonPartAsMarkdown, canonPartFromMarkdown, canonPreviewMarkdown } from './canon-markdown.js';
import { buildImagePrompts, buildSimplePreview, buildWikiPreview, downloadDeliverable } from './exporters.js?v=18';
import { cleanModelMarkdown, escapeHtml, fileToBase64, getAdvisoryAuditViolations, getAuditBurden, getAuditViolations, getBlockingAuditViolations, hasAuditPassed, parseModelJson, renderMarkdown, validateWorldModule } from './utils.js?v=8';
import { addWorldTask, archiveWorld, createBlankWorld, deleteArchivedWorld, getWorld, initializeWorldStore, listWorlds, putWorld, restoreWorld } from './world-store.js?v=9';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const MODEL_SETTINGS_KEY = 'world-axiom-model-settings-v1';
const MODEL_CREDENTIALS_KEY = 'world-axiom-model-credentials-v1';

const state = {
  source: { mode: 'brief', brief: '', ipTier: '自动判断', book: null, research: null },
  purpose: '世界之书', skin: '自动判断', buildIntent: 'auto', dials: {}, tone: '自动判断', focuses: [],
  providers: [], config: {}, credentialProvider: '', modelRoute: null, availableModels: [], modelSetupBusy: false, manualModelMode: false, taskBrief: null, researchDossier: null, directionComparison: '', cards: [], selectedSeed: null, worldCanon: null,
  canonParts: {}, modules: {}, forgeApprovals: {}, forgeDrafts: {}, activeForgeBatch: null, forgeBusy: false, directionContinuityUpgradeRequired: false, sourceContinuityUpgradeRequired: false,
  world: '', audit: null, summary: '', art: [], exportTab: 'wiki',
  currentWorldId: '', activeLibraryWorldId: '', libraryWorlds: [],
};

const screens = ['library', 'input', 'research', 'cards', 'forge', 'audit', 'export'];
const workspaceSteps = ['input', 'research', 'cards', 'forge', 'export'];
const FORGE_BATCHES = ['L1', 'L2', 'L3', 'L4'];
const CANON_STEPS = ['C1', 'C2', 'C3', 'C4'];
const FORGE_FLOW_STEPS = [...CANON_STEPS, ...FORGE_BATCHES, 'AUDIT'];
const MAX_AUTONOMOUS_REPAIR_ATTEMPTS = 4;
const batchLabels = {
  C1: ['01 · 世界定位与边界', '主次世界 · 时空接入'], C2: ['02 · 规律与地方', '后果 · 边界 · 空间关系'],
  C3: ['03 · 历史与社会', '转折 · 居民 · 制度'], C4: ['04 · 日常与关键条目', '生活 · 名称 · 依据映射'],
  L1: ['05 · 世界概览', '前提 · 运转 · 常识'], L2: ['06 · 地方与历史', '关系 · 转折 · 当下'],
  L3: ['07 · 人们怎样生活', '社会 · 生计 · 日常'], L4: ['08 · 重要名称', '关键条目 · 关联 · 索引'],
  AUDIT: ['09 · 一致性审计', '正典 · 因果 · 语言'],
};
const forgeNodeDetails = {
  C1: ['确定世界定位与原著边界', '先确认这是怎样的世界、主次作品关系以及从哪个原著时空接入。'],
  C2: ['建立核心规律与地方关系', '只处理世界怎样运转、哪些地方重要，以及普通人能观察到什么后果。'],
  C3: ['连接历史、居民与制度', '只说明哪些历史形成今天、主要人群怎样生活、制度怎样影响普通人。'],
  C4: ['补足日常与关键条目', '补充具体日常、重要名称和研究依据映射；完成后合并为可供正文使用的世界正典。'],
  L1: ['建立整体认识与运转方式', '先说明延续哪部原著、处于哪个阶段，再解释世界怎样影响普通生活。'],
  L2: ['连接地方格局与历史因果', '沿用原著地点与事件顺序，说明历史怎样延续到今天。'],
  L3: ['补全居民生活与社会运行', '先复现原著已有民风与社会关系，只在资料缺口处补足日常细节。'],
  L4: ['整理关键名称与查阅条目', '保留原著专名，标清主次来源、相互关系和新增内容的理由。'],
};
function isOriginalWorld() {
  return state.taskBrief?.mode === 'original';
}

function forgeBatchLabel(batch) {
  if (!isOriginalWorld()) return batchLabels[batch];
  if (batch === 'C1') return ['01 · 世界定位与边界', '名称 · 根本事实'];
  if (batch === 'C4') return ['04 · 日常与关键条目', '生活 · 名称 · 当前矛盾'];
  return batchLabels[batch];
}

function forgeNodeDetail(batch) {
  if (!isOriginalWorld()) return forgeNodeDetails[batch];
  if (batch === 'C1') return ['确定世界定位与边界', '先确认这是怎样的世界、最根本的事实，以及本次要解释到什么范围。'];
  if (batch === 'C4') return ['补足日常与关键条目', '补充具体日常、重要名称、当前矛盾与未知；完成后合并为可供正文使用的世界正典。'];
  if (batch === 'L1') return ['建立整体认识与运转方式', '先让读者看懂这是怎样的世界，再解释核心规律怎样影响普通生活。'];
  if (batch === 'L2') return ['连接地方格局与历史因果', '说明各地怎样彼此依赖，以及历史转折怎样形成今天。'];
  if (batch === 'L3') return ['补全居民生活与社会运行', '通过主要居民、制度和普通人的一天，说明这个世界怎样被真实地生活。'];
  if (batch === 'L4') return ['整理关键名称与查阅条目', '整理不可缺少的地点、人群、制度、事件和事物，并说明它们的关系。'];
  return forgeNodeDetails[batch];
}
const seedGenerationStages = [
  ['理解任务', '由模型识别原创命题、单部作品、多作品或上传书籍'],
  ['读取故事资料', '读取模型选定的故事梗概、原文片段和公开资料'],
  ['整理故事材料', '梳理人物、地方、风物、民情和关键事件'],
  ['整理三个方向', '用同一批故事材料写出三份简短的呈现方案'],
  ['检查并保存', '确认输入、资料和边界进入结果后再开放选择'],
];
const seedStageLiveMessages = [
  ['正在识别作品、输入目的和需要保留的内容'],
  ['正在读取模型选定的具体资料页面'],
  ['正在整理故事情节、地点、人物、族群和事件', '正在压缩重复资料并保留最有价值的世界材料', '正在核对研究编号并确保结果完整保存'],
  [
    '正在为三个方向分配不同的原作材料组合',
    '正在为每个方向撰写约200字的呈现简介',
    '正在拉开三个方向的介绍视角和材料组合',
    '正在核对简介长度与研究材料编号',
    '模型仍在完成三份简短方向；返回后会立即校验并保存',
  ],
  ['正在检查三个方向并写入当前世界'],
];
const auditStages = [
  ['准备审计材料', '汇总世界正文、世界模型和事实底稿'],
  ['模型逐项检查', '检查自然规律、时空尺度、历史因果、资源与知识边界'],
  ['解析审计结果', '读取问题位置、影响和最小修补建议'],
  ['保存审计报告', '整理通过项并进入一致性审计页面'],
];
let detailedLoadingTimer = null;
let forgeNodeTimer = null;
let forgeDraftSaveTimer = null;
let forgeStreamBuffer = '';
let forgeStreamRenderFrame = null;
let seedLoadingStartedAt = 0;
let seedStageStartedAt = 0;
let activeSeedGenerationStage = 0;

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

function seedLiveMessage(stage, seconds) {
  const messages = seedStageLiveMessages[stage] || seedStageLiveMessages[0];
  const index = Math.min(messages.length - 1, Math.floor(seconds / 10));
  return messages[index];
}

function updateSeedLoadingClock() {
  const now = Date.now();
  const totalSeconds = Math.max(0, Math.floor((now - seedLoadingStartedAt) / 1_000));
  const stageSeconds = Math.max(0, Math.floor((now - seedStageStartedAt) / 1_000));
  $('#loadingElapsed').textContent = `总计 ${totalSeconds} 秒 · 本步骤 ${stageSeconds} 秒`;
  $('#loadingLive').textContent = seedLiveMessage(activeSeedGenerationStage, stageSeconds);
  if (activeSeedGenerationStage === 3) {
    $('#loadingAssurance').textContent = stageSeconds < 20
      ? '这里只生成三份约200字的选择简介，不会提前展开完整世界观。'
      : stageSeconds < 50
        ? '模型正在整理三种不同的呈现角度。收到结果后会检查研究材料是否被正确引用。'
        : '仍在运行，不是页面卡住。系统正在等待模型返回三份简短方向。';
  } else {
    $('#loadingAssurance').textContent = totalSeconds < 40
      ? '当前节点完成后会自动进入下一步，无需重复点击。'
      : '仍在运行，不是页面卡住；完整材料越多，模型整理所需时间越长。';
  }
}

function startSeedGenerationLoading(providerName, modelName) {
  showLoading('正在整理 3 个呈现方向', '简短请求已经送达模型，页面会持续显示真实等待时间。', 18);
  $('#loadingCard').classList.add('is-detailed');
  $('#loadingOperation').hidden = false;
  $('#loadingModel').textContent = `${providerName} · ${modelName || '默认模型'}`;
  $('#loadingTrack').dataset.mode = 'waiting';
  renderSeedLoadingStages(0);
  seedLoadingStartedAt = Date.now();
  seedStageStartedAt = seedLoadingStartedAt;
  activeSeedGenerationStage = 0;
  updateSeedLoadingClock();
  detailedLoadingTimer = window.setInterval(updateSeedLoadingClock, 1_000);
}

function advanceSeedGeneration(stage, title, detail, progress, waiting = stage < seedGenerationStages.length - 1) {
  if (stage !== activeSeedGenerationStage) seedStageStartedAt = Date.now();
  activeSeedGenerationStage = stage;
  renderSeedLoadingStages(stage);
  $('#loadingTrack').dataset.mode = waiting ? 'waiting' : 'progress';
  updateLoading(title, detail, progress);
  updateSeedLoadingClock();
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
  $('#generateFromResearch').disabled = busy;
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

function setResearchDirectionStatus(message = '', tone = 'progress') {
  const status = $('#researchDirectionStatus');
  status.textContent = message;
  status.hidden = !message;
  if (message) status.dataset.tone = tone;
  else delete status.dataset.tone;
}

function errorSentence(error) {
  return String(error?.message || error || '未知错误').replace(/[。！？\s]+$/g, '');
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
    const visibleStep = step === 'audit' ? 'forge' : step;
    const active = link.dataset.step === visibleStep;
    link.classList.toggle('is-active', active);
    link.toggleAttribute('aria-current', active);
    const linkIndex = workspaceSteps.indexOf(link.dataset.step);
    link.classList.toggle('is-complete', linkIndex < workspaceSteps.indexOf(visibleStep) && !link.disabled);
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
  const { apiKey: _apiKey, ...safeRoute } = state.modelRoute || {};
  const settings = {
    provider: $('#providerSelect').value,
    baseUrl: $('#baseUrlInput').value.trim(),
    model: selectedModelId(),
    temperature: Number($('#temperatureInput').value),
    protocol: $('#protocolSelect').value,
    route: state.modelRoute ? safeRoute : null,
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
  invalidateModelSetup('密钥已清除，请重新连接。');
  showToast('本机保存的模型密钥已清除。');
}

function snapshotForStorage(lastScreen) {
  return {
    source: { mode: state.source.mode, brief: state.source.brief, ipTier: state.source.ipTier, research: state.source.research },
    purpose: state.purpose, skin: state.skin, buildIntent: state.buildIntent,
    dials: state.dials, tone: state.tone, focuses: state.focuses,
    taskBrief: state.taskBrief, researchDossier: state.researchDossier, directionComparison: state.directionComparison,
    cards: state.cards, selectedSeed: state.selectedSeed, worldCanon: state.worldCanon, canonParts: state.canonParts, modules: state.modules,
    forgeApprovals: state.forgeApprovals, forgeDrafts: state.forgeDrafts, activeForgeBatch: state.activeForgeBatch,
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

function migrateLegacyResearchSnapshot(snapshot) {
  const legacy = snapshot?.sourceDossier;
  if (!legacy) return { taskBrief: null, researchDossier: null };
  const facts = Object.values(legacy.confirmed_facts || {}).flat().filter(Boolean);
  const reconstructing = legacy.mode === 'reconstruct';
  return {
    taskBrief: {
      schemaVersion: 'world-task/v2', mode: reconstructing ? 'uploaded_book' : 'original', works: [],
      objective: '继续旧版世界并建立世界之书', intendedUse: snapshot.purpose || '世界之书', scope: snapshot.dials?.scale || '由现有内容决定',
      mustPreserve: facts, mustAvoid: [], researchQuestions: [], interpretation: '从旧版事实底稿迁移，保留已有世界内容。',
    },
    researchDossier: {
      schemaVersion: 'world-research/v2', mode: reconstructing ? 'uploaded_book' : 'original', summary: legacy.source_summary || '从旧版事实底稿迁移。',
      narrativeElements: [], keyEvents: [], sourceImpressions: [], structuralFindings: [], mechanisms: [], confirmedFacts: facts, conflicts: legacy.contested || [], gaps: legacy.unknowns || [], designConstraints: [], references: legacy.references || [],
    },
  };
}

function migrateTaskContinuity(taskBrief) {
  if (!taskBrief || !['single_work', 'multi_work', 'uploaded_book'].includes(taskBrief.mode)) return taskBrief;
  const works = (taskBrief.works || []).map((work) => ({ ...work }));
  if (!works.length) return { ...taskBrief, deliveryMode: taskBrief.deliveryMode === 'reconstruct' ? 'reconstruct' : 'source_expand' };
  const primaryIndex = Math.max(0, works.findIndex((work) => work.role === 'primary'));
  works.forEach((work, index) => { work.role = index === primaryIndex ? 'primary' : 'secondary'; });
  const primaryWork = works[primaryIndex]?.title || '';
  const secondaryWorks = works.filter((_, index) => index !== primaryIndex).map((work) => work.title).filter(Boolean);
  return {
    ...taskBrief,
    schemaVersion: 'world-task/v4',
    deliveryMode: taskBrief.deliveryMode === 'reconstruct' ? 'reconstruct' : 'source_expand',
    works,
    primaryWork,
    secondaryWorks,
    fusionPlan: taskBrief.mode === 'multi_work' ? {
      primaryWorld: taskBrief.fusionPlan?.primaryWorld || primaryWork,
      secondaryWorlds: taskBrief.fusionPlan?.secondaryWorlds?.length ? taskBrief.fusionPlan.secondaryWorlds : secondaryWorks,
      timeSpaceCorrespondence: taskBrief.fusionPlan?.timeSpaceCorrespondence || works.filter((work) => work.role === 'secondary').map((work) => work.entryPoint).filter(Boolean).join('；'),
      precedence: taskBrief.fusionPlan?.precedence || `《${primaryWork}》的既有时空、历史和人物关系优先；次世界只通过明确接入点补足内容。`,
    } : taskBrief.fusionPlan,
  };
}

function splitWorldCanon(canon) {
  if (!canon) return {};
  return {
    C1: {
      identity: { name: canon.identity?.name || '', one_line: canon.identity?.oneLine || canon.identity?.one_line || '', thesis: canon.identity?.thesis || '' },
      source_plan: {
        policy: canon.sourcePlan?.policy || 'source_first', primary_work: canon.sourcePlan?.primaryWork || '', secondary_works: canon.sourcePlan?.secondaryWorks || [],
        time_space_correspondence: canon.sourcePlan?.timeSpaceCorrespondence || '', precedence: canon.sourcePlan?.precedence || '',
      },
    },
    C2: { axioms: canon.axioms || [], spatial_order: canon.spatialOrder || { overview: '', regions: [], relations: [] } },
    C3: { history: (canon.history || []).map((item) => ({ ...item, present_traces: item.presentTraces || item.present_traces || [] })), societies: canon.societies || [], institutions: canon.institutions || [] },
    C4: {
      daily_life: (canon.dailyLife || []).map((item) => ({ ...item, depends_on: item.dependsOn || item.depends_on || [] })), entities: canon.entities || [],
      source_continuity: (canon.sourceContinuity || []).map((item) => ({ ...item, research_id: item.researchId || item.research_id, canon_refs: item.canonRefs || item.canon_refs || [], time_space_correspondence: item.timeSpaceCorrespondence || item.time_space_correspondence || '', extension_reason: item.extensionReason || item.extension_reason || '' })),
      extensions: canon.extensions || [],
      tensions: canon.tensions || [], unknowns: canon.unknowns || [], evidence_policy: canon.evidencePolicy || '',
    },
  };
}

function applyBlueprint(record) {
  const blueprint = record.blueprint || {};
  state.taskBrief = null; state.researchDossier = null; state.directionComparison = ''; state.cards = []; state.selectedSeed = null; state.worldCanon = null; state.canonParts = {}; state.modules = {};
  state.forgeApprovals = {}; state.forgeDrafts = {}; state.activeForgeBatch = null; state.forgeBusy = false; state.directionContinuityUpgradeRequired = false; state.sourceContinuityUpgradeRequired = false;
  state.world = ''; state.audit = null; state.summary = ''; state.art = []; state.exportTab = 'wiki';
  ['research', 'cards', 'forge', 'audit', 'export'].forEach((step) => setStepEnabled(step, false));
  state.currentWorldId = record.id;
  state.buildIntent = blueprint.buildIntent || 'auto';
  state.source = { mode: 'brief', brief: blueprint.brief || '', ipTier: blueprint.ipTier || '自动判断', book: null, research: null };
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
  renderCanonPanel();
  hideForgeActivity();
  hideForgeReview();
  refreshWorldPreview('waiting');
  $('#projectState').textContent = `${record.title} · 正在生长`;
}

function restoreSnapshot(record) {
  applyBlueprint(record);
  const snapshot = record.snapshot;
  if (!snapshot) return 'input';
  Object.assign(state, snapshot, { currentWorldId: record.id });
  state.source = { mode: 'brief', brief: '', ipTier: '自动判断', book: null, research: null, ...(snapshot.source || {}) };
  const legacyResearch = migrateLegacyResearchSnapshot(snapshot);
  state.taskBrief = migrateTaskContinuity(snapshot.taskBrief || legacyResearch.taskBrief);
  state.researchDossier = snapshot.researchDossier || legacyResearch.researchDossier;
  state.directionComparison = snapshot.directionComparison || '';
  state.worldCanon = snapshot.worldCanon || null;
  state.canonParts = snapshot.canonParts || (state.worldCanon ? splitWorldCanon(state.worldCanon) : {});
  state.sourceContinuityUpgradeRequired = Boolean(
    state.worldCanon
    && ['single_work', 'multi_work', 'uploaded_book'].includes(state.taskBrief?.mode)
    && !state.worldCanon.sourceContinuity?.length
  );
  state.cards = (snapshot.cards || []).map(normalizeCard);
  state.directionContinuityUpgradeRequired = Boolean(
    state.cards.length
    && ['single_work', 'multi_work', 'uploaded_book'].includes(state.taskBrief?.mode)
    && state.cards.some((card) => !card.primary_continuity || card.construction_mode === 'original')
  );
  state.selectedSeed = snapshot.selectedSeed ? normalizeCard(snapshot.selectedSeed, state.cards.findIndex((card) => card.seed_id === snapshot.selectedSeed.seed_id)) : null;
  state.modules = snapshot.modules || {};
  const legacyCanonApproved = Boolean(snapshot.forgeApprovals?.CANON);
  state.forgeApprovals = snapshot.forgeApprovals ? { ...snapshot.forgeApprovals } : {
    ...(state.worldCanon ? Object.fromEntries(CANON_STEPS.map((batch) => [batch, true])) : {}),
    ...Object.fromEntries(FORGE_BATCHES.filter((batch) => state.modules[batch]).map((batch) => [batch, true])),
  };
  if (legacyCanonApproved) CANON_STEPS.forEach((batch) => { state.forgeApprovals[batch] = true; });
  delete state.forgeApprovals.CANON;
  if (state.sourceContinuityUpgradeRequired) CANON_STEPS.forEach((batch) => delete state.forgeApprovals[batch]);
  state.forgeDrafts = snapshot.forgeDrafts || {};
  state.activeForgeBatch = snapshot.activeForgeBatch || null;
  state.forgeBusy = false;
  state.world = snapshot.world || ''; state.audit = snapshot.audit; state.summary = snapshot.summary || '';
  const completeInterruptedAudit = Boolean(state.world && state.audit && !state.summary
    && (state.audit.verification_pending || state.audit.accepted || hasAuditPassed(state.audit)));
  if (completeInterruptedAudit) {
    state.audit = {
      ...state.audit, accepted: true, verification_pending: false, status: '已接受当前版本',
      untapped_potential: state.audit.verification_pending
        ? '上次修补后的复核被网络中断；正文已经保留，本次直接恢复为可使用版本。'
        : (state.audit.untapped_potential || '当前审计没有必须处理的矛盾。'),
    };
    state.summary = buildLocalSummary(state.world);
  }
  if (state.researchDossier) { renderResearchWorkspace(); setStepEnabled('research'); }
  if (state.cards.length) { renderSeedCards(); setStepEnabled('cards'); }
  if (state.selectedSeed) {
    updateProjectState(state.selectedSeed); setStepEnabled('forge'); renderCanonPanel(); rebuildApprovedWorld();
    const reviewableSteps = FORGE_FLOW_STEPS.slice(0, -1);
    const pendingBatch = reviewableSteps.find((batch) => !forgeBatchApproved(batch));
    if (pendingBatch && forgeBatchHasContent(pendingBatch)) {
      renderForgeReview(pendingBatch);
      $('#resumeForge').hidden = true;
    } else if (pendingBatch) {
      const progressIndex = FORGE_FLOW_STEPS.indexOf(pendingBatch);
      renderForgeProgress(FORGE_FLOW_STEPS, progressIndex);
      showForgeNode(pendingBatch, progressIndex, 'paused');
      $('#resumeForge').hidden = false;
    } else {
      renderForgeProgress(FORGE_FLOW_STEPS, state.audit ? FORGE_FLOW_STEPS.length : FORGE_FLOW_STEPS.length - 1);
      showForgeAuditState(state.audit ? 'complete' : 'error', state.audit ? '' : '正文已经确认，但一致性审计尚未完成。');
      $('#resumeForge').hidden = Boolean(state.audit);
    }
  }
  if (state.audit) { renderAudit(); setStepEnabled('audit'); }
  if (state.summary) { renderExport(); setStepEnabled('export'); }
  if (completeInterruptedAudit) return 'export';
  if (state.directionContinuityUpgradeRequired) return 'cards';
  if (state.sourceContinuityUpgradeRequired) return 'forge';
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
    <div class="world-detail-meta"><div><span>构建方式</span><strong>${world.seed?.construction_mode === 'reconstruct' ? '还原已有世界' : world.seed?.construction_mode === 'source_expand' ? '原著连续性扩展' : '创造新世界'}</strong></div><div><span>当前状态</span><strong>${escapeHtml(statusLabels[world.status] || '进行中')}</strong></div><div><span>最近更新</span><strong>${escapeHtml(updated)}</strong></div></div>
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
  if (target === 'export' && state.audit?.accepted && state.summary) await saveCurrentWorld('export');
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
  if (index <= screens.indexOf('research')) { state.taskBrief = null; state.researchDossier = null; state.directionComparison = ''; }
  if (index <= screens.indexOf('cards')) state.cards = [];
  if (index <= screens.indexOf('forge')) {
    state.selectedSeed = null; state.worldCanon = null; state.canonParts = {}; state.modules = {}; state.world = '';
    state.forgeApprovals = {}; state.forgeDrafts = {}; state.activeForgeBatch = null; state.forgeBusy = false;
  }
  if (index <= screens.indexOf('audit')) state.audit = null;
  if (index <= screens.indexOf('export')) { state.summary = ''; state.art = []; }
  screens.slice(index).forEach((step) => setStepEnabled(step, false));
  if (index <= screens.indexOf('forge')) {
    $('#forgeTitle').textContent = '世界正在被解释清楚';
    $('#forgeProgress').innerHTML = '';
    renderCanonPanel();
    hideForgeActivity();
    hideForgeReview();
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
    research: null,
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

function normalizedRoutePart(value) {
  return String(value ?? '').trim().replace(/\/$/, '');
}

function modelRouteMatches(route, config) {
  if (!route || !config) return false;
  return route.provider === config.provider
    && normalizedRoutePart(route.baseUrl) === normalizedRoutePart(config.baseUrl)
    && route.model === config.model
    && (route.protocol || '') === (config.protocol || '')
    && (route.transport || 'api') === (config.transport || 'api');
}

function setModelSetupStatus(title, detail, tone = 'idle') {
  const status = $('#modelSetupStatus');
  status.dataset.tone = tone;
  status.querySelector('strong').textContent = title;
  status.querySelector('span').textContent = detail;
}

function updateModelSetupSteps(stage = 'credentials', complete = false) {
  const order = ['credentials', 'models', 'test'];
  const current = order.indexOf(stage);
  $$('.model-setup-steps li').forEach((item, index) => {
    item.classList.toggle('is-active', !complete && index === current);
    item.classList.toggle('is-complete', complete || index < current);
  });
}

function invalidateModelSetup(message = '配置已变化，请重新读取模型并测试。') {
  state.modelRoute = null;
  $('#saveSettings').disabled = true;
  setModelSetupStatus('等待重新验证', message, 'idle');
  updateModelSetupSteps('credentials');
}

function setModelSetupBusy(button, busy) {
  state.modelSetupBusy = busy;
  $('#discoverModels').disabled = busy;
  $('#testModelConnection').disabled = busy;
  button?.classList.toggle('is-busy', busy);
}

function updateProviderFields() {
  const provider = $('#providerSelect').value;
  const preset = state.providers.find((item) => item.id === provider) ?? {};
  const isCli = preset.transport === 'claude-cli';
  $('#apiConnectionFields').hidden = isCli;
  $('#claudeCliConnection').hidden = !isCli;
  $('#protocolField').hidden = provider !== 'custom';
  $('#modelHint').textContent = isCli
    ? '已包含完整官方别名、百万上下文入口和本机自定义映射；也可直接输入完整模型名，最终权限以连接测试为准。'
    : '列表来自当前账号与端点，不使用内置的过期清单。';
}

function selectedModelId() {
  return (state.manualModelMode ? $('#manualModelInput').value : $('#modelInput').value).trim();
}

function setManualModelMode(enabled, value = '') {
  state.manualModelMode = enabled;
  $('#manualModelField').hidden = !enabled;
  $('#modelInput').disabled = enabled;
  $('#toggleManualModel').textContent = enabled ? '返回模型列表' : '手动填写完整模型名';
  if (enabled && value) $('#manualModelInput').value = value;
}

function setModelSelectValue(value = '') {
  const select = $('#modelInput');
  if (value && ![...select.options].some((option) => option.value === value)) select.add(new Option(value, value));
  select.value = value;
}

function renderAvailableModels(models) {
  state.availableModels = [...models].sort((a, b) => a.id.localeCompare(b.id));
  const current = selectedModelId();
  $('#modelInput').innerHTML = `<option value="">请选择模型…</option>${state.availableModels.map((item) => {
    const label = item.name && item.name !== item.id ? `${item.name} — ${item.id}` : item.id;
    return `<option value="${escapeHtml(item.id)}">${escapeHtml(label)}</option>`;
  }).join('')}`;
  setManualModelMode(false);
  setModelSelectValue(state.availableModels.some((item) => item.id === current) ? current : '');
  $('#modelCount').textContent = `已读取 ${state.availableModels.length.toLocaleString('zh-CN')} 个模型`;
}

async function discoverAvailableModels({ automatic = false } = {}) {
  if (state.modelSetupBusy) return;
  const button = $('#discoverModels');
  setModelSetupBusy(button, true);
  setModelSetupStatus('正在读取模型', '正在验证端点与账号，并获取这个账号可用的模型列表。', 'progress');
  updateModelSetupSteps('credentials');
  try {
    const result = await api.discoverModels(modelConfig());
    renderAvailableModels(result.models || []);
    if (result.status) {
      const subscription = result.status.subscriptionType ? ` · ${result.status.subscriptionType}` : '';
      $('#claudeCliSummary').textContent = `Claude Code ${result.status.version} 已登录${subscription}，未读取或复制登录凭证。`;
    }
    const selected = selectedModelId();
    if (selected && !state.availableModels.some((item) => item.id === selected)) setModelSelectValue('');
    setModelSetupStatus('模型列表已就绪', `请选择一个模型。共读取 ${state.availableModels.length.toLocaleString('zh-CN')} 个。`, 'success');
    updateModelSetupSteps('models');
  } catch (error) {
    renderAvailableModels([]);
    setModelSetupStatus('读取失败', error.message, 'error');
    updateModelSetupSteps('credentials');
    if (!automatic) showToast(error.message, 6_000);
  } finally {
    setModelSetupBusy(button, false);
  }
}

async function testSelectedModel() {
  if (state.modelSetupBusy) return;
  const selected = selectedModelId();
  if (!selected) {
    setModelSetupStatus('还没有选择模型', '请先读取列表并选择一个模型。', 'error');
    return;
  }
  const button = $('#testModelConnection');
  setModelSetupBusy(button, true);
  setModelSetupStatus('正在测试连接', `正在向 ${selected} 发送一条极短请求，并检查参数兼容性。`, 'progress');
  updateModelSetupSteps('test');
  try {
    const result = await api.testModelConnection(modelConfig());
    state.modelRoute = { ...result.correctedConfig, verifiedAt: result.testedAt };
    $('#baseUrlInput').value = state.modelRoute.baseUrl || '';
    if (state.modelRoute.protocol && $('#providerSelect').value === 'custom') $('#protocolSelect').value = state.modelRoute.protocol;
    $('#saveSettings').disabled = false;
    setModelSetupStatus('连接测试通过', result.message, 'success');
    updateModelSetupSteps('test', true);
  } catch (error) {
    state.modelRoute = null;
    $('#saveSettings').disabled = true;
    setModelSetupStatus('连接测试失败', error.message, 'error');
    updateModelSetupSteps('test');
  } finally {
    setModelSetupBusy(button, false);
  }
}

function modelConfig() {
  const provider = $('#providerSelect').value;
  const preset = state.providers.find((item) => item.id === provider) ?? {};
  const current = {
    provider,
    protocol: provider === 'custom' ? $('#protocolSelect').value : preset.protocol,
    transport: preset.transport || 'api',
    apiStyle: preset.apiStyle,
    tokenParameter: preset.tokenParameter,
    systemRole: preset.systemRole,
    baseUrl: $('#baseUrlInput').value.trim(),
    model: selectedModelId(),
    apiKey: normalizeApiKey($('#apiKeyInput').value),
    temperature: Number($('#temperatureInput').value),
  };
  if (modelRouteMatches(state.modelRoute, current)) return { ...current, ...state.modelRoute, apiKey: current.apiKey, temperature: current.temperature };
  return current;
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
  if (!modelRouteMatches(state.modelRoute, config) || !state.modelRoute?.verifiedAt) {
    if (!$('#settingsDialog').open) $('#settingsDialog').showModal();
    throw new Error('当前模型还没有通过连接测试。请在“模型与接口”中完成验证并保存启用。');
  }
  if (config.transport === 'claude-cli') return config;
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

function normalizeReadableItems(value, fallback = []) {
  const items = Array.isArray(value) ? value : [];
  const normalized = items.map((item) => {
    if (typeof item === 'string') return compactCardText(item, '', 500);
    const name = compactCardText(item?.name || item?.title, '', 100);
    const detail = compactCardText(item?.description || item?.detail || item?.fact, '', 400);
    return name && detail ? `${name}：${detail}` : name || detail;
  }).filter(Boolean);
  return normalized.length ? normalized.slice(0, 6) : fallback.filter(Boolean).slice(0, 6);
}

function normalizeSourceTreatments(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    source: compactCardText(item?.source || item?.work, '', 100),
    retained: compactCardText(item?.retained || item?.kept, '', 500),
    transformed: compactCardText(item?.transformed || item?.changed, '', 500),
    visibleResult: compactCardText(item?.visibleResult || item?.visible_result || item?.result, '', 500),
  })).filter((item) => item.source && (item.retained || item.transformed || item.visibleResult)).slice(0, 6);
}

function normalizeResearchRoots(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    researchId: compactCardText(item?.researchId || item?.research_id || item?.id, '', 60),
    kind: item?.kind === 'key_event' ? 'key_event' : 'story_element',
    category: compactCardText(item?.category, '', 80),
    source: compactCardText(item?.source || item?.work, '', 120),
    name: compactCardText(item?.name || item?.title, '', 140),
    newName: compactCardText(item?.newName || item?.new_name || item?.adaptedName || item?.adapted_name, '', 140),
    researchContent: compactCardText(item?.researchContent || item?.research_content || item?.description, '', 800),
    transformation: compactCardText(item?.transformation || item?.transformed || item?.changed, '', 700),
    visibleResult: compactCardText(item?.visibleResult || item?.visible_result || item?.result, '', 700),
  })).filter((item) => item.researchId && item.name && item.transformation && item.visibleResult).slice(0, 8);
}

function normalizeResearchRefs(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    researchId: compactCardText(typeof item === 'string' ? item : item?.researchId || item?.research_id || item?.id, '', 60),
    kind: item?.kind === 'key_event' ? 'key_event' : 'story_element',
    category: compactCardText(item?.category, '', 80),
    source: compactCardText(item?.source || item?.work, '', 120),
    name: compactCardText(item?.name || item?.title, '', 140),
  })).filter((item) => item.researchId && item.name).slice(0, 12);
}

function normalizeSourceFoundations(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    source: compactCardText(item?.source || item?.work, '', 100),
    plot: compactCardText(item?.plot, '', 700),
    geography: normalizeReadableItems(item?.geography),
    peoples: normalizeReadableItems(item?.peoples || item?.races),
    factions: normalizeReadableItems(item?.factions || item?.institutions),
    dailyLife: normalizeReadableItems(item?.dailyLife || item?.daily_life),
    recombination: compactCardText(item?.recombination || item?.transformation, '', 800),
  })).filter((item) => item.source).slice(0, 6);
}

function normalizeSecondaryIntegration(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    source: compactCardText(item?.source || item?.work, '', 100),
    entryPoint: compactCardText(item?.entryPoint || item?.entry_point, '', 600),
    retained: compactCardText(item?.retained || item?.preserved, '', 700),
  })).filter((item) => item.source && item.entryPoint).slice(0, 6);
}

function normalizeCard(card, index) {
  const fallback = `card-${index + 1}`;
  const constructionMode = card?.construction_mode || state.taskBrief?.deliveryMode || (state.buildIntent === 'reconstruct' ? 'reconstruct' : 'original');
  const evidence = card?.evidence ?? {};
  return {
    seed_id: card?.seed_id || fallback,
    name: String(card?.name || `候选世界 ${index + 1}`).slice(0, 30),
    one_line: card?.one_line || '一个尚待展开的世界。',
    construction_mode: constructionMode,
    model_type: card?.model_type || card?.paradox_type || '综合演化型',
    world_thesis: card?.world_thesis || card?.one_line || '这个世界的存在方式尚待展开。',
    overview: compactCardText(card?.overview || card?.world_thesis || card?.one_line, '这是一个尚待选择并展开的世界方向。', 1_200),
    primary_continuity: compactCardText(card?.primary_continuity || card?.primaryContinuity, '', 900),
    secondary_integration: normalizeSecondaryIntegration(card?.secondary_integration || card?.secondaryIntegration),
    design_logic: compactCardText(card?.design_logic || card?.synthesis_note, '', 220),
    causal_chain: Array.isArray(card?.causal_chain) ? card.causal_chain.map((item) => compactCardText(item, '', 100)).filter(Boolean).slice(0, 6) : [],
    signature_features: normalizeReadableItems(card?.signature_features, [
      card?.overview_facets?.foundation,
      card?.overview_facets?.change,
      card?.overview_facets?.civilization || card?.civilization_pattern,
    ]),
    source_treatment: normalizeSourceTreatments(card?.source_treatment),
    source_foundations: normalizeSourceFoundations(card?.source_foundations || card?.sourceFoundations),
    research_roots: normalizeResearchRoots(card?.research_roots || card?.researchRoots),
    research_refs: normalizeResearchRefs(card?.research_refs || card?.researchRefs || card?.research_roots || card?.researchRoots),
    places_and_peoples: normalizeReadableItems(card?.places_and_peoples, [
      ...(card?.world_anchors?.places || []), ...(card?.world_anchors?.peoples || []),
    ]),
    customs_and_life: normalizeReadableItems(card?.customs_and_life, card?.world_anchors?.flora_fauna_goods_customs || []),
    defining_events: normalizeReadableItems(card?.defining_events, card?.world_anchors?.historical_events || []),
    current_situation: compactCardText(card?.current_situation || card?.overview_facets?.change, '', 700),
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
  const task = state.taskBrief ?? {};
  const reconstructing = task.deliveryMode === 'reconstruct';
  const extending = task.deliveryMode === 'source_expand';
  const findingCount = (state.researchDossier?.narrativeElements?.length || 0) + (state.researchDossier?.keyEvents?.length || 0);
  const chips = [
    `<span class="triage-chip is-primary">${extending ? '原著优先 · 在缺口处扩展' : reconstructing ? '只还原已有世界' : '创造新世界'}</span>`,
    `<span class="triage-chip">范围：${escapeHtml(task.scope || state.dials.scale || '由系统判断')}</span>`,
    `<span class="triage-chip">${extending ? `主世界：${escapeHtml(task.primaryWork || '待确认')} · 次世界：${escapeHtml((task.secondaryWorks || []).join('、') || '无')}` : reconstructing ? '同一故事世界 · 3 种介绍方向' : '3 份世界方向 · 选择后展开'}</span>`,
  ];
  if (state.directionContinuityUpgradeRequired) chips.unshift('<span class="triage-chip is-warning">旧版方向没有逐项承接原著，请点击“重新建模”后再选择</span>');
  if (findingCount) chips.push(`<span class="triage-chip">故事材料：${findingCount} 项</span>`);
  if (state.researchDossier?.references?.length) chips.push(`<span class="triage-chip">公开资料：${state.researchDossier.references.length} 组</span>`);
  $('#triageStrip').innerHTML = chips.join('');
}

function renderResearchWorkspace() {
  const task = state.taskBrief || {};
  const dossier = state.researchDossier || {};
  const modeLabels = { original: '原创世界', single_work: '单部作品还原', multi_work: '多作品故事融合', uploaded_book: '上传书籍还原' };
  const works = (task.works || []).map((work) => `${work.role === 'primary' ? '主世界' : '次世界'}《${escapeHtml(work.title)}》`).join('、');
  $('#taskBriefPanel').innerHTML = `<div class="research-card-heading"><span>任务理解</span><strong>${escapeHtml(modeLabels[task.mode] || '世界研究')}</strong></div>
    <h3>${escapeHtml(task.objective || '建立一份世界之书')}</h3>
    ${works ? `<p class="research-works">识别对象：${works}</p>` : ''}
    <dl><div><dt>使用目的</dt><dd>${escapeHtml(task.intendedUse || state.purpose)}</dd></div><div><dt>研究范围</dt><dd>${escapeHtml(task.scope || '由材料决定')}</dd></div></dl>
    ${task.mode === 'multi_work' ? `<p class="research-interpretation"><strong>时空接入：</strong>${escapeHtml(task.fusionPlan?.timeSpaceCorrespondence || '尚未说明')}<br><strong>主次原则：</strong>${escapeHtml(task.fusionPlan?.precedence || '主世界事实优先')}</p>` : ''}
    ${task.interpretation ? `<p class="research-interpretation">${escapeHtml(task.interpretation)}</p>` : ''}`;
  $('#researchSummary').textContent = dossier.summary || '尚未形成研究结论。';
  $('#researchImpressions').innerHTML = (dossier.sourceImpressions || []).map((item) => `<article><strong>${escapeHtml(item.source)}</strong><p>${escapeHtml(item.presentation)}</p>${item.memorableContent?.length ? `<small>${item.memorableContent.map((text) => escapeHtml(text)).join(' · ')}</small>` : ''}</article>`).join('');
  const evidenceLabel = (id) => {
    const reference = (dossier.references || []).find((item) => item.id === id);
    if (!reference) return '已核对资料';
    return reference.workTitle ? `${reference.workTitle} · ${reference.title}` : reference.title;
  };
  $('#researchQuestionAnswers').innerHTML = (dossier.questionAnswers || []).map((item) => `<article><strong>${escapeHtml(item.question)}</strong><p>${escapeHtml(item.answer)}</p>${item.evidence?.length ? `<small>依据：${[...new Set(item.evidence.map(evidenceLabel))].map((label) => escapeHtml(label)).join(' · ')}</small>` : ''}</article>`).join('') || '<p class="research-empty">这次任务没有单列研究问题。</p>';
  $('#researchPlotArcs').innerHTML = (dossier.plotArcs || []).map((arc) => `<article><header><span>《${escapeHtml(arc.source)}》</span><p>${escapeHtml(arc.startingSituation)}</p></header><ol>${(arc.stages || []).map((stage) => `<li><strong>${escapeHtml(stage.name)}</strong><p>${escapeHtml(stage.summary)}</p>${stage.places?.length ? `<small>地域：${stage.places.map((place) => escapeHtml(place)).join(' · ')}</small>` : ''}</li>`).join('')}</ol><footer><span>结局后的局面</span><p>${escapeHtml(arc.endingSituation)}</p></footer></article>`).join('') || '<p class="research-empty">尚未还原出从开端到结局的原作情节。</p>';
  const narrativeElements = dossier.narrativeElements?.length ? dossier.narrativeElements : (dossier.structuralFindings || []).map((item) => ({ category: item.dimension, name: item.finding, description: '', storyFunction: '', confidence: item.confidence }));
  const keyEvents = dossier.keyEvents?.length ? dossier.keyEvents : (dossier.mechanisms || []).map((item) => ({ name: item.name, description: item.description, worldRevealed: item.consequences?.join('；') }));
  $('#researchFindings').innerHTML = narrativeElements.map((item) => `<article><span>${escapeHtml([item.category || '故事内容', item.source ? `《${item.source}》` : ''].filter(Boolean).join(' · '))}</span><strong>${escapeHtml(item.name)}</strong>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}${item.storyFunction ? `<small>${escapeHtml(item.storyFunction)}</small>` : ''}${item.transferableValue ? `<small class="transfer-value">可用于方向：${escapeHtml(item.transferableValue)}</small>` : ''}</article>`).join('') || '<p class="research-empty">现有材料还没有整理出具体的人物、地方或风物。</p>';
  $('#researchMechanisms').innerHTML = keyEvents.map((item) => `<article><span>${escapeHtml(item.source ? `《${item.source}》` : '关键事件')}</span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description)}</p>${item.worldRevealed ? `<small>${escapeHtml(item.worldRevealed)}</small>` : ''}${item.transferableValue ? `<small class="transfer-value">可用于方向：${escapeHtml(item.transferableValue)}</small>` : ''}${item.consequences?.length ? `<ul>${item.consequences.map((text) => `<li>${escapeHtml(text)}</li>`).join('')}</ul>` : ''}</article>`).join('') || '<p class="research-empty">现有材料还没有整理出可核对的关键事件。</p>';
  $('#researchReferences').innerHTML = (dossier.references || []).map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(item.workTitle ? `${item.workTitle} · ${item.title}` : item.title)}</strong><span>${escapeHtml([item.provider, item.kind].filter(Boolean).join(' · '))}</span></a>`).join('') || '<p class="research-empty">本次为原创命题或上传材料，没有调用外部公开资料。</p>';
  const boundaries = [...(dossier.conflicts || []), ...(dossier.gaps || []), ...(dossier.designConstraints || [])];
  $('#researchGaps').innerHTML = boundaries.length ? boundaries.map((item) => `<li>${escapeHtml(item)}</li>`).join('') : '<li>没有额外资料缺口；后续仍只按世界正典写作。</li>';
}

function renderSeedCards() {
  renderTriage();
  $('#seedCardGrid').innerHTML = state.cards.map((card, index) => `
    <article class="seed-card" data-number="0${index + 1}">
      <header class="seed-card-head"><span class="seed-type">呈现方向 ${String(index + 1).padStart(2, '0')} · ${card.construction_mode === 'reconstruct' ? '整理原著世界' : card.construction_mode === 'source_expand' ? '原著连续性扩展' : '原创世界'}</span><h3>${escapeHtml(card.name)}</h3><p>${escapeHtml(card.one_line)}</p></header>
      <div class="seed-overview">${String(card.overview).split(/\n+/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div>
      ${card.primary_continuity ? `<section class="direction-continuity"><h4>主世界连续性</h4><p>${escapeHtml(card.primary_continuity)}</p>${card.secondary_integration.map((item) => `<article><strong>次世界《${escapeHtml(item.source)}》</strong><span>${escapeHtml(item.entryPoint)}</span><small>${escapeHtml(item.retained)}</small></article>`).join('')}</section>` : ''}
      ${card.research_refs.length ? `<section class="direction-materials"><h4>重点承接的原著内容</h4><div>${card.research_refs.map((item) => `<span>${escapeHtml([item.source ? `《${item.source}》` : '', item.name].filter(Boolean).join(' · '))}</span>`).join('')}</div></section>` : ''}
      <div class="candidate-next-step"><span>选择之后</span><strong>${card.construction_mode === 'original' ? '分步建立并审核这个世界' : '先复现原著，再补足缺口'}</strong><small>${card.construction_mode === 'original' ? '从世界定位开始，逐步建立地方、居民、历史与日常生活' : '原著专名、事件和时间顺序继续保留；新增内容必须说明依据'}</small></div>
      <button class="primary-button select-seed" type="button" data-card-index="${index}" ${state.directionContinuityUpgradeRequired ? 'disabled' : ''}><span>${state.directionContinuityUpgradeRequired ? '请先重新建模这个方向' : `选择「${escapeHtml(card.name)}」这个方向`}</span><svg><use href="#i-arrow"/></svg></button>
    </article>`).join('');
}

function updateProjectState(seed) {
  if (!seed) return;
  $('#projectState').textContent = `${seed.name} · ${seed.model_type}`;
}

async function handleGenerateSeeds() {
  try {
    clearGenerationStatus();
    setResearchDirectionStatus();
    collectInputs(); validateSource();
    const config = validateLiveConfig(modelConfig());
    const providerName = $('#providerSelect option:checked')?.textContent || '真实模型';
    setSeedGenerationBusy(true);
    startSeedGenerationLoading(providerName, config.model);
    if (!state.currentWorldId) {
      const project = await createBlankWorld();
      state.currentWorldId = project.id;
    }
    resetDownstream('research');
    const sourcePayload = { ...state.source, bookSample: state.source.book?.sample, purpose: state.purpose };
    setGenerationStatus(`正在通过${providerName}理解任务、收集资料并建立三个世界方向。`);

    advanceSeedGeneration(0, '正在理解你的任务', '模型会识别作品与目标，不再由固定名称规则猜测。', 12);
    const understood = await api.understandTask({ source: sourcePayload, purpose: state.purpose, buildIntent: state.buildIntent, dials: state.dials, tone: state.tone, focuses: state.focuses, skin: state.skin }, config);
    state.taskBrief = understood.taskBrief;

    advanceSeedGeneration(1, '正在读取模型选定的资料', '模型已经识别作品、别名和具体资料目标；程序只读取这些页面，不再自行拆词或猜名称。', 30);
    const retrieved = await api.retrieveSources(state.taskBrief, sourcePayload, config);
    if (retrieved.taskBrief) state.taskBrief = retrieved.taskBrief;
    state.source.research = retrieved.research;

    advanceSeedGeneration(2, '正在整理故事材料', '梳理故事梗概、人物与群体、地方风物、民风日常和关键事件。', 50);
    const analyzed = await api.analyzeResearch(state.taskBrief, sourcePayload, retrieved.research, config);
    state.researchDossier = analyzed.researchDossier;
    if (!state.researchDossier?.summary || (!state.researchDossier.narrativeElements?.length && !state.researchDossier.keyEvents?.length && !state.researchDossier.confirmedFacts?.length)) {
      throw new Error('资料研究没有整理出可用的故事内容，系统已停止生成空泛方向。');
    }
    renderResearchWorkspace(); setStepEnabled('research'); await saveCurrentWorld('research');

    advanceSeedGeneration(3, '正在整理三个呈现方向', '每个方向只写约200字简介，说明准备怎样使用现有材料介绍这个世界。', 72);
    const result = await api.generateDirections({
      source: sourcePayload, taskBrief: state.taskBrief, researchDossier: state.researchDossier,
      purpose: state.purpose, skin: state.skin, dials: state.dials, tone: state.tone, focuses: state.focuses,
    }, config);
    state.directionComparison = result.comparison || '';
    state.cards = result.cards.map(normalizeCard);
    state.directionContinuityUpgradeRequired = false;
    advanceSeedGeneration(4, '三个呈现方向已经完成', '三份简短简介和研究依据已经保存，即将进入选择页面。', 100);
    clearGenerationStatus();
    renderSeedCards(); setStepEnabled('cards'); navigate('cards'); await saveCurrentWorld('cards');
  } catch (error) {
    setGenerationStatus(`生成未完成：${error.message}`, 'error');
    if (state.researchDossier) {
      setResearchDirectionStatus(`三个方向没有生成：${errorSentence(error)}。研究资料已经保留，可以直接再次生成方向。`, 'error');
      navigate('research');
    }
    showToast(error.message, 12_000);
  }
  finally { setSeedGenerationBusy(false); hideLoading(); }
}

async function regenerateDirectionsFromResearch() {
  if (!state.taskBrief || !state.researchDossier) return handleGenerateSeeds();
  try {
    clearGenerationStatus();
    setResearchDirectionStatus('正在根据现有研究整理三份约 200 字的呈现方向。研究资料会保留，失败也不会丢失。', 'progress');
    const config = validateLiveConfig(modelConfig());
    const providerName = $('#providerSelect option:checked')?.textContent || '真实模型';
    const sourcePayload = { ...state.source, bookSample: state.source.book?.sample, purpose: state.purpose };
    setSeedGenerationBusy(true);
    startSeedGenerationLoading(providerName, config.model);
    advanceSeedGeneration(3, '正在从现有研究整理三个方向', '只生成三份约200字简介，不重复研究，也不提前构建完整世界。', 72);
    const result = await api.generateDirections({
      source: sourcePayload, taskBrief: state.taskBrief, researchDossier: state.researchDossier,
      purpose: state.purpose, skin: state.skin, dials: state.dials, tone: state.tone, focuses: state.focuses,
    }, config);
    resetDownstream('cards');
    state.directionComparison = result.comparison || '';
    state.cards = result.cards.map(normalizeCard);
    state.directionContinuityUpgradeRequired = false;
    advanceSeedGeneration(4, '三个新方向已经完成', '每份简介都已核对所采用的地点、人物或族群和事件材料。', 100);
    setResearchDirectionStatus();
    renderSeedCards(); setStepEnabled('cards'); navigate('cards'); await saveCurrentWorld('cards');
  } catch (error) {
    setResearchDirectionStatus(`三个方向没有生成：${errorSentence(error)}。研究资料已经保留，可以直接再次生成方向。`, 'error');
    showToast(`方向生成未完成：${error.message}`, 12_000);
  } finally { setSeedGenerationBusy(false); hideLoading(); }
}

function forgeBatchHasContent(batch) {
  if (CANON_STEPS.includes(batch)) return Boolean(state.canonParts[batch]);
  if (batch === 'AUDIT') return Boolean(state.audit);
  return Boolean(state.modules[batch]);
}

function forgeBatchApproved(batch) {
  if (batch === 'AUDIT') return Boolean(state.audit);
  const draft = state.forgeDrafts[batch];
  if (typeof draft === 'string' && draft.trim() !== savedForgeContent(batch).trim()) return false;
  return Boolean(state.forgeApprovals[batch]);
}

function rebuildApprovedWorld() {
  state.world = FORGE_BATCHES.filter((batch) => state.forgeApprovals[batch] && state.modules[batch])
    .map((batch) => state.modules[batch])
    .join('\n\n---\n\n');
  refreshWorldPreview(state.world ? 'waiting' : 'building');
}

function renderForgeProgress(batches = FORGE_FLOW_STEPS, activeIndex = -1, errorIndex = -1) {
  const firstPendingIndex = batches.findIndex((batch) => !forgeBatchApproved(batch));
  $('#forgeProgress').innerHTML = batches.map((batch, index) => {
    const hasContent = forgeBatchHasContent(batch);
    const approved = forgeBatchApproved(batch);
    const status = index === errorIndex ? 'is-error'
      : index === activeIndex && state.forgeBusy ? 'is-active'
        : hasContent && !approved ? 'is-review'
          : approved ? 'is-done' : '';
    const icon = approved ? '✓' : String(index + 1).padStart(2, '0');
    const disabled = !hasContent || state.forgeBusy || batch === 'AUDIT' || (firstPendingIndex >= 0 && index > firstPendingIndex);
    const label = forgeBatchLabel(batch);
    return `<button class="forge-step ${status}${batch === 'L1' ? ' is-phase-break' : ''}" type="button" data-forge-batch="${batch}" ${disabled ? 'disabled' : ''}><i>${icon}</i><span><strong>${label[0]}</strong><small>${approved ? '已确认，可重新查看' : hasContent ? '等待你的审核' : label[1]}</small></span></button>`;
  }).join('');
}

function stopForgeNodeTimer() {
  window.clearInterval(forgeNodeTimer);
  forgeNodeTimer = null;
}

function forgeNextLabel(index) {
  const nextBatch = FORGE_FLOW_STEPS[index + 1];
  return nextBatch ? `下一节点：${forgeBatchLabel(nextBatch)[0]}` : '下一步：查看审计结果';
}

function resetForgeStream() {
  forgeStreamBuffer = '';
  window.cancelAnimationFrame(forgeStreamRenderFrame);
  forgeStreamRenderFrame = null;
  $('#forgeStreamText').textContent = '';
  $('#forgeStreamCount').textContent = '等待模型返回文字';
}

function renderForgeStream() {
  forgeStreamRenderFrame = null;
  const output = $('#forgeStreamText');
  output.textContent = forgeStreamBuffer.slice(-12_000);
  $('#forgeStreamCount').textContent = `已接收 ${forgeStreamBuffer.length.toLocaleString()} 字符`;
  output.scrollTop = output.scrollHeight;
}

function handleForgeStreamEvent(event) {
  if (event.type === 'phase') {
    if (event.reset) resetForgeStream();
    $('#forgeStream').hidden = false;
    $('#forgeNodeDetail').textContent = event.message || '模型正在处理当前节点。';
    $('#forgeStreamCount').textContent = event.phase === 'validating' ? '正文已返回 · 正在校验' : event.phase === 'repairing' ? '正在自动修补' : '模型正在输出';
    return;
  }
  if (event.type !== 'delta' || !event.text) return;
  forgeStreamBuffer += event.text;
  $('#forgeStream').hidden = false;
  if (!forgeStreamRenderFrame) forgeStreamRenderFrame = window.requestAnimationFrame(renderForgeStream);
}

function showForgeNode(batch, index, stateName = 'active', message = '') {
  stopForgeNodeTimer();
  const activity = $('#forgeActivity');
  const [title, detail] = forgeNodeDetail(batch);
  activity.hidden = false;
  activity.dataset.state = stateName;
  activity.setAttribute('aria-busy', String(stateName === 'active'));
  const stateLabel = stateName === 'error' ? '未完成' : stateName === 'paused' ? '等待继续' : stateName === 'review' ? '等待审核' : '正在进行';
  const titlePrefix = stateName === 'paused' ? '等待继续：' : stateName === 'error' ? '节点中断：' : stateName === 'review' ? '请审核：' : '正在';
  $('#forgeNodeCode').textContent = `${stateLabel} · 节点 ${String(index + 1).padStart(2, '0')} / ${String(FORGE_FLOW_STEPS.length).padStart(2, '0')}`;
  $('#forgeNodeTitle').textContent = `${titlePrefix}${title}`;
  $('#forgeNodeDetail').textContent = message || detail;
  const approvedCount = FORGE_FLOW_STEPS.filter((item) => forgeBatchApproved(item)).length;
  $('#forgeNodeCompleted').textContent = `已确认 ${approvedCount} / ${FORGE_FLOW_STEPS.length}`;
  $('#forgeNodeNext').textContent = stateName === 'review' ? '确认当前草稿后才会生成下一节点' : stateName === 'error' || stateName === 'paused' ? '点击“从中断处继续”后会从这里恢复' : forgeNextLabel(index);
  $('#forgeNodeElapsed').textContent = stateName === 'review' ? '草稿已保存' : stateName === 'paused' ? '等待操作' : stateName === 'error' ? '已停止' : '已等待 0 秒';
  if (stateName === 'active') {
    resetForgeStream();
    $('#forgeStream').hidden = false;
  } else if (!forgeStreamBuffer) {
    $('#forgeStream').hidden = true;
  }
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
  $('#forgeNodeTitle').textContent = `正在检查${forgeNodeDetail(batch)[0]}`;
  $('#forgeNodeDetail').textContent = '模型已经返回；正在检查必要章节、正文长度和与前文的连续性。';
  $('#forgeNodeNext').textContent = '校验通过后会保存草稿，并等待你的审核';
}

function showForgeAuditState(stateName = 'active', message = '') {
  stopForgeNodeTimer();
  const activity = $('#forgeActivity');
  activity.hidden = false;
  const complete = stateName === 'complete';
  const failed = stateName === 'error';
  activity.dataset.state = complete ? 'complete' : failed ? 'error' : 'checking';
  activity.setAttribute('aria-busy', String(!complete && !failed));
  $('#forgeNodeCode').textContent = `${complete ? '全部完成' : failed ? '审计中断' : '正在进行'} · 节点 ${String(FORGE_FLOW_STEPS.length).padStart(2, '0')} / ${String(FORGE_FLOW_STEPS.length).padStart(2, '0')}`;
  $('#forgeNodeElapsed').textContent = complete ? '审计报告已保存' : failed ? '等待重新审计' : '正文 4 个节点已保存';
  $('#forgeNodeTitle').textContent = complete ? '世界正文与一致性审计均已完成' : failed ? '一致性审计没有完成' : '正在进入一致性审计';
  $('#forgeNodeDetail').textContent = message || (complete ? '世界的规律、尺度、历史因果、资源与知识边界已经完成检查。' : failed ? '正文已经安全保存，可以从审计页面重新检查。' : '完整正文已经构建；接下来检查规律、尺度、历史因果和知识边界。');
  $('#forgeNodeCompleted').textContent = `已完成 ${complete ? FORGE_FLOW_STEPS.length : FORGE_FLOW_STEPS.length - 1} / ${FORGE_FLOW_STEPS.length}`;
  $('#forgeNodeNext').textContent = complete ? '下一步：查看审计结果' : failed ? '下一步：重新审计' : '审计过程会继续分阶段展示进度';
}

function hideForgeActivity() {
  stopForgeNodeTimer();
  $('#forgeActivity').hidden = true;
  $('#forgeActivity').removeAttribute('aria-busy');
  delete $('#forgeActivity').dataset.state;
  $('#forgeStream').hidden = true;
}

function hideForgeReview() {
  const panel = $('#forgeReviewPanel');
  if (!panel) return;
  panel.hidden = true;
  state.activeForgeBatch = null;
}

function canonAsMarkdown(canon) {
  if (!canon) return '';
  const sourceLabel = (item) => item?.sourceAnchors?.length ? `（承接原著：${item.sourceAnchors.join('、')}）` : '';
  const lines = [`# ${canon.identity?.name || '未命名世界'}`];
  if (canon.identity?.oneLine) lines.push(canon.identity.oneLine);
  if (canon.identity?.thesis) lines.push('', '## 世界基础', canon.identity.thesis);
  if (canon.sourcePlan?.primaryWork) {
    lines.push('', '## 原著承接', `- **主世界**：《${canon.sourcePlan.primaryWork}》`);
    if (canon.sourcePlan.secondaryWorks?.length) lines.push(`- **次世界**：${canon.sourcePlan.secondaryWorks.map((item) => `《${item}》`).join('、')}`);
    if (canon.sourcePlan.timeSpaceCorrespondence) lines.push(`- **时空接入**：${canon.sourcePlan.timeSpaceCorrespondence}`);
    if (canon.sourcePlan.precedence) lines.push(`- **主次原则**：${canon.sourcePlan.precedence}`);
    (canon.sourceContinuity || []).forEach((item) => lines.push(`- **${item.originalName}**（《${item.source}》）：${item.explanation}${item.extensionReason ? `；扩展理由：${item.extensionReason}` : ''}`));
  }
  if (canon.axioms?.length) {
    lines.push('', '## 核心规律');
    canon.axioms.forEach((item) => lines.push(`- **${item.statement}**${sourceLabel(item)}${item.consequences?.length ? `：${item.consequences.join('；')}` : ''}`));
  }
  if (canon.spatialOrder?.overview || canon.spatialOrder?.regions?.length) {
    lines.push('', '## 地方与空间');
    if (canon.spatialOrder.overview) lines.push(canon.spatialOrder.overview);
    (canon.spatialOrder.regions || []).forEach((item) => lines.push(`- **${item.name}**${sourceLabel(item)}：${item.definition || item.importance || ''}`));
  }
  if (canon.societies?.length) {
    lines.push('', '## 居民与社会');
    canon.societies.forEach((item) => lines.push(`- **${item.name}**${sourceLabel(item)}：${item.definition || item.importance || ''}`));
  }
  if (canon.institutions?.length) {
    lines.push('', '## 组织与制度');
    canon.institutions.forEach((item) => lines.push(`- **${item.name}**${sourceLabel(item)}：${item.definition || item.importance || ''}`));
  }
  if (canon.history?.length) {
    lines.push('', '## 形成今天的历史');
    canon.history.forEach((item) => lines.push(`- **${item.era || '历史转折'}**${sourceLabel(item)}：${item.event}`));
  }
  if (canon.dailyLife?.length) {
    lines.push('', '## 日常生活');
    canon.dailyLife.forEach((item) => lines.push(`- **${item.topic}**${sourceLabel(item)}：${item.fact}`));
  }
  return lines.join('\n');
}

function researchMaterialName(researchId) {
  if (!researchId) return '';
  const pools = [
    ...(state.researchDossier?.materials || []),
    ...(state.researchDossier?.narrativeElements || state.researchDossier?.narrative_elements || []),
    ...(state.researchDossier?.keyEvents || state.researchDossier?.key_events || []),
  ];
  const material = pools.find((item) => (item.id || item.research_id || item.researchId) === researchId);
  return material?.originalName || material?.original_name || material?.name || material?.title || '';
}

function savedForgeContent(batch) {
  return CANON_STEPS.includes(batch)
    ? canonPartAsMarkdown(batch, state.canonParts[batch] || {}, researchMaterialName)
    : String(state.modules[batch] || '');
}

function currentForgeEditorContent(batch) {
  if (!Object.hasOwn(state.forgeDrafts, batch)) return savedForgeContent(batch);
  const draft = String(state.forgeDrafts[batch] || '');
  if (!CANON_STEPS.includes(batch) || !draft.trim().startsWith('{')) return draft;
  try { return canonPartAsMarkdown(batch, JSON.parse(draft), researchMaterialName); } catch { return savedForgeContent(batch); }
}

function renderForgeDraftPreview(batch, content) {
  const preview = $('#forgeDraftPreview');
  const readableContent = CANON_STEPS.includes(batch) ? canonPreviewMarkdown(content, state.canonParts) : content;
  preview.innerHTML = renderMarkdown(readableContent);
  if (batch !== 'C4') return;
  const heading = [...preview.querySelectorAll('h3')].find((item) => item.textContent.trim() === '原著材料如何进入正典');
  if (!heading) return;
  const evidenceNodes = [];
  let sibling = heading.nextSibling;
  while (sibling && !(sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'H3')) {
    evidenceNodes.push(sibling);
    sibling = sibling.nextSibling;
  }
  const itemCount = evidenceNodes.filter((item) => item.nodeType === Node.ELEMENT_NODE && item.tagName === 'H4').length;
  const details = document.createElement('details');
  details.className = 'forge-evidence-details';
  const summary = document.createElement('summary');
  summary.textContent = `查看原著承接说明${itemCount ? `（${itemCount} 项）` : ''}`;
  details.append(summary);
  heading.replaceWith(details);
  details.append(heading, ...evidenceNodes);
}

function setForgeReviewView(view = 'preview') {
  const activeView = view === 'preview' ? 'preview' : 'edit';
  $('#forgeEditorPane').hidden = activeView !== 'edit';
  $('#forgePreviewPane').hidden = activeView !== 'preview';
  $$('.forge-view-tab').forEach((tab) => {
    const active = tab.dataset.forgeView === activeView;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
}

function downstreamGeneratedCount(batch) {
  const index = FORGE_FLOW_STEPS.indexOf(batch);
  return FORGE_FLOW_STEPS.slice(index + 1).filter(forgeBatchHasContent).length;
}

function updateForgeReviewFromEditor() {
  const batch = state.activeForgeBatch;
  if (!batch) return;
  const content = $('#forgeDraftEditor').value;
  state.forgeDrafts[batch] = content;
  const changed = content.trim() !== savedForgeContent(batch).trim();
  const approved = forgeBatchApproved(batch) && !changed;
  const panel = $('#forgeReviewPanel');
  panel.dataset.status = changed ? 'dirty' : approved ? 'approved' : 'draft';
  $('#forgeReviewStatus').textContent = changed ? '有未确认修改' : approved ? '已确认' : '待审核';
  const downstreamCount = downstreamGeneratedCount(batch);
  const notice = $('#forgeReviewNotice');
  if (batch === 'C1' && state.sourceContinuityUpgradeRequired) {
    renderForgeDraftPreview(batch, content);
    notice.dataset.tone = 'error';
    notice.textContent = '这份世界基础来自旧版换名路线，没有逐项保留原著。已有内容仍在，但必须重新生成本步骤，后续正文才会按原著连续性重建。';
    renderForgeProgress(FORGE_FLOW_STEPS, FORGE_FLOW_STEPS.indexOf(batch));
    return;
  }
  notice.dataset.tone = changed && downstreamCount ? 'warning' : changed ? 'progress' : approved ? 'success' : 'progress';
  notice.textContent = changed
    ? downstreamCount ? `保存这次修改后，后面 ${downstreamCount} 个步骤会失效，并按新内容重新生成。` : '修改尚未影响后续；确认后，下一步会读取这个版本。'
    : approved ? '这是已经确认的版本。重新修改并确认后，后续内容会按新版本重建。' : '这份草稿尚未进入后续步骤。请审核、修改或重新生成。';
  renderForgeDraftPreview(batch, content);
  renderForgeProgress(FORGE_FLOW_STEPS, FORGE_FLOW_STEPS.indexOf(batch));
  window.clearTimeout(forgeDraftSaveTimer);
  forgeDraftSaveTimer = window.setTimeout(() => saveCurrentWorld('forge'), 650);
}

function renderForgeReview(batch) {
  if (!forgeBatchHasContent(batch) || batch === 'AUDIT') return;
  state.activeForgeBatch = batch;
  const index = FORGE_FLOW_STEPS.indexOf(batch);
  const panel = $('#forgeReviewPanel');
  const content = currentForgeEditorContent(batch);
  panel.hidden = false;
  $('#forgeReviewTitle').textContent = forgeBatchLabel(batch)[0].replace(/^第.+? · /, '');
  $('#forgeReviewDescription').textContent = forgeNodeDetail(batch)[1];
  $('#forgeReviewPosition').textContent = `步骤 ${String(index + 1).padStart(2, '0')} / ${String(FORGE_FLOW_STEPS.length - 1).padStart(2, '0')}`;
  const canonStep = CANON_STEPS.includes(batch);
  $('#forgeEditorLabel').textContent = 'Markdown 内容';
  $('#forgeEditorHint').textContent = canonStep ? '标题和条目可直接修改；确认后才会生成下一部分' : '确认后会成为后续步骤的唯一前文';
  $('#forgeEditorLabel').htmlFor = 'forgeDraftEditor';
  $('#forgeDraftEditor').classList.remove('is-structured');
  $('#forgeDraftEditor').value = content;
  $('#forgeDraftEditor').hidden = false;
  setForgeReviewView('preview');
  const nextBatch = FORGE_FLOW_STEPS[index + 1];
  $('#approveForgeStep span').textContent = nextBatch === 'AUDIT' ? '确认并开始一致性审计' : forgeBatchApproved(batch) && forgeBatchHasContent(nextBatch) ? '保存并查看下一步' : '确认并生成下一步';
  showForgeNode(batch, index, 'review', '当前步骤已经形成草稿。它不会自动进入下一步，直到你确认。');
  renderForgeProgress(FORGE_FLOW_STEPS, index);
  updateForgeReviewFromEditor();
}

function refreshWorldPreview(emptyState = 'waiting') {
  $('#confirmedWorldLabel').hidden = !state.world;
  if (state.world) {
    $('#worldPreview').innerHTML = renderMarkdown(state.world);
    return;
  }
  const building = emptyState === 'building';
  $('#worldPreview').innerHTML = `<div class="empty-state"><svg><use href="#i-layers"/></svg><strong>${building ? '正在构建这个世界' : '等待选择世界模型'}</strong><span>${building ? '每完成一个节点，新的世界正文就会出现在这里。上方会持续显示当前正在进行的工作。' : '选中后，这里会依照因果顺序构建完整世界。'}</span></div>`;
}

function renderCanonPanel() {
  const panel = $('#canonPanel');
  if (!panel) return;
  const canon = state.worldCanon;
  panel.hidden = !canon;
  if (!canon) return;
  const counts = [
    ['核心规律', canon.axioms?.length || 0], ['地域', canon.spatialOrder?.regions?.length || 0],
    ['社会与制度', (canon.societies?.length || 0) + (canon.institutions?.length || 0)], ['日常事实', canon.dailyLife?.length || 0],
  ];
  $('#canonStats').innerHTML = counts.map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  $('#canonAxioms').innerHTML = (canon.axioms || []).slice(0, 5).map((axiom) => `<li><strong>${escapeHtml(axiom.statement)}</strong>${axiom.consequences?.[0] ? `<span>${escapeHtml(axiom.consequences[0])}</span>` : ''}</li>`).join('');
  $('#canonIdentity').textContent = canon.identity?.thesis || canon.identity?.oneLine || '';
}

async function buildWorldCanon(config) {
  return generateForgeStage('C1', config);
}

async function selectSeed(index) {
  state.selectedSeed = state.cards[index];
  if (!state.selectedSeed) return;
  state.modules = {}; state.world = ''; state.worldCanon = null; state.canonParts = {};
  state.forgeApprovals = {}; state.forgeDrafts = {}; state.activeForgeBatch = null; state.audit = null; state.summary = '';
  updateProjectState(state.selectedSeed);
  $('#forgeTitle').textContent = `正在解释「${state.selectedSeed.name}」`;
  refreshWorldPreview('building');
  renderCanonPanel();
  renderForgeProgress(FORGE_FLOW_STEPS, 0);
  showForgeNode('C1', 0, 'paused', '世界方向已经选定；先生成世界定位与原著边界，审核后再继续。');
  setStepEnabled('forge'); navigate('forge');
  await saveCurrentWorld('forge');
  try {
    const config = validateLiveConfig(modelConfig());
    await buildWorldCanon(config);
  } catch (error) {
    showForgeNode('C1', 0, 'error', error.message);
    $('#resumeForge').hidden = false;
    showToast(`构建中断：${error.message}`, 8_000);
  }
}

function invalidateForgeAfter(batch) {
  const index = FORGE_FLOW_STEPS.indexOf(batch);
  for (const downstream of FORGE_FLOW_STEPS.slice(index + 1)) {
    delete state.forgeApprovals[downstream];
    delete state.forgeDrafts[downstream];
    if (CANON_STEPS.includes(downstream)) delete state.canonParts[downstream];
    if (FORGE_BATCHES.includes(downstream)) delete state.modules[downstream];
  }
  if (CANON_STEPS.includes(batch)) state.worldCanon = null;
  state.audit = null; state.summary = ''; state.art = [];
  setStepEnabled('audit', false); setStepEnabled('export', false);
  rebuildApprovedWorld();
}

function clearForgeBatch(batch) {
  delete state.forgeApprovals[batch];
  delete state.forgeDrafts[batch];
  invalidateForgeAfter(batch);
  if (CANON_STEPS.includes(batch)) {
    delete state.canonParts[batch];
    state.worldCanon = null;
  } else {
    delete state.modules[batch];
  }
  rebuildApprovedWorld();
  renderCanonPanel();
}

async function generateForgeStage(batch, existingConfig = null) {
  if (!state.selectedSeed || state.forgeBusy) return;
  const flowIndex = FORGE_FLOW_STEPS.indexOf(batch);
  const config = existingConfig || validateLiveConfig(modelConfig());
  state.forgeBusy = true;
  state.activeForgeBatch = batch;
  delete state.forgeDrafts[batch];
  delete state.forgeApprovals[batch];
  $('#resumeForge').hidden = true;
  $('#resumeForge').disabled = true;
  $('#forgeReviewPanel').hidden = true;
  renderForgeProgress(FORGE_FLOW_STEPS, flowIndex);
  showForgeNode(batch, flowIndex);
  try {
    if (CANON_STEPS.includes(batch)) {
      const sectionIndex = CANON_STEPS.indexOf(batch);
      const canonSections = Object.fromEntries(CANON_STEPS.slice(0, sectionIndex).filter((item) => state.forgeApprovals[item] && state.canonParts[item]).map((item) => [item, state.canonParts[item]]));
      const result = await api.buildCanonSection({ section: batch, taskBrief: state.taskBrief, researchDossier: state.researchDossier, seed: state.selectedSeed, canonSections }, config, handleForgeStreamEvent);
      showForgeNodeCheck(batch, flowIndex);
      state.canonParts[batch] = result.canonPart;
      if (result.worldCanon) {
        state.worldCanon = result.worldCanon;
        state.sourceContinuityUpgradeRequired = false;
      }
      renderCanonPanel();
    } else {
      if (!state.worldCanon || CANON_STEPS.some((item) => !state.forgeApprovals[item])) throw new Error('请先确认全部四个世界基础步骤。');
      const response = await api.generate('expand', { batch, worldCanon: state.worldCanon, researchDossier: state.researchDossier, previous: state.world }, config, handleForgeStreamEvent);
      showForgeNodeCheck(batch, flowIndex);
      const markdown = cleanModelMarkdown(response.text);
      const validation = validateWorldModule(batch, markdown);
      if (!validation.ok) throw new Error(`${forgeBatchLabel(batch)[0]}不完整：${validation.problems.join('；')}。`);
      state.modules[batch] = markdown;
    }
    await saveCurrentWorld('forge');
    renderForgeReview(batch);
  } catch (error) {
    renderForgeProgress(FORGE_FLOW_STEPS, -1, flowIndex);
    showForgeNode(batch, flowIndex, 'error', error.message);
    $('#resumeForge').hidden = false;
    showToast(`展开中断：${error.message}`, 6_000);
  } finally {
    state.forgeBusy = false;
    $('#resumeForge').disabled = false;
    $('#redoForgeStep').disabled = false;
    $('#approveForgeStep').disabled = false;
    renderForgeProgress(FORGE_FLOW_STEPS, forgeBatchHasContent(batch) ? flowIndex : -1, forgeBatchHasContent(batch) ? -1 : flowIndex);
  }
}

async function approveForgeStep() {
  const batch = state.activeForgeBatch;
  if (!batch || state.forgeBusy) return;
  const content = $('#forgeDraftEditor').value.trim();
  const previous = savedForgeContent(batch).trim();
  $('#approveForgeStep').disabled = true;
  $('#redoForgeStep').disabled = true;
  try {
    const changed = content !== previous;
    let canonResult = null;
    let markdown = '';
    if (CANON_STEPS.includes(batch)) {
      const parsed = canonPartFromMarkdown(batch, content, state.canonParts[batch], researchMaterialName);
      const sectionIndex = CANON_STEPS.indexOf(batch);
      const canonSections = Object.fromEntries(CANON_STEPS.slice(0, sectionIndex).filter((item) => state.canonParts[item]).map((item) => [item, state.canonParts[item]]));
      canonResult = await api.validateCanonSection(batch, parsed, canonSections, state.selectedSeed, state.researchDossier, state.taskBrief);
    } else {
      markdown = cleanModelMarkdown(content);
      const validation = validateWorldModule(batch, markdown);
      if (!validation.ok) throw new Error(`当前修改无法确认：${validation.problems.join('；')}。`);
    }
    if (changed) invalidateForgeAfter(batch);
    if (canonResult) {
      state.canonParts[batch] = canonResult.canonPart;
      if (canonResult.worldCanon) {
        state.worldCanon = canonResult.worldCanon;
        state.sourceContinuityUpgradeRequired = false;
      }
      renderCanonPanel();
    } else {
      state.modules[batch] = markdown;
    }
    state.forgeApprovals[batch] = true;
    delete state.forgeDrafts[batch];
    rebuildApprovedWorld();
    await saveCurrentWorld('forge');
    renderForgeProgress();
    const index = FORGE_FLOW_STEPS.indexOf(batch);
    const nextBatch = FORGE_FLOW_STEPS[index + 1];
    if (nextBatch === 'AUDIT') {
      $('#forgeReviewPanel').hidden = true;
      renderForgeProgress(FORGE_FLOW_STEPS, FORGE_FLOW_STEPS.length - 1);
      showForgeAuditState('active');
      await runAudit(true);
    } else if (forgeBatchHasContent(nextBatch)) {
      renderForgeReview(nextBatch);
    } else {
      await generateForgeStage(nextBatch);
    }
  } catch (error) {
    const notice = $('#forgeReviewNotice');
    notice.dataset.tone = 'error';
    notice.textContent = error.message;
    showToast(error.message, 6_000);
  } finally {
    $('#approveForgeStep').disabled = false;
    $('#redoForgeStep').disabled = false;
  }
}

async function redoForgeStep() {
  const batch = state.activeForgeBatch;
  if (!batch || state.forgeBusy) return;
  const downstreamCount = downstreamGeneratedCount(batch);
  if (downstreamCount && !window.confirm(`重新生成会清除后面 ${downstreamCount} 个步骤，并按新草稿重建。继续吗？`)) return;
  clearForgeBatch(batch);
  await saveCurrentWorld('forge');
  await generateForgeStage(batch);
}

async function expandWorld() {
  if (!state.selectedSeed || state.forgeBusy) return;
  const batch = FORGE_FLOW_STEPS.slice(0, -1).find((item) => !forgeBatchApproved(item));
  if (!batch) {
    await runAudit(true);
    return;
  }
  if (forgeBatchHasContent(batch)) renderForgeReview(batch);
  else await generateForgeStage(batch);
}

async function runAudit(autoNavigate = false) {
  try {
    if (!state.world) throw new Error('世界正文尚未生成。');
    const config = validateLiveConfig(modelConfig());
    const providerName = $('#providerSelect option:checked')?.textContent || '真实模型';
    startAuditLoading(providerName, config.model);
    const response = await api.generate('lint', { taskBrief: state.taskBrief, researchDossier: state.researchDossier, worldCanon: state.worldCanon, world: state.world }, config);
    advanceAuditLoading(2, '模型检查已经完成', '正在解析问题位置、影响范围和最小修补建议。', 72);
    state.audit = parseModelJson(response.text);
    advanceAuditLoading(3, '审计结果已经读懂', '正在整理通过项、问题清单并保存本次报告。', 88);
    renderAudit(); setStepEnabled('audit'); await saveCurrentWorld('audit');
    renderForgeProgress(FORGE_FLOW_STEPS, FORGE_FLOW_STEPS.length);
    showForgeAuditState('complete');
    $('#resumeForge').hidden = true;
    advanceAuditLoading(4, '一致性审计已经完成', '审计报告已保存，即将进入结果页面。', 100);
    if (autoNavigate) navigate('audit');
  } catch (error) {
    state.audit = {
      status: '审计暂缓，当前版本可用', score: 0, canon_violations: [], prose_violations: [], passed_rules: [],
      accepted: true, audit_unavailable: true, untapped_potential: `模型审计没有完成：${error.message}`,
    };
    renderAudit(); setStepEnabled('audit'); await saveCurrentWorld('audit');
    renderForgeProgress(FORGE_FLOW_STEPS, FORGE_FLOW_STEPS.length);
    showForgeAuditState('complete', '世界正文已经保存；审计服务暂时不可用，但不会阻止完成与导出。');
    $('#resumeForge').hidden = true;
    await finalizeWorld({ useModel: false, notice: '审计服务暂时不可用，已保留完整正文并直接完成世界档案。' });
  }
  finally { hideLoading(); }
}

function renderAudit() {
  const audit = state.audit ?? { score: 0, status: '未审计', violations: [], passed_rules: [] };
  const blocking = getBlockingAuditViolations(audit);
  const suggestions = getAdvisoryAuditViolations(audit);
  const usableStatus = blocking.length ? '发现关键矛盾' : suggestions.length ? '可以使用，另有改进建议' : '审计通过';
  $('#auditHero').innerHTML = `<div class="score-ring" style="--score:${Number(audit.score) || 0}"><span>${escapeHtml(audit.score || 0)}<small>STRUCTURE</small></span></div><div class="audit-summary"><h3>${escapeHtml(audit.accepted ? '已接受当前版本' : usableStatus)}</h3><p>${escapeHtml(audit.untapped_potential || (blocking.length ? '这些矛盾可能让读者无法判断世界事实。' : '当前版本已经可以正常使用；建议不会阻止完成。'))}</p></div>`;
  $('#violationCount').textContent = `${blocking.length} 项`;
  $('#violationsList').innerHTML = blocking.length ? blocking.map((item) => `<article class="violation"><svg><use href="#i-alert"/></svg><div><strong>${escapeHtml(item.rule)} · ${escapeHtml(item.location)}</strong><p>${escapeHtml(item.problem)}</p><small>最小修补：${escapeHtml(item.minimal_fix)}</small></div></article>`).join('') : '<div class="passed-list"><span class="passed-rule"><svg><use href="#i-check"/></svg>没有必须处理的矛盾</span></div>';
  $('#auditSuggestionCount').textContent = `${suggestions.length} 项`;
  $('#auditSuggestions').innerHTML = suggestions.length ? suggestions.map((item) => `<article class="violation is-advisory"><svg><use href="#i-spark"/></svg><div><strong>${escapeHtml(item.rule)} · ${escapeHtml(item.location)}</strong><p>${escapeHtml(item.problem)}</p><small>可选调整：${escapeHtml(item.minimal_fix)}</small></div></article>`).join('') : '<div class="passed-list"><span class="passed-rule"><svg><use href="#i-check"/></svg>没有额外建议</span></div>';
  $('#passedRules').innerHTML = (audit.passed_rules ?? []).map((rule) => `<span class="passed-rule"><svg><use href="#i-check"/></svg>${escapeHtml(rule)}</span>`).join('');
  const repairButton = $('#repairWorld');
  repairButton.hidden = blocking.length === 0 || audit.accepted;
  $('span', repairButton).textContent = blocking.length ? `让 AI 修补 ${blocking.length} 项关键矛盾` : '无需修补';
  $('#skipRepair').textContent = blocking.length ? '接受当前版本并完成' : '完成世界档案';
}

function blockingAuditForRepair(audit) {
  const highOnly = (items) => (Array.isArray(items) ? items : []).filter((item) => String(item?.severity || '').toLowerCase() === 'high');
  return {
    ...audit,
    violations: highOnly(audit?.violations),
    canon_violations: highOnly(audit?.canon_violations),
    prose_violations: highOnly(audit?.prose_violations),
  };
}

async function runAutonomousRepairAttempt(config, attempt) {
  updateLoading('AI 正在自主修补', `第 ${attempt} 轮：修补当前剩余的 ${getAuditViolations(state.audit).length} 项问题。`, 12 + attempt * 14);
  const response = await api.generate('repair', { taskBrief: state.taskBrief, researchDossier: state.researchDossier, worldCanon: state.worldCanon, world: state.world, audit: blockingAuditForRepair(state.audit) }, config);
  const repairedWorld = cleanModelMarkdown(response.text);
  if (!repairedWorld || repairedWorld === state.world) return null;

  const previousAudit = state.audit;
  state.world = repairedWorld;
  state.audit = {
    ...previousAudit,
    status: '修补已保存，等待复核',
    untapped_potential: '本轮修改已经保存；复核完成前，原问题清单仅作为待确认记录。',
    verification_pending: true,
  };
  renderAudit();
  await saveCurrentWorld('audit');

  updateLoading('正在复核修补结果', `第 ${attempt} 轮：确认修改是否解决问题且没有引入新矛盾。`, 20 + attempt * 16);
  const auditResponse = await api.generate('lint', { taskBrief: state.taskBrief, researchDossier: state.researchDossier, worldCanon: state.worldCanon, world: repairedWorld }, config);
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

    if (state.audit?.verification_pending) {
      updateLoading('继续复核已保存的修改', '上次修补已经写入世界正文，现在先完成中断的审计，不会重复修改。', 22);
      const auditResponse = await api.generate('lint', { taskBrief: state.taskBrief, researchDossier: state.researchDossier, worldCanon: state.worldCanon, world: state.world }, config);
      const resumedAudit = parseModelJson(auditResponse.text);
      state.audit = hasAuditPassed(resumedAudit) ? { ...resumedAudit, status: '通过', violations: [] } : resumedAudit;
      renderAudit();
      await saveCurrentWorld('audit');
      if (hasAuditPassed(state.audit)) {
        updateLoading('中断的复核已经通过', '已保存的修改有效，正在整理最终世界档案。', 92);
        await finalizeWorld();
        return;
      }
    }

    let previousBurden = getAuditBurden(state.audit);
    let previousScore = Number(state.audit?.score) || 0;

    for (let attempt = 1; attempt <= MAX_AUTONOMOUS_REPAIR_ATTEMPTS; attempt += 1) {
      completedAttempts = attempt;
      const result = await runAutonomousRepairAttempt(config, attempt);
      if (!result) {
        await acceptAuditAndFinalize('AI 没有产生有效修改，已保留当前版本并停止继续提醒。');
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

    const stopReason = stalledAttempts >= 2 ? '连续两轮没有改善' : '达到安全重试上限';
    await acceptAuditAndFinalize(`AI 已尝试 ${completedAttempts} 轮，因${stopReason}而停止；当前版本已经保留并完成。`);
  } catch (error) {
    await acceptAuditAndFinalize(`自主修补因模型连接问题停止：${error.message}。已保留当前版本，不再循环提醒。`);
  }
  finally { hideLoading(); }
}

function buildLocalSummary(world) {
  const sections = String(world || '').split(/\n(?=#\s)/).map((section) => section.trim()).filter(Boolean);
  const selected = sections.slice(0, 6).map((section) => section.length > 620 ? `${section.slice(0, 620).trim()}……` : section);
  const body = selected.join('\n\n') || '世界正文已经保存，可以在完整世界之书中继续阅读和编辑。';
  return `# 三分钟世界概览\n\n${body}`;
}

async function acceptAuditAndFinalize(reason = '用户接受当前版本。') {
  state.audit = {
    ...(state.audit || {}), accepted: true, verification_pending: false,
    status: '已接受当前版本', accepted_at: new Date().toISOString(), untapped_potential: reason,
  };
  renderAudit();
  await saveCurrentWorld('audit');
  await finalizeWorld({ useModel: false, notice: reason });
}

async function finalizeWorld({ useModel = true, notice = '' } = {}) {
  try {
    showLoading('正在整理世界档案', '把完整世界压缩成 3 分钟概览。', 56);
    let fallbackNotice = '';
    if (useModel) {
      try {
        const response = await api.generate('summary', { worldCanon: state.worldCanon, researchDossier: state.researchDossier, world: state.world }, validateLiveConfig(modelConfig()));
        state.summary = cleanModelMarkdown(response.text);
      } catch (error) {
        fallbackNotice = `概览模型暂时不可用，已直接从完整正文生成本地概览：${error.message}`;
      }
    }
    if (!state.summary || !useModel || fallbackNotice) state.summary = buildLocalSummary(state.world);
    renderExport(); setStepEnabled('export'); navigate('export'); await saveCurrentWorld('export'); await renderLibrary();
    if (notice || fallbackNotice) showToast(notice || fallbackNotice, 10_000);
  } catch (error) { showToast(error.message, 5_000); }
  finally { hideLoading(); }
}

function exportPayload() { return { seed: state.selectedSeed, world: state.world, audit: state.audit, summary: state.summary, art: state.art, taskBrief: state.taskBrief, researchDossier: state.researchDossier, worldCanon: state.worldCanon }; }

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
    showLoading('正在读取书籍', '抽取故事经历、人物、地方、风物与事件所需片段，不保存原文。', 22);
    const dataBase64 = await fileToBase64(file);
    updateLoading('正在抽取章节', '采样开篇、中段、结尾，以及关键人物、地方和事件。', 56);
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
  $('#modelInput').innerHTML = '<option value="">先读取模型列表…</option>';
  setManualModelMode(false);
  setModelSelectValue(preset.model || '');
  $('#protocolSelect').value = preset.protocol === 'anthropic' || preset.protocol === 'gemini' ? preset.protocol : 'openai';
  updateProviderFields();
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
  window.addEventListener('beforeunload', (event) => {
    const batch = state.activeForgeBatch;
    if (!batch || !Object.hasOwn(state.forgeDrafts, batch) || state.forgeDrafts[batch].trim() === savedForgeContent(batch).trim()) return;
    event.preventDefault();
    event.returnValue = '';
  });
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
  $('#briefInput').addEventListener('input', (event) => {
    $('#briefCount').textContent = `${event.target.value.length} / 8000`;
    if (state.source.research?.query !== event.target.value.trim()) {
      state.source.research = null;
    }
  });
  $('#bookInput').addEventListener('change', (event) => handleBook(event.target.files[0]));
  $('#removeBook').addEventListener('click', removeBook);
  const dropzone = $('#bookDropzone');
  ['dragenter','dragover'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); }));
  ['dragleave','drop'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); }));
  dropzone.addEventListener('drop', (event) => handleBook(event.dataTransfer.files[0]));
  $('#loadExample').addEventListener('click', loadExample);
  $('#generateSeeds').addEventListener('click', handleGenerateSeeds);
  $('#rerunResearch').addEventListener('click', handleGenerateSeeds);
  $('#generateFromResearch').addEventListener('click', regenerateDirectionsFromResearch);
  $('#regenerateCards').addEventListener('click', regenerateDirectionsFromResearch);
  $('#seedCardGrid').addEventListener('click', (event) => { const button = event.target.closest('[data-card-index]'); if (button) selectSeed(Number(button.dataset.cardIndex)); });
  $('#resumeForge').addEventListener('click', expandWorld);
  $('#forgeDraftEditor').addEventListener('input', updateForgeReviewFromEditor);
  $$('.forge-view-tab').forEach((tab) => tab.addEventListener('click', () => setForgeReviewView(tab.dataset.forgeView)));
  $('#approveForgeStep').addEventListener('click', approveForgeStep);
  $('#redoForgeStep').addEventListener('click', redoForgeStep);
  $('#forgeProgress').addEventListener('click', (event) => {
    const button = event.target.closest('[data-forge-batch]');
    if (button && !button.disabled) renderForgeReview(button.dataset.forgeBatch);
  });
  $('#rerunAudit').addEventListener('click', () => runAudit(false));
  $('#repairWorld').addEventListener('click', repairWorld);
  $('#skipRepair').addEventListener('click', () => acceptAuditAndFinalize());
  $$('.export-tab').forEach((tab) => tab.addEventListener('click', () => { state.exportTab = tab.dataset.exportTab; renderExport(); }));
  $$('.download-card').forEach((button) => button.addEventListener('click', () => downloadDeliverable(button.dataset.download, state)));
  $('#generateArt').addEventListener('click', generateArt);
  $$('.step-link').forEach((button) => button.addEventListener('click', () => { if (!button.disabled) navigate(button.dataset.step); }));
  const dialog = $('#settingsDialog');
  ['#openSettings','#openSettingsMobile'].forEach((selector) => $(selector).addEventListener('click', () => dialog.showModal()));
  $('#providerSelect').addEventListener('change', () => {
    if (state.credentialProvider) saveVisibleCredentials(state.credentialProvider);
    applyProviderPreset(); restoreVisibleCredentials(); updateProviderBadge(); renderAvailableModels([]);
    invalidateModelSetup('服务商已变化，正在准备新的连接。');
    const preset = state.providers.find((item) => item.id === $('#providerSelect').value);
    if (preset?.transport === 'claude-cli') discoverAvailableModels({ automatic: true });
  });
  $('#apiKeyInput').addEventListener('input', () => invalidateModelSetup('密钥已变化，离开输入框后会读取可用模型。'));
  $('#apiKeyInput').addEventListener('change', () => {
    if (normalizeApiKey($('#apiKeyInput').value)) {
      saveVisibleCredentials();
      discoverAvailableModels({ automatic: true });
    }
  });
  $('#baseUrlInput').addEventListener('change', () => invalidateModelSetup('端点已变化，请重新读取模型。'));
  $('#protocolSelect').addEventListener('change', () => invalidateModelSetup('接口标准已变化，请重新读取模型。'));
  $('#modelInput').addEventListener('change', () => {
    invalidateModelSetup('模型已变化，请完成连接测试。');
    const selected = selectedModelId();
    if (state.availableModels.some((item) => item.id === selected)) testSelectedModel();
  });
  $('#toggleManualModel').addEventListener('click', () => {
    const enable = !state.manualModelMode;
    setManualModelMode(enable, enable ? selectedModelId() : '');
    invalidateModelSetup(enable ? '请填写完整模型名并测试连接。' : '请从模型列表中重新选择。');
  });
  $('#manualModelInput').addEventListener('input', () => invalidateModelSetup('模型名已变化，请完成连接测试。'));
  $('#manualModelInput').addEventListener('change', () => { if (selectedModelId()) testSelectedModel(); });
  $('#discoverModels').addEventListener('click', () => discoverAvailableModels());
  $('#testModelConnection').addEventListener('click', testSelectedModel);
  $('#temperatureInput').addEventListener('input', (event) => { $('#temperatureOutput').value = event.target.value; });
  $('#clearSavedKeys').addEventListener('click', clearSavedCredentials);
  $('#saveSettings').addEventListener('click', () => {
    if (!state.modelRoute?.verifiedAt || !modelRouteMatches(state.modelRoute, modelConfig())) {
      setModelSetupStatus('尚未通过验证', '请先测试当前模型连接。', 'error');
      return;
    }
    updateProviderBadge(); saveModelSettings(); saveVisibleCredentials(); dialog.close();
    showToast('模型连接已保存并启用。密钥只保存在这个本地浏览器中。');
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
    if (savedSettings.protocol) $('#protocolSelect').value = savedSettings.protocol;
    if (savedSettings.baseUrl) $('#baseUrlInput').value = savedSettings.baseUrl;
    if (savedSettings.model) setModelSelectValue(savedSettings.model);
    if (Number.isFinite(savedSettings.temperature)) {
      $('#temperatureInput').value = String(savedSettings.temperature);
      $('#temperatureOutput').value = String(savedSettings.temperature);
    }
    if (savedSettings.imageBaseUrl) $('#imageBaseUrlInput').value = savedSettings.imageBaseUrl;
    if (savedSettings.imageModel) $('#imageModelInput').value = savedSettings.imageModel;
    restoreVisibleCredentials(savedProvider);
    state.modelRoute = savedSettings.route?.verifiedAt ? savedSettings.route : null;
    if (modelRouteMatches(state.modelRoute, modelConfig())) {
      $('#saveSettings').disabled = false;
      setModelSetupStatus('当前连接已启用', `${state.modelRoute.model} 已在 ${new Date(state.modelRoute.verifiedAt).toLocaleString('zh-CN')} 通过连接测试。`, 'success');
      updateModelSetupSteps('test', true);
    } else {
      state.modelRoute = null;
      $('#saveSettings').disabled = true;
      setModelSetupStatus('等待连接', savedSettings.model ? '现有设置需要完成一次连接测试后才能继续使用。' : '填写密钥，或选择 Claude CLI。');
      updateModelSetupSteps('credentials');
    }
    $('#healthStatus').textContent = `本地服务 ${health.version} 已连接`;
  } catch (error) {
    $('#healthStatus').textContent = '本地服务未连接';
    showToast(error.message, 6_000);
  }
  updateProviderBadge(); navigate('library');
}

init();
