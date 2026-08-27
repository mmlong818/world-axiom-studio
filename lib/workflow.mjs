const text = (value, limit = 2_000) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
const list = (value, limit = 20, itemLimit = 500) => (Array.isArray(value) ? value : [])
  .map((item) => text(item, itemLimit))
  .filter(Boolean)
  .slice(0, limit);

export function parseModelJson(raw, label = '模型') {
  const cleaned = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch { /* scan below */ }
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error(`${label}没有返回 JSON 对象。`);
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
      if (depth === 0) {
        try { return JSON.parse(cleaned.slice(start, index + 1)); }
        catch { throw new Error(`${label}返回的 JSON 无法读取。`); }
      }
    }
  }
  throw new Error(`${label}返回的 JSON 不完整。`);
}

export function normalizeTaskBrief(value, source = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const allowedModes = ['original', 'single_work', 'multi_work', 'uploaded_book'];
  const mode = allowedModes.includes(input.mode) ? input.mode : source.mode === 'book' ? 'uploaded_book' : '';
  if (!mode) throw new Error('任务理解阶段没有给出有效的工作方式。');
  const requestedWorks = [...new Map((Array.isArray(input.works) ? input.works : [])
    .map((item) => {
      const title = text(typeof item === 'string' ? item : item?.title, 80);
      const rawQueries = Array.isArray(item?.research_queries) ? item.research_queries : item?.researchQueries || [];
      const researchQueries = rawQueries.map((query) => ({
        dimension: text(query?.dimension ?? query?.type, 40),
        query: text(query?.query ?? query, 120),
      })).filter((query) => query.dimension && query.query).slice(0, 10);
      return title ? [title.toLocaleLowerCase('zh-CN'), {
        title,
        kind: text(item?.kind, 40) || '已有作品',
        role: ['primary', 'secondary'].includes(item?.role) ? item.role : '',
        entryPoint: text(item?.entry_point ?? item?.entryPoint, 500),
        aliases: list(item?.aliases, 6, 80),
        researchQueries,
      }] : null;
    })
    .filter(Boolean)).values()].slice(0, 6);
  const explicitPrimaryIndex = requestedWorks.findIndex((work) => work.role === 'primary');
  const primaryIndex = explicitPrimaryIndex >= 0 ? explicitPrimaryIndex : 0;
  const works = requestedWorks.map((work, index) => ({
    ...work,
    role: index === primaryIndex ? 'primary' : 'secondary',
    entryPoint: work.entryPoint || (index === primaryIndex ? '沿用原著已确认的时间、地点和事件顺序' : '通过任务简报中的时空交汇点进入主世界'),
  }));
  if (mode === 'single_work' && works.length !== 1) throw new Error('任务理解阶段没有识别出一部明确作品。');
  if (mode === 'multi_work' && works.length < 2) throw new Error('任务理解阶段没有识别出至少两部参考作品。');
  const requestedDeliveryMode = text(input.delivery_mode ?? input.deliveryMode, 40);
  const deliveryMode = ['original', 'reconstruct', 'source_expand'].includes(requestedDeliveryMode)
    ? requestedDeliveryMode
    : mode === 'original' ? 'original' : mode === 'uploaded_book' ? 'reconstruct' : 'source_expand';
  const primaryWork = works.find((work) => work.role === 'primary')?.title || '';
  const secondaryWorks = works.filter((work) => work.role === 'secondary').map((work) => work.title);
  const rawFusionPlan = input.fusion_plan ?? input.fusionPlan ?? {};
  const fusionPlan = {
    primaryWorld: text(rawFusionPlan.primary_world ?? rawFusionPlan.primaryWorld, 100) || primaryWork,
    secondaryWorlds: list(rawFusionPlan.secondary_worlds ?? rawFusionPlan.secondaryWorks, 5, 100).length
      ? list(rawFusionPlan.secondary_worlds ?? rawFusionPlan.secondaryWorks, 5, 100)
      : secondaryWorks,
    timeSpaceCorrespondence: text(rawFusionPlan.time_space_correspondence ?? rawFusionPlan.timeSpaceCorrespondence, 900)
      || (mode === 'multi_work' ? `以《${primaryWork}》已经确认的时空为主轴，其他作品只在明确的地点、通道、历史分支或事件后果中进入。` : ''),
    precedence: text(rawFusionPlan.precedence, 600)
      || (mode === 'multi_work' ? `事实冲突时以《${primaryWork}》的原著事实和时间顺序为准，次世界只作补充或形成明确分支。` : ''),
  };
  return {
    schemaVersion: 'world-task/v4',
    mode,
    deliveryMode,
    works: mode === 'original' || mode === 'uploaded_book' ? [] : works,
    primaryWork: mode === 'original' || mode === 'uploaded_book' ? '' : primaryWork,
    secondaryWorks: mode === 'original' || mode === 'uploaded_book' ? [] : secondaryWorks,
    fusionPlan,
    objective: text(input.objective, 500) || '建立一份可阅读、可查阅的世界之书。',
    intendedUse: text(input.intended_use ?? input.intendedUse, 100) || text(source.purpose, 100) || '世界之书',
    scope: text(input.scope, 240) || '由资料和用户说明决定',
    mustPreserve: list(input.must_preserve ?? input.mustPreserve, 16, 300),
    mustAvoid: list(input.must_avoid ?? input.mustAvoid, 16, 300),
    researchQuestions: list(input.research_questions ?? input.researchQuestions, 12, 320),
    interpretation: text(input.interpretation ?? input.reasoning, 500),
  };
}

export function validateTaskResearchPlan(taskBrief) {
  if (!['single_work', 'multi_work'].includes(taskBrief?.mode)) return taskBrief;
  const required = ['plot', 'geography', 'peoples', 'factions', 'daily_life', 'history'];
  const problems = [];
  for (const work of taskBrief.works || []) {
    const targets = work.researchQueries || [];
    const missing = required.filter((dimension) => !targets.some((item) => item.dimension === dimension));
    if (missing.length) problems.push(`《${work.title}》缺少 ${missing.join('、')}`);
    if (targets.filter((item) => item.dimension === 'geography').length < 2) problems.push(`《${work.title}》需要至少两个具体地域目标`);
    if (targets.filter((item) => item.dimension === 'peoples').length < 2) problems.push(`《${work.title}》需要至少两个人物或族群目标`);
    if (targets.length < 8 || targets.length > 10) problems.push(`《${work.title}》需要 8 至 10 个具体资料目标`);
  }
  const primaryWorks = (taskBrief.works || []).filter((work) => work.role === 'primary');
  if (primaryWorks.length !== 1) problems.push('必须恰好指定一部主世界作品');
  if (taskBrief.mode === 'multi_work') {
    const secondaryWorks = (taskBrief.works || []).filter((work) => work.role === 'secondary');
    if (!secondaryWorks.length) problems.push('多作品融合缺少次世界作品');
    if (taskBrief.fusionPlan?.primaryWorld !== primaryWorks[0]?.title) problems.push('融合计划的主世界与作品角色不一致');
    if ((taskBrief.fusionPlan?.timeSpaceCorrespondence || '').length < 30) problems.push('没有说明主次世界的具体时空接入关系');
    if ((taskBrief.fusionPlan?.precedence || '').length < 20) problems.push('没有说明事实冲突时怎样保持主世界连续性');
  }
  if (problems.length) throw new Error(`模型给出的资料目标不完整：${problems.join('；')}。请由模型重新识别并给出具体专名，程序不会代替模型补写。`);
  return taskBrief;
}

function normalizeFinding(item, index) {
  if (typeof item === 'string') return { id: `finding-${index + 1}`, dimension: '结构发现', finding: text(item, 700), evidence: [], confidence: 'medium' };
  return {
    id: text(item?.id, 60) || `finding-${index + 1}`,
    dimension: text(item?.dimension, 80) || '结构发现',
    finding: text(item?.finding, 700),
    evidence: list(item?.evidence, 8, 240),
    confidence: ['high', 'medium', 'low'].includes(item?.confidence) ? item.confidence : 'medium',
  };
}

function normalizeMechanism(item, index) {
  if (typeof item === 'string') return { id: `mechanism-${index + 1}`, name: `机制 ${index + 1}`, description: text(item, 600), consequences: [] };
  return {
    id: text(item?.id, 60) || `mechanism-${index + 1}`,
    name: text(item?.name, 100) || `机制 ${index + 1}`,
    description: text(item?.description, 700),
    consequences: list(item?.consequences, 8, 300),
    sourceBasis: list(item?.source_basis ?? item?.sourceBasis, 6, 220),
  };
}

function normalizeNarrativeElement(item, index) {
  if (typeof item === 'string') return { id: `element-${index + 1}`, source: '', category: '故事内容', name: text(item, 120), description: '', storyFunction: '', transferableValue: '', evidence: [], confidence: 'medium' };
  return {
    id: text(item?.id, 60) || `element-${index + 1}`,
    source: text(item?.source ?? item?.work, 120),
    category: text(item?.category, 80) || '故事内容',
    name: text(item?.name ?? item?.title, 120),
    description: text(item?.description, 700),
    storyFunction: text(item?.story_function ?? item?.storyFunction, 500),
    transferableValue: text(item?.transferable_value ?? item?.transferableValue, 500),
    evidence: list(item?.evidence, 8, 240),
    confidence: ['high', 'medium', 'low'].includes(item?.confidence) ? item.confidence : 'medium',
  };
}

function normalizeKeyEvent(item, index) {
  if (typeof item === 'string') return { id: `event-${index + 1}`, source: '', name: `事件 ${index + 1}`, description: text(item, 700), participants: [], places: [], worldRevealed: '', transferableValue: '', consequences: [], evidence: [], confidence: 'medium' };
  return {
    id: text(item?.id, 60) || `event-${index + 1}`,
    source: text(item?.source ?? item?.work, 120),
    name: text(item?.name ?? item?.title, 140) || `事件 ${index + 1}`,
    description: text(item?.description ?? item?.what_happened, 800),
    participants: list(item?.participants, 10, 140),
    places: list(item?.places, 8, 140),
    worldRevealed: text(item?.world_revealed ?? item?.worldRevealed, 500),
    transferableValue: text(item?.transferable_value ?? item?.transferableValue, 500),
    consequences: list(item?.consequences, 10, 320),
    evidence: list(item?.evidence, 8, 240),
    confidence: ['high', 'medium', 'low'].includes(item?.confidence) ? item.confidence : 'medium',
  };
}

function normalizeSourceImpression(item) {
  return {
    source: text(item?.source ?? item?.work, 120),
    presentation: text(item?.presentation, 700),
    memorableContent: list(item?.memorable_content ?? item?.memorableContent, 12, 320),
    usableMaterial: text(item?.usable_material ?? item?.usableMaterial, 600),
  };
}

function normalizeQuestionAnswer(item) {
  return {
    question: text(item?.question, 320),
    answer: text(item?.answer, 900),
    evidence: list(item?.evidence, 10, 120),
  };
}

function normalizePlotArc(item) {
  return {
    source: text(item?.source ?? item?.work, 120),
    startingSituation: text(item?.starting_situation ?? item?.startingSituation, 700),
    stages: (Array.isArray(item?.stages) ? item.stages : []).map((stage, index) => ({
      id: text(stage?.id, 60) || `stage-${index + 1}`,
      name: text(stage?.name ?? stage?.title, 140),
      summary: text(stage?.summary ?? stage?.description, 800),
      places: list(stage?.places, 8, 140),
      participants: list(stage?.participants, 10, 140),
      evidence: list(stage?.evidence, 8, 120),
    })).filter((stage) => stage.name && stage.summary).slice(0, 12),
    endingSituation: text(item?.ending_situation ?? item?.endingSituation, 700),
    evidence: list(item?.evidence, 12, 120),
  };
}

export function normalizeResearchDossier(value, taskBrief, references = []) {
  const input = value && typeof value === 'object' ? value : {};
  const findings = (Array.isArray(input.structural_findings) ? input.structural_findings : input.structuralFindings || [])
    .map(normalizeFinding).filter((item) => item.finding).slice(0, 24);
  const mechanisms = (Array.isArray(input.mechanisms) ? input.mechanisms : [])
    .map(normalizeMechanism).filter((item) => item.description).slice(0, 18);
  const narrativeElements = (Array.isArray(input.narrative_elements) ? input.narrative_elements : input.narrativeElements || [])
    .map(normalizeNarrativeElement).filter((item) => item.name && (item.description || item.storyFunction)).slice(0, 30);
  const keyEvents = (Array.isArray(input.key_events) ? input.key_events : input.keyEvents || [])
    .map(normalizeKeyEvent).filter((item) => item.name && item.description).slice(0, 20);
  const sourceImpressions = (Array.isArray(input.source_impressions) ? input.source_impressions : input.sourceImpressions || [])
    .map(normalizeSourceImpression).filter((item) => item.source && (item.presentation || item.memorableContent.length)).slice(0, 8);
  const questionAnswers = (Array.isArray(input.question_answers) ? input.question_answers : input.questionAnswers || [])
    .map(normalizeQuestionAnswer).filter((item) => item.question && item.answer).slice(0, 12);
  const plotArcs = (Array.isArray(input.plot_arcs) ? input.plot_arcs : input.plotArcs || [])
    .map(normalizePlotArc).filter((item) => item.source && item.stages.length).slice(0, 8);
  const normalizedReferences = (Array.isArray(references) ? references : []).map((item) => ({
    title: text(item?.title, 160), url: text(item?.url, 800), provider: text(item?.provider, 80), kind: text(item?.kind, 80), workTitle: text(item?.workTitle, 100), researchDimension: text(item?.researchDimension, 40), researchQuery: text(item?.researchQuery, 120),
  })).filter((item) => item.title && item.url).slice(0, 40).map((item, index) => ({ id: `source-${index + 1}`, ...item }));
  return {
    schemaVersion: 'world-research/v3',
    mode: taskBrief.mode,
    summary: text(input.summary ?? input.source_summary, 1_500) || '已根据现有输入建立研究档案。',
    narrativeElements,
    keyEvents,
    sourceImpressions,
    plotArcs,
    questionAnswers,
    structuralFindings: findings,
    mechanisms,
    confirmedFacts: list(input.confirmed_facts ?? input.confirmedFacts, 60, 500),
    conflicts: list(input.conflicts ?? input.contested, 20, 500),
    gaps: list(input.gaps ?? input.unknowns, 24, 500),
    designConstraints: list(input.design_constraints ?? input.designConstraints, 24, 400),
    references: normalizedReferences,
  };
}

export function validateNarrativeResearch(dossier, taskBrief = {}) {
  if (!dossier?.summary || dossier.summary.length < 120) throw new Error('故事概况过短，没有说明原作或材料具体讲了什么。');
  const existingWork = ['single_work', 'multi_work', 'uploaded_book'].includes(taskBrief?.mode);
  if (existingWork && !(dossier.narrativeElements?.length || dossier.keyEvents?.length || dossier.confirmedFacts?.length)) {
    throw new Error('研究档案没有整理出人物、地方、风物或社会内容，也没有关键事件可作为世界方向依据。');
  }
  const addGap = (message) => {
    if (!dossier.gaps.includes(message)) dossier.gaps.push(message);
  };
  const workCount = Array.isArray(taskBrief?.works) ? taskBrief.works.length : 0;
  if (workCount) {
    const categoryGroups = {
      geography: /地方|地域|地理|国度|城市|聚落/,
      peoples: /族群|种族|人物或群体|居民|生物/,
      factions: /组织|制度|职业|势力|宗教/,
      dailyLife: /民风|日常|风俗|生活/,
    };
    for (const work of taskBrief.works || []) {
      const sourceKey = comparable(work.title);
      const elements = (dossier.narrativeElements || []).filter((item) => comparable(item.source) === sourceKey);
      const events = (dossier.keyEvents || []).filter((item) => comparable(item.source) === sourceKey);
      const arc = (dossier.plotArcs || []).find((item) => comparable(item.source) === sourceKey);
      const impression = (dossier.sourceImpressions || []).find((item) => comparable(item.source) === sourceKey);
      if (!elements.length && !events.length && !impression) addGap(`《${work.title}》暂时只取得概述性资料；后续先保留已确认内容，再把未取得的部分标为缺口，不能用无关新设定替换。`);
      if (!arc || arc.stages.length < 2 || !arc.startingSituation || !arc.endingSituation) addGap(`《${work.title}》的完整情节线尚未还原，不把缺失部分冒充原作事实。`);
      if (events.length < 1) addGap(`《${work.title}》缺少可核对的关键事件，方向阶段可创造新的公共历史，但不称其为原作事件。`);
      for (const [dimension, pattern] of Object.entries(categoryGroups)) {
        const minimum = dimension === 'geography' || dimension === 'peoples' ? 2 : 1;
        if (elements.filter((item) => pattern.test(item.category)).length < minimum) {
          const label = { geography: '地域', peoples: '种族或族群', factions: '组织势力', dailyLife: '民风日常' }[dimension];
          addGap(`《${work.title}》可核对的${label}材料有限；新方向可以进行原创补全，但不能冒充原作事实。`);
        }
      }
    }
  }
  const questions = taskBrief?.researchQuestions || [];
  const answered = new Set((dossier.questionAnswers || []).map((item) => comparable(item.question)));
  for (const question of questions) {
    if (!answered.has(comparable(question))) addGap(`尚未回答：“${question}”。这不会阻断方向生成。`);
  }
  const allowedEvidence = new Set((dossier.references || []).map((item) => item.id));
  if (allowedEvidence.size) {
    for (const material of [...(dossier.narrativeElements || []), ...(dossier.keyEvents || [])]) {
      if (!material.evidence.some((id) => allowedEvidence.has(id))) throw new Error(`研究材料“${material.name}”没有指向实际取得的资料编号。`);
    }
    for (const answer of dossier.questionAnswers || []) {
      if (!answer.evidence.some((id) => allowedEvidence.has(id))) throw new Error(`研究问题“${answer.question}”的回答没有指向实际取得的资料编号。`);
    }
    for (const arc of dossier.plotArcs || []) {
      if (!arc.evidence.some((id) => allowedEvidence.has(id))) throw new Error(`《${arc.source}》的情节总线没有指向实际资料编号。`);
      for (const stage of arc.stages) {
        if (!stage.evidence.some((id) => allowedEvidence.has(id))) throw new Error(`情节阶段“${stage.name}”没有指向实际资料编号。`);
      }
    }
  }
  if (!existingWork && !(dossier.narrativeElements?.length || dossier.confirmedFacts?.length)) throw new Error('研究档案没有找到可供继续创造的故事材料。');
  return dossier;
}

function comparable(value) {
  return text(value, 160).replace(/[《》〈〉「」『』“”"'\s·:：()（）_-]/g, '').toLocaleLowerCase('zh-CN');
}

function matchesWorkName(value, work) {
  const candidate = comparable(value);
  return [work?.title, ...(work?.aliases || [])].some((name) => comparable(name) === candidate);
}

function researchMaterialMap(dossier) {
  const entries = [
    ...(dossier?.narrativeElements || []).map((item) => [item.id, { ...item, kind: 'story_element' }]),
    ...(dossier?.keyEvents || []).map((item) => [item.id, { ...item, kind: 'key_event' }]),
  ].filter(([id]) => id);
  return new Map(entries);
}

function researchMaterialGroup(material) {
  if (material?.kind === 'key_event') return 'event';
  const category = material?.category || '';
  if (/地方|地域|地理|国度|城市|聚落/.test(category)) return 'place';
  if (/族群|种族|人物或群体|居民|生物/.test(category)) return 'people';
  if (/组织|制度|职业|势力|宗教/.test(category)) return 'faction';
  if (/民风|日常|风俗|生活/.test(category)) return 'daily_life';
  return 'other';
}

function inferCanonRef(material, canon) {
  const byGroup = {
    place: canon?.spatialOrder?.regions || [],
    people: [...(canon?.societies || []), ...(canon?.entities || [])],
    faction: [...(canon?.institutions || []), ...(canon?.societies || [])],
    event: canon?.history || [],
    daily_life: canon?.dailyLife || [],
    other: canonEntries(canon),
  };
  const candidates = byGroup[researchMaterialGroup(material)] || [];
  const name = comparable(material?.name).replace(/原著|资料|相关|中的|里的/g, '');
  const grams = [...new Set([...name].map((_, index) => name.slice(index, index + 2)).filter((item) => item.length === 2))];
  if (!grams.length) return '';
  const ranked = candidates.map((entry) => {
    const body = comparable(JSON.stringify(entry));
    return { id: entry.id, score: grams.filter((gram) => body.includes(gram)).length };
  }).sort((left, right) => right.score - left.score);
  return ranked[0]?.score >= 2 ? ranked[0].id : '';
}

function normalizeResearchRoots(value, dossier) {
  const materials = researchMaterialMap(dossier);
  return (Array.isArray(value) ? value : []).map((item) => {
    const researchId = text(item?.research_id ?? item?.researchId ?? item?.id, 60);
    const material = materials.get(researchId);
    if (!researchId || !material) return null;
    const researchContent = material.description || material.worldRevealed || material.storyFunction || material.name;
    return {
      researchId,
      kind: material.kind,
      category: material.category || '',
      source: material.source || text(item?.source ?? item?.work, 120),
      name: material.name,
      newName: text(item?.new_name ?? item?.newName ?? item?.adapted_name ?? item?.adaptedName, 120),
      researchContent: text(researchContent, 800),
      transformation: text(item?.transformation ?? item?.transformed ?? item?.changed, 700),
      visibleResult: text(item?.visible_result ?? item?.visibleResult ?? item?.result, 700),
    };
  }).filter(Boolean).slice(0, 8);
}

function normalizeResearchRefs(value, dossier) {
  const materials = researchMaterialMap(dossier);
  return (Array.isArray(value) ? value : []).map((item) => {
    const researchId = text(typeof item === 'string' ? item : item?.research_id ?? item?.researchId ?? item?.id, 60);
    const material = materials.get(researchId);
    if (!researchId || !material) return null;
    return {
      researchId,
      kind: material.kind,
      category: material.category || '',
      source: material.source || '',
      name: material.name,
    };
  }).filter(Boolean).slice(0, 12);
}

function readableList(value, limit = 8) {
  return (Array.isArray(value) ? value : []).map((item) => {
    if (typeof item === 'string') return text(item, 500);
    const name = text(item?.name ?? item?.title, 100);
    const description = text(item?.description ?? item?.detail ?? item?.fact, 450);
    return name && description ? `${name}：${description}` : name || description;
  }).filter(Boolean).slice(0, limit);
}

function normalizeSourceTreatment(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    source: text(item?.source ?? item?.work, 100),
    retained: text(item?.retained ?? item?.kept, 500),
    transformed: text(item?.transformed ?? item?.changed, 500),
    visibleResult: text(item?.visible_result ?? item?.visibleResult ?? item?.result, 500),
  })).filter((item) => item.source && (item.retained || item.transformed || item.visibleResult)).slice(0, 6);
}

function normalizeSourceFoundations(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    source: text(item?.source ?? item?.work, 100),
    plot: text(item?.plot, 700),
    geography: list(item?.geography, 8, 220),
    peoples: list(item?.peoples ?? item?.races, 8, 220),
    factions: list(item?.factions ?? item?.institutions, 8, 220),
    dailyLife: list(item?.daily_life ?? item?.dailyLife, 8, 220),
    recombination: text(item?.recombination ?? item?.transformation, 800),
  })).filter((item) => item.source).slice(0, 6);
}

function normalizeSecondaryIntegration(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    source: text(item?.source ?? item?.work, 100),
    entryPoint: text(item?.entry_point ?? item?.entryPoint, 600),
    retained: text(item?.retained ?? item?.preserved, 700),
  })).filter((item) => item.source && item.entryPoint).slice(0, 6);
}

export function normalizeDirectionResult(value, taskBrief = {}, researchDossier = null) {
  const input = value && typeof value === 'object' ? value : {};
  if (!Array.isArray(input.cards) || input.cards.length !== 3) throw new Error('世界建筑师没有返回恰好 3 个世界方向。');
  const availableMaterials = researchMaterialMap(researchDossier);
  const taskWorks = taskBrief.works || [];
  const primaryWork = taskWorks.find((work) => work.role === 'primary') || taskWorks[0];
  const secondaryWorks = taskWorks.filter((work) => work !== primaryWork && (work.role === 'secondary' || !work.role));
  const cards = input.cards.map((card, index) => {
    const requestedRefs = Array.isArray(card?.research_refs) ? card.research_refs : card?.researchRefs || card?.research_roots || card?.researchRoots || [];
    const invalidRef = requestedRefs.find((item) => {
      const id = text(typeof item === 'string' ? item : item?.research_id ?? item?.researchId ?? item?.id, 60);
      return id && !availableMaterials.has(id);
    });
    if (invalidRef) throw new Error(`第 ${index + 1} 个方向引用了研究档案中不存在的材料编号。`);
    const normalized = {
      ...card,
      name: text(card?.name, 100),
      one_line: text(card?.one_line, 300),
      overview: text(card?.overview, 500),
      construction_mode: ['original', 'reconstruct', 'source_expand'].includes(card?.construction_mode)
        ? card.construction_mode
        : taskBrief.deliveryMode,
      primary_continuity: text(card?.primary_continuity ?? card?.primaryContinuity, 900),
      secondary_integration: normalizeSecondaryIntegration(card?.secondary_integration ?? card?.secondaryIntegration),
      source_treatment: normalizeSourceTreatment(card?.source_treatment),
      source_foundations: normalizeSourceFoundations(card?.source_foundations ?? card?.sourceFoundations),
      research_roots: normalizeResearchRoots(card?.research_roots ?? card?.researchRoots, researchDossier),
      research_refs: normalizeResearchRefs(requestedRefs, researchDossier),
    };
    if (!normalized.name || !normalized.one_line || normalized.overview.length < 140) {
      throw new Error(`第 ${index + 1} 个方向没有形成约 200 字的可读简介。`);
    }
    if (normalized.overview.length > 360) {
      throw new Error(`第 ${index + 1} 个方向超过方向阶段需要的篇幅；这里只需要约 200 字简介。`);
    }
    return normalized;
  });
  if (['single_work', 'multi_work'].includes(taskBrief?.mode)) {
    for (const [index, card] of cards.entries()) {
      for (const work of taskBrief.works || []) {
        if (!card.research_refs.some((item) => matchesWorkName(item.source, work))) {
          throw new Error(`第 ${index + 1} 个方向没有使用《${work.title}》的研究材料。`);
        }
      }
      const primaryRefs = card.research_refs.filter((item) => matchesWorkName(item.source, primaryWork));
      if (!primaryWork || card.primary_continuity.length < 40) throw new Error(`第 ${index + 1} 个方向没有说明主世界的原著连续性。`);
      if (!primaryRefs.some((item) => containsAnchor(`${card.overview} ${card.primary_continuity}`, item.name))) {
        const anchorNames = primaryRefs.map((item) => item.name).filter(Boolean).slice(0, 2);
        if (!anchorNames.length) throw new Error(`第 ${index + 1} 个方向没有可用的《${primaryWork.title}》原著锚点。`);
        const anchorNote = `原作锚点：${anchorNames.join('、')}。`;
        card.overview = `${card.overview.replace(/[。！？!?]?$/, '')}。${anchorNote}`.slice(0, 360);
      }
      for (const secondaryWork of secondaryWorks) {
        const integration = card.secondary_integration.find((item) => matchesWorkName(item.source, secondaryWork));
        if (!integration || integration.entryPoint.length < 20 || integration.retained.length < 20) {
          throw new Error(`第 ${index + 1} 个方向没有说明《${secondaryWork.title}》进入主世界的时空节点和保留内容。`);
        }
      }
    }
  }
  const availableResearch = researchMaterialMap(researchDossier);
  if (availableResearch.size && ['single_work', 'multi_work'].includes(taskBrief?.mode)) {
    for (const [index, card] of cards.entries()) {
      const uniqueRefs = [...new Map(card.research_refs.map((item) => [item.researchId, item])).values()];
      const minimumRefs = Math.min(taskBrief?.mode === 'multi_work' ? 4 : 2, availableResearch.size);
      if (uniqueRefs.length < minimumRefs) throw new Error(`第 ${index + 1} 个方向没有使用足够的具体研究材料。`);
      if (taskBrief?.mode === 'multi_work') {
        for (const work of taskBrief.works || []) {
          if (!uniqueRefs.some((item) => matchesWorkName(item.source, work))) throw new Error(`第 ${index + 1} 个方向没有实际使用《${work.title}》的研究材料。`);
        }
      }
      for (const work of taskBrief.works || []) {
        const workRefs = uniqueRefs.filter((item) => matchesWorkName(item.source, work));
        const availableForWork = [...availableResearch.values()].filter((item) => matchesWorkName(item.source, work));
        const expectedRefs = Math.min(2, availableForWork.length);
        if (workRefs.length < expectedRefs) throw new Error(`第 ${index + 1} 个方向没有使用《${work.title}》已经取得的具体材料。`);
      }
    }
    const allUsedIds = new Set(cards.flatMap((card) => card.research_refs.map((item) => item.researchId)));
    for (const work of taskBrief.works || []) {
      const availableForWork = [...availableResearch.values()].filter((item) => matchesWorkName(item.source, work));
      const usedGroups = new Set(availableForWork.filter((item) => allUsedIds.has(item.id)).map(researchMaterialGroup));
      for (const [group, label] of [['place', '地域或地点'], ['people', '角色、种族或族群'], ['event', '关键事件']]) {
        const candidates = availableForWork.filter((item) => researchMaterialGroup(item) === group);
        if (candidates.length && !usedGroups.has(group)) {
          const candidateText = candidates.slice(0, 8).map((item) => `${item.id}（${item.name}）`).join('、');
          throw new Error(`三个方向合起来没有使用《${work.title}》研究中已经取得的${label}；请在 research_refs 中选择一项：${candidateText}。`);
        }
      }
    }
  }
  return { cards, comparison: text(input.comparison, 1_000) };
}

function objectList(value, limit, mapper) {
  return (Array.isArray(value) ? value : []).map(mapper).filter(Boolean).slice(0, limit);
}

export const CANON_SECTION_IDS = ['C1', 'C2', 'C3', 'C4'];

export function mergeCanonSections(sections = {}) {
  return CANON_SECTION_IDS.reduce((merged, section) => ({ ...merged, ...(sections?.[section] || {}) }), {});
}

export function normalizeCanonSection(value, section, seed, taskBrief = {}) {
  const input = value && typeof value === 'object' ? value : {};
  if (!CANON_SECTION_IDS.includes(section)) throw new Error('未知的世界基础步骤。');
  if (section === 'C1') {
    const identity = input.identity || {};
    const sourcePlan = input.source_plan ?? input.sourcePlan ?? {};
    const selectedName = text(seed?.name, 100);
    const suppliedName = text(identity.name, 100);
    if (!suppliedName || (selectedName && comparable(suppliedName) !== comparable(selectedName))) throw new Error('世界名称必须与选定方向一致。');
    if (text(identity.one_line ?? identity.oneLine, 300).length < 12 || text(identity.thesis, 700).length < 24) throw new Error('世界定位没有说明清楚一句话总览和根本事实。');
    const primaryWork = taskBrief?.primaryWork || (taskBrief?.works || []).find((work) => work.role === 'primary')?.title || '';
    const primary = text(sourcePlan.primary_work ?? sourcePlan.primaryWork, 100) || primaryWork;
    if (['single_work', 'multi_work', 'uploaded_book'].includes(taskBrief?.mode) && !primary) throw new Error('世界边界没有指定需要优先延续的主世界。');
    if (taskBrief?.mode === 'multi_work' && text(sourcePlan.time_space_correspondence ?? sourcePlan.timeSpaceCorrespondence, 1_000).length < 30) throw new Error('主次世界的具体时空接入点没有说明清楚。');
    return {
      identity: { name: suppliedName, one_line: text(identity.one_line ?? identity.oneLine, 300), thesis: text(identity.thesis, 700) },
      source_plan: {
        policy: 'source_first', primary_work: primary,
        secondary_works: list(sourcePlan.secondary_works ?? sourcePlan.secondaryWorks, 6, 100),
        time_space_correspondence: text(sourcePlan.time_space_correspondence ?? sourcePlan.timeSpaceCorrespondence, 1_000),
        precedence: text(sourcePlan.precedence, 700),
      },
    };
  }
  if (section === 'C2') {
    const axioms = Array.isArray(input.axioms) ? input.axioms.slice(0, 12) : [];
    const spatialOrder = input.spatial_order ?? input.spatialOrder ?? {};
    const regions = Array.isArray(spatialOrder.regions) ? spatialOrder.regions.slice(0, 16) : [];
    if (axioms.length < 2) throw new Error('规律与地方步骤至少需要两条核心规律。');
    if (!regions.length) throw new Error('规律与地方步骤没有形成可以辨认的地域。');
    return { axioms, spatial_order: { overview: text(spatialOrder.overview, 900), regions, relations: list(spatialOrder.relations, 24, 400) } };
  }
  if (section === 'C3') {
    const history = Array.isArray(input.history) ? input.history.slice(0, 18) : [];
    const societies = Array.isArray(input.societies) ? input.societies.slice(0, 14) : [];
    const institutions = Array.isArray(input.institutions) ? input.institutions.slice(0, 14) : [];
    if (!history.length) throw new Error('历史与社会步骤没有说明形成今天格局的事件。');
    if (!societies.length) throw new Error('历史与社会步骤没有说明主要居民或共同体。');
    if (!institutions.length) throw new Error('历史与社会步骤没有说明影响普通生活的制度或组织。');
    return { history, societies, institutions };
  }
  const dailyLife = input.daily_life ?? input.dailyLife;
  const sourceContinuity = input.source_continuity ?? input.sourceContinuity;
  if (!Array.isArray(dailyLife) || dailyLife.length < 3) throw new Error('日常与关键条目步骤至少需要三项具体生活事实。');
  if (!Array.isArray(input.entities) || input.entities.length < 4) throw new Error('日常与关键条目步骤至少需要四个重要名称。');
  if (['single_work', 'multi_work', 'uploaded_book'].includes(taskBrief?.mode) && !Array.isArray(sourceContinuity)) throw new Error('日常与关键条目步骤没有建立原著材料与正典条目的对应关系。');
  return {
    daily_life: dailyLife.slice(0, 7), entities: input.entities.slice(0, 12),
    source_continuity: Array.isArray(sourceContinuity) ? sourceContinuity.slice(0, 60) : [],
    extensions: Array.isArray(input.extensions) ? input.extensions.slice(0, 40) : [],
    tensions: list(input.tensions, 16, 500), unknowns: list(input.unknowns, 20, 500),
    evidence_policy: text(input.evidence_policy ?? input.evidencePolicy, 800),
  };
}

export function normalizeWorldCanon(value, seed, dossier, taskBrief = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const axioms = objectList(input.axioms, 12, (item, index) => {
    const statement = text(item?.statement ?? item, 500);
    return statement ? { id: text(item?.id, 60) || `axiom-${index + 1}`, statement, consequences: list(item?.consequences, 10, 320), limits: list(item?.limits, 8, 300) } : null;
  });
  if (axioms.length < 2) throw new Error('世界正典缺少足以支撑世界运行的核心规律。');
  const entity = (item, index, type) => {
    const name = text(item?.name, 100);
    if (!name) return null;
    return { id: text(item?.id, 60) || `${type}-${index + 1}`, name, type: text(item?.type, 60) || type, definition: text(item?.definition ?? item?.description, 600), importance: text(item?.importance, 400), relations: list(item?.relations, 12, 250) };
  };
  const suppliedName = text(input.identity?.name, 100);
  const selectedName = text(seed?.name, 100);
  if (suppliedName && selectedName && comparable(suppliedName) !== comparable(selectedName)) throw new Error('世界正典擅自更换了用户选定方向的名称。');
  const primaryWork = taskBrief?.primaryWork || (taskBrief?.works || []).find((work) => work.role === 'primary')?.title || '';
  const secondaryWorks = taskBrief?.secondaryWorks?.length
    ? taskBrief.secondaryWorks
    : (taskBrief?.works || []).filter((work) => work.role === 'secondary').map((work) => work.title);
  const inputSourcePlan = input.source_plan ?? input.sourcePlan ?? {};
  const canon = {
    schemaVersion: 'world-canon/v4',
    mode: seed?.construction_mode || taskBrief?.deliveryMode || dossier?.mode || 'original',
    identity: {
      name: selectedName || suppliedName,
      oneLine: text(input.identity?.one_line ?? input.identity?.oneLine, 300) || text(seed?.one_line, 300),
      thesis: text(input.identity?.thesis, 700) || text(seed?.world_thesis, 700),
    },
    sourcePlan: {
      policy: 'source_first',
      primaryWork: text(inputSourcePlan.primary_work ?? inputSourcePlan.primaryWork, 100) || primaryWork,
      secondaryWorks: list(inputSourcePlan.secondary_works ?? inputSourcePlan.secondaryWorks, 6, 100).length
        ? list(inputSourcePlan.secondary_works ?? inputSourcePlan.secondaryWorks, 6, 100)
        : secondaryWorks,
      timeSpaceCorrespondence: text(inputSourcePlan.time_space_correspondence ?? inputSourcePlan.timeSpaceCorrespondence, 1_000)
        || text(taskBrief?.fusionPlan?.timeSpaceCorrespondence, 1_000),
      precedence: text(inputSourcePlan.precedence, 700) || text(taskBrief?.fusionPlan?.precedence, 700),
    },
    axioms,
    spatialOrder: {
      overview: text(input.spatial_order?.overview ?? input.spatialOrder?.overview, 900),
      regions: objectList(input.spatial_order?.regions ?? input.spatialOrder?.regions, 16, (item, index) => entity(item, index, 'region')),
      relations: list(input.spatial_order?.relations ?? input.spatialOrder?.relations, 24, 400),
    },
    societies: objectList(input.societies, 14, (item, index) => entity(item, index, 'society')),
    institutions: objectList(input.institutions, 14, (item, index) => entity(item, index, 'institution')),
    history: objectList(input.history, 18, (item, index) => {
      const event = text(item?.event ?? item, 500);
      return event ? { id: text(item?.id, 60) || `history-${index + 1}`, era: text(item?.era, 120), event, causes: list(item?.causes, 8, 250), consequences: list(item?.consequences, 10, 300), presentTraces: list(item?.present_traces ?? item?.presentTraces, 8, 260) } : null;
    }),
    dailyLife: objectList(input.daily_life ?? input.dailyLife, 18, (item, index) => {
      const fact = text(item?.fact ?? item, 500);
      return fact ? { id: text(item?.id, 60) || `life-${index + 1}`, topic: text(item?.topic, 100) || '日常生活', fact, dependsOn: list(item?.depends_on ?? item?.dependsOn, 8, 180) } : null;
    }),
    entities: objectList(input.entities, 28, (item, index) => entity(item, index, 'entity')),
    tensions: list(input.tensions, 16, 500),
    unknowns: list(input.unknowns, 20, 500),
    evidencePolicy: text(input.evidence_policy ?? input.evidencePolicy, 800),
  };
  const idGroups = [
    ['axiom', canon.axioms], ['region', canon.spatialOrder.regions], ['society', canon.societies],
    ['institution', canon.institutions], ['history', canon.history], ['life', canon.dailyLife], ['entity', canon.entities],
  ];
  const usedCanonIds = new Set();
  for (const [prefix, entries] of idGroups) {
    for (const [index, entry] of entries.entries()) {
      let candidate = entry.id;
      if (!candidate || usedCanonIds.has(candidate)) {
        let ordinal = index + 1;
        do candidate = `${prefix}-${ordinal++}`; while (usedCanonIds.has(candidate));
        entry.id = candidate;
      }
      usedCanonIds.add(candidate);
    }
  }
  const validCanonIds = new Set(canonEntries(canon).map((item) => item.id));
  for (const entry of [...canon.spatialOrder.regions, ...canon.societies, ...canon.institutions, ...canon.entities]) {
    entry.relations = entry.relations.filter((id) => validCanonIds.has(id));
  }
  for (const entry of canon.dailyLife) entry.dependsOn = entry.dependsOn.filter((id) => validCanonIds.has(id));
  const materials = researchMaterialMap(dossier);
  const rawContinuity = input.source_continuity ?? input.sourceContinuity ?? input.direction_trace ?? input.directionTrace;
  canon.sourceContinuity = objectList(rawContinuity, 60, (item) => {
    const researchId = text(item?.research_id ?? item?.researchId, 60);
    const material = materials.get(researchId);
    if (!researchId || !material) return null;
    const role = (taskBrief?.works || []).find((work) => matchesWorkName(material.source, work))?.role
      || (taskBrief?.mode === 'uploaded_book' ? 'primary' : 'source');
    const treatment = ['preserved', 'extended', 'fused'].includes(item?.treatment) ? item.treatment : '';
    const timeSpace = text(item?.time_space_correspondence ?? item?.timeSpaceCorrespondence, 800);
    const explanation = text(item?.explanation, 700);
    const extensionReason = text(item?.extension_reason ?? item?.extensionReason, 700);
    return {
      researchId,
      source: material.source || '用户材料',
      originalName: material.name,
      role,
      canonRefs: list(item?.canon_refs ?? item?.canonRefs, 16, 60),
      treatment,
      timeSpaceCorrespondence: timeSpace.length >= 8
        ? timeSpace
        : `对应《${material.source || '原著'}》中“${material.name}”所在的原著时空。`,
      explanation: explanation.length >= 8
        ? explanation
        : `保留“${material.name}”并接入所列正典条目。`,
      extensionReason: extensionReason.length >= 8
        ? extensionReason
        : (treatment && treatment !== 'preserved' ? '在保留原著内容的前提下，补足本世界当前部分所需的连接。' : ''),
    };
  });
  for (const continuity of canon.sourceContinuity) {
    const confusedResearchIdWithCanonId = continuity.canonRefs.includes(continuity.researchId);
    continuity.canonRefs = continuity.canonRefs.filter((id) => validCanonIds.has(id));
    if (!continuity.canonRefs.length && confusedResearchIdWithCanonId) {
      const inferred = inferCanonRef(materials.get(continuity.researchId), canon);
      if (inferred) continuity.canonRefs = [inferred];
    }
  }
  const canonEntryMap = new Map(canonEntries(canon).map((item) => [item.id, item]));
  for (const continuity of canon.sourceContinuity) {
    for (const canonRef of continuity.canonRefs) {
      const entry = canonEntryMap.get(canonRef);
      if (!entry) continue;
      entry.sourceAnchors = [...new Set([...(entry.sourceAnchors || []), continuity.originalName])];
    }
  }
  canon.extensions = objectList(input.extensions, 40, (item) => {
    const basis = ['research_gap', 'fusion_bridge', 'user_request'].includes(item?.basis) ? item.basis : '';
    const canonRefs = list(item?.canon_refs ?? item?.canonRefs, 20, 60).filter((id) => validCanonIds.has(id));
    if (!basis || !canonRefs.length) return null;
    return {
      canonRefs,
      basis,
      reason: text(item?.reason, 800),
      preserves: list(item?.preserves, 20, 60),
    };
  });
  canon.directionTrace = canon.sourceContinuity.map((item) => ({
    researchId: item.researchId,
    canonRefs: item.canonRefs,
    explanation: item.explanation,
  }));
  const existingWork = ['single_work', 'multi_work', 'uploaded_book'].includes(taskBrief?.mode);
  if (existingWork) {
    if (!canon.sourcePlan.primaryWork) throw new Error('世界正典没有指定需要优先延续的主世界。');
    if (taskBrief.mode === 'multi_work') {
      if (comparable(canon.sourcePlan.primaryWork) !== comparable(primaryWork)) throw new Error('世界正典擅自更换了任务简报确定的主世界。');
      for (const secondaryWork of secondaryWorks) {
        if (!canon.sourcePlan.secondaryWorks.some((item) => comparable(item) === comparable(secondaryWork))) throw new Error(`世界正典遗漏了次世界《${secondaryWork}》。`);
      }
      if (canon.sourcePlan.timeSpaceCorrespondence.length < 30) throw new Error('世界正典没有说明主次世界的具体时空接入点。');
      if (canon.sourcePlan.precedence.length < 20) throw new Error('世界正典没有说明事实冲突时怎样保持主世界连续性。');
    }
    const continuityMap = new Map(canon.sourceContinuity.map((item) => [item.researchId, item]));
    for (const [researchId, material] of materials) {
      const continuity = continuityMap.get(researchId);
      if (!continuity) throw new Error(`世界正典没有承接研究中的原著材料 ${researchId}（${material.name}）。`);
      if (!continuity.canonRefs.length || continuity.canonRefs.some((id) => !validCanonIds.has(id))) throw new Error(`原著材料 ${researchId} 没有指向真实存在的正典条目。`);
      if (!continuity.treatment) throw new Error(`原著材料 ${researchId} 没有说明是保留、延续还是融合。`);
      if (continuity.role === 'primary' && continuity.treatment === 'fused') throw new Error(`主世界材料“${material.name}”不能被融合后替换，必须保持或延续。`);
      if (continuity.timeSpaceCorrespondence.length < 8) throw new Error(`原著材料“${material.name}”没有说明对应的原著时空位置。`);
      if (continuity.explanation.length < 8) throw new Error(`原著材料“${material.name}”如何进入正典没有说明清楚。`);
      if (continuity.treatment !== 'preserved' && continuity.extensionReason.length < 8) throw new Error(`原著材料“${material.name}”发生扩展或融合，却没有说明资料缺口或融合需要。`);
    }
    for (const extension of canon.extensions) {
      if (extension.canonRefs.some((id) => !validCanonIds.has(id))) throw new Error('扩展说明指向了不存在的正典条目。');
      if (extension.reason.length < 8) throw new Error('扩展内容没有说明原著为何不足以支撑这项新增。');
      if (extension.preserves.some((id) => !materials.has(id))) throw new Error('扩展内容声明保留了不存在的研究材料。');
    }
  }
  const selectedMaterials = seed?.research_refs ?? seed?.researchRefs ?? seed?.research_roots ?? seed?.researchRoots ?? [];
  const selectedResearchIds = [...new Set(selectedMaterials.map((item) => text(typeof item === 'string' ? item : item?.research_id ?? item?.researchId, 60)).filter(Boolean))];
  if (selectedResearchIds.length) {
    const traced = new Map(canon.sourceContinuity.map((item) => [item.researchId, item]));
    for (const researchId of selectedResearchIds) {
      const trace = traced.get(researchId);
      if (!trace) throw new Error(`世界正典没有落实选定方向使用的研究材料 ${researchId}。`);
      if (!trace.canonRefs.length || trace.canonRefs.some((id) => !validCanonIds.has(id))) throw new Error(`研究材料 ${researchId} 没有指向真实存在的正典条目。`);
      if (trace.explanation.length < 12) throw new Error(`研究材料 ${researchId} 如何进入正典没有说明清楚。`);
    }
  }
  return canon;
}

function canonEntries(canon) {
  return [
    ...(canon?.axioms || []),
    ...(canon?.spatialOrder?.regions || []),
    ...(canon?.societies || []),
    ...(canon?.institutions || []),
    ...(canon?.history || []),
    ...(canon?.dailyLife || []),
    ...(canon?.entities || []),
  ].filter((item) => item?.id);
}

function containsAnchor(content, value) {
  const anchor = text(value, 200);
  if (!anchor) return false;
  const compactContent = String(content ?? '').replace(/\s+/g, '');
  const compactAnchor = anchor.replace(/\s+/g, '');
  return compactContent.includes(compactAnchor) || compactContent.includes(compactAnchor.slice(0, Math.min(12, compactAnchor.length)));
}

function containsSourceAnchor(content, value) {
  if (containsAnchor(content, value)) return true;
  const compactContent = String(content ?? '').replace(/\s+/g, '');
  const candidates = String(value ?? '')
    .split(/中的|里的|之中的|及其|以及|的|与|和|、|[：:；;，,（）()【】\[\]《》]/)
    .map((item) => item.replace(/\s+/g, '').trim())
    .filter((item) => item.length >= 3)
    .sort((left, right) => right.length - left.length);
  return candidates.some((candidate) => compactContent.includes(candidate));
}

function batchAnchors(batch, canon) {
  const names = (items, field = 'name') => (items || []).map((item) => item?.[field]).filter(Boolean);
  if (batch === 'L1') return [
    canon?.identity?.name,
    ...names(canon?.axioms, 'statement'),
    ...names(canon?.spatialOrder?.regions),
    ...names(canon?.societies),
    ...names(canon?.institutions),
    ...names(canon?.entities),
  ].filter(Boolean);
  if (batch === 'L2') return [...names(canon?.spatialOrder?.regions), ...names(canon?.history, 'event'), ...names(canon?.history, 'era')].filter(Boolean);
  if (batch === 'L3') return [...names(canon?.societies), ...names(canon?.institutions), ...names(canon?.dailyLife, 'fact')].filter(Boolean);
  if (batch === 'L4') return [...names(canon?.spatialOrder?.regions), ...names(canon?.societies), ...names(canon?.institutions), ...names(canon?.history, 'event'), ...names(canon?.entities)].filter(Boolean);
  return [];
}

function batchCanonIds(batch, canon) {
  const ids = (items) => (items || []).map((item) => item?.id).filter(Boolean);
  if (batch === 'L1') return new Set(ids(canon?.axioms));
  if (batch === 'L2') return new Set([...ids(canon?.spatialOrder?.regions), ...ids(canon?.history)]);
  if (batch === 'L3') return new Set([...ids(canon?.societies), ...ids(canon?.institutions), ...ids(canon?.dailyLife)]);
  if (batch === 'L4') return new Set(canonEntries(canon).map((item) => item.id));
  return new Set();
}

function batchSourceAnchors(batch, canon) {
  const relevantIds = batchCanonIds(batch, canon);
  return (canon?.sourceContinuity || [])
    .filter((item) => item.canonRefs?.some((id) => relevantIds.has(id)))
    .map((item) => item.originalName)
    .filter(Boolean);
}

export function validateExpandedModule(content, batch, canon) {
  const anchors = batchAnchors(batch, canon);
  const matched = anchors.filter((anchor) => containsAnchor(content, anchor));
  const minimum = Math.min(anchors.length, batch === 'L1' ? 2 : batch === 'L4' ? 3 : 2);
  if (batch === 'L1' && !containsAnchor(content, canon?.identity?.name)) throw new Error('正文没有使用选定世界的名称。');
  if (matched.length < minimum) throw new Error(`正文没有落实这一部分应使用的正典内容，只识别到 ${matched.length} 个正典锚点。`);
  if (canon?.sourceContinuity?.length) {
    if (!/^## 原著承接$/m.test(String(content))) throw new Error('正文缺少读者可见的“原著承接”说明。');
    const sourceAnchors = batchSourceAnchors(batch, canon);
    const matchedSourceAnchors = sourceAnchors.filter((anchor) => containsSourceAnchor(content, anchor));
    const sourceMinimum = Math.min(2, sourceAnchors.length);
    if (matchedSourceAnchors.length < sourceMinimum) throw new Error(`正文没有直接使用本部分应承接的原著名称，只识别到 ${matchedSourceAnchors.length} 项。`);
    if (batch === 'L1' && canon.sourcePlan?.primaryWork && !containsAnchor(content, canon.sourcePlan.primaryWork)) throw new Error('世界概览没有说明本次延续的主世界原著。');
  }
  return content;
}

export function validateAuditResult(value, canon) {
  const input = value && typeof value === 'object' ? value : {};
  const checkedCanonIds = list(input.checked_canon_ids ?? input.checkedCanonIds, 200, 60);
  const expectedCanonIds = canonEntries(canon).map((item) => item.id);
  const checkedCanon = new Set(checkedCanonIds);
  const missingCanon = expectedCanonIds.filter((id) => !checkedCanon.has(id));
  if (missingCanon.length) throw new Error(`审计没有检查全部正典条目，仍缺少：${missingCanon.slice(0, 8).join('、')}。`);
  const checkedResearchIds = list(input.checked_research_ids ?? input.checkedResearchIds, 50, 60);
  const checkedResearch = new Set(checkedResearchIds);
  const expectedResearchIds = [...new Set((canon?.sourceContinuity || canon?.directionTrace || []).map((item) => item.researchId).filter(Boolean))];
  const missingResearch = expectedResearchIds.filter((id) => !checkedResearch.has(id));
  if (missingResearch.length) throw new Error(`审计没有回查方向所依据的研究材料：${missingResearch.join('、')}。`);
  if (!['通过', '需修补'].includes(input.status)) throw new Error('审计没有给出有效结论。');
  return { ...input, checked_canon_ids: checkedCanonIds, checked_research_ids: checkedResearchIds };
}

export function validateSummaryAlignment(content, canon) {
  const summary = String(content ?? '').trim();
  if (summary.length < 700) throw new Error('简版世界介绍过短，没有完成三分钟可读的交付。');
  if (!containsAnchor(summary, canon?.identity?.name)) throw new Error('简版没有使用选定世界的名称。');
  const anchors = [
    ...(canon?.spatialOrder?.regions || []).map((item) => item.name),
    ...(canon?.societies || []).map((item) => item.name),
    ...(canon?.institutions || []).map((item) => item.name),
    ...(canon?.history || []).map((item) => item.event),
  ].filter(Boolean);
  const matched = anchors.filter((anchor) => containsAnchor(summary, anchor));
  if (matched.length < Math.min(3, anchors.length)) throw new Error('简版没有继承足够的正典地点、人群、制度或历史。');
  if (canon?.sourceContinuity?.length) {
    if (canon.sourcePlan?.primaryWork && !containsAnchor(summary, canon.sourcePlan.primaryWork)) throw new Error('简版没有说明它延续的主世界原著。');
    const primaryNames = canon.sourceContinuity.filter((item) => item.role === 'primary').map((item) => item.originalName).filter(Boolean);
    const matchedPrimaryNames = primaryNames.filter((name) => containsSourceAnchor(summary, name));
    if (matchedPrimaryNames.length < Math.min(2, primaryNames.length)) throw new Error('简版没有保留足够的主世界原著地点、人物或事件名称。');
    for (const secondaryWork of canon.sourcePlan?.secondaryWorks || []) {
      const secondaryNames = canon.sourceContinuity.filter((item) => comparable(item.source) === comparable(secondaryWork)).map((item) => item.originalName);
      if (!containsAnchor(summary, secondaryWork) && !secondaryNames.some((name) => containsSourceAnchor(summary, name))) throw new Error(`简版没有说明次世界《${secondaryWork}》怎样进入主世界。`);
    }
  }
  return summary;
}
