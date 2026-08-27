const WIKI_SITES = {
  wikipedia: {
    api: 'https://zh.wikipedia.org/w/api.php',
    label: '维基百科',
    kind: '百科概述',
    excerptLimit: 8_000,
  },
  wikisource: {
    api: 'https://zh.wikisource.org/w/api.php',
    label: '维基文库',
    kind: '可公开查阅原文',
    excerptLimit: 5_000,
  },
};
const researchCache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

const CHAPTER_MARKERS = /(?:第\s*[零〇一二三四五六七八九十百千0-9]+\s*(?:回|章|卷|节)|卷[零〇一二三四五六七八九十百千0-9]+)/;

function compact(value, limit = 160) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function comparableTitle(value) {
  return compact(value, 100)
    .replace(/[《》〈〉「」『』“”"'\s·:：()（）_-]/g, '')
    .toLocaleLowerCase('zh-CN');
}

export function validateResearchCoverage(research, taskBrief) {
  if (!['single_work', 'multi_work'].includes(taskBrief?.mode)) {
    return { ...research, coverage: { complete: true, works: [], gaps: [] } };
  }
  const required = ['plot', 'geography', 'peoples', 'factions', 'daily_life', 'history'];
  const workCoverage = [];
  const gaps = [];
  for (const work of taskBrief.works || []) {
    const sources = (research?.sources || []).filter((source) => comparableTitle(source.workTitle) === comparableTitle(work.title));
    const dimensions = new Set(sources.map((source) => source.researchDimension).filter(Boolean));
    const missing = required.filter((dimension) => !dimensions.has(dimension));
    const geographyCount = sources.filter((source) => source.researchDimension === 'geography').length;
    const peoplesCount = sources.filter((source) => source.researchDimension === 'peoples').length;
    const details = [missing.length ? `缺少 ${missing.join('、')}` : '', geographyCount < 2 ? '地域资料不足两项' : '', peoplesCount < 2 ? '种族或族群资料不足两项' : ''].filter(Boolean);
    workCoverage.push({ title: work.title, complete: details.length === 0, sourceCount: sources.length, dimensions: [...dimensions], gaps: details });
    if (details.length) gaps.push(`《${work.title}》${details.join('；')}`);
  }
  const complete = gaps.length === 0;
  const warning = complete ? '' : `公开资料覆盖有限：${gaps.join('；')}。这些缺口只用于区分原作依据与原创补全，不会阻断世界方向生成。`;
  return {
    ...research,
    warnings: [...new Set([...(research?.warnings || []), warning].filter(Boolean))],
    coverage: { complete, works: workCoverage, gaps },
  };
}

export function normalizeSourceIdentification(value) {
  const input = value && typeof value === 'object' ? value : {};
  const mode = ['original', 'single_work', 'multi_work'].includes(input.mode) ? input.mode : '';
  if (!mode) throw new Error('模型没有给出有效的输入类型。');
  const works = [...new Map((Array.isArray(input.works) ? input.works : [])
    .map((item) => compact(typeof item === 'string' ? item : item?.title, 80))
    .filter((title) => title.length >= 1 && !/[\u0000-\u001f]/.test(title))
    .map((title) => {
      const original = (input.works || []).find((item) => compact(typeof item === 'string' ? item : item?.title, 80) === title);
      const queries = Array.isArray(original?.researchQueries) ? original.researchQueries : original?.research_queries || [];
      return [comparableTitle(title), {
        title,
        kind: compact(original?.kind, 40) || '已有作品',
        aliases: (Array.isArray(original?.aliases) ? original.aliases : []).map((alias) => compact(alias, 80)).filter(Boolean).slice(0, 6),
        researchQueries: queries.map((query) => ({
          dimension: compact(query?.dimension ?? query?.type, 40),
          query: compact(query?.query ?? query, 120),
        })).filter((query) => query.dimension && query.query).slice(0, 10),
      }];
    })).values()].slice(0, 6);
  if (mode === 'original') return { mode, works: [], reasoning: compact(input.reasoning, 240) };
  if (mode === 'single_work' && works.length !== 1) throw new Error('模型没有返回一个明确的作品名称。');
  if (mode === 'multi_work' && works.length < 2) throw new Error('模型没有返回至少两个参考作品名称。');
  return { mode, works, reasoning: compact(input.reasoning, 240) };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(url, fetchImpl, timeoutMs = 12_000) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: { 'user-agent': 'WorldAxiomStudio/0.1 (local app; https://github.com/mmlong818/world-axiom-studio)' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if ((response.status === 429 || response.status === 503) && attempt < 2) {
      const retryAfter = Number(response.headers.get('retry-after') || 0) * 1_000;
      await delay(Math.min(2_000, Math.max(350 * (attempt + 1), retryAfter)));
      continue;
    }
    if (!response.ok) throw new Error(`资料站返回 ${response.status}`);
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 2_000_000) throw new Error('资料站返回内容过大');
    return response.json();
  }
  throw new Error('资料站多次拒绝请求');
}

function apiUrl(base, parameters) {
  const url = new URL(base);
  for (const [key, value] of Object.entries({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    ...parameters,
  })) url.searchParams.set(key, value);
  return url;
}

function firstPage(data) {
  return data?.query?.pages?.find((page) => page && !page.missing && !page.invalid) ?? null;
}

async function getExactPage(site, title, fetchImpl) {
  const url = apiUrl(site.api, {
    titles: title,
    prop: 'extracts|info',
    explaintext: '1',
    exchars: String(site.excerptLimit),
    inprop: 'url',
  });
  return firstPage(await fetchJson(url, fetchImpl));
}

async function searchPage(site, title, fetchImpl) {
  const url = apiUrl(site.api, {
    generator: 'search',
    gsrsearch: `intitle:"${title.replace(/["\\]/g, ' ')}"`,
    gsrnamespace: '0',
    gsrlimit: '5',
    prop: 'extracts|info',
    explaintext: '1',
    exchars: String(site.excerptLimit),
    inprop: 'url',
  });
  const pages = (await fetchJson(url, fetchImpl))?.query?.pages ?? [];
  const wanted = comparableTitle(title);
  return pages.find((page) => comparableTitle(page.title) === wanted)
    ?? (wanted.length >= 4
      ? pages.find((page) => {
        const candidate = comparableTitle(page.title);
        return candidate.startsWith(wanted) || candidate.endsWith(wanted);
      })
      : null)
    ?? null;
}

async function findPage(site, title, fetchImpl) {
  const exact = await getExactPage(site, title, fetchImpl);
  if (exact) return exact;
  return searchPage(site, title, fetchImpl);
}

async function findWorkPage(site, title, aliases, fetchImpl) {
  for (const candidate of [title, ...aliases]) {
    const page = await findPage(site, candidate, fetchImpl);
    if (page) return page;
  }
  return null;
}

function evenlySample(items, count) {
  if (items.length <= count) return items;
  const picked = [];
  for (let index = 0; index < count; index += 1) {
    picked.push(items[Math.round(index * (items.length - 1) / (count - 1))]);
  }
  return [...new Map(picked.map((item) => [item.title, item])).values()];
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try { results[index] = { status: 'fulfilled', value: await mapper(items[index], index) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function sampleWikisourceChapters(rootPage, fetchImpl) {
  const site = WIKI_SITES.wikisource;
  const linksUrl = apiUrl(site.api, {
    titles: rootPage.title,
    prop: 'links',
    plnamespace: '0',
    pllimit: 'max',
  });
  const linkPage = firstPage(await fetchJson(linksUrl, fetchImpl));
  const prefix = `${rootPage.title}/`;
  const chapterLinks = (linkPage?.links ?? []).filter((link) => (
    link?.ns === 0 && (link.title.startsWith(prefix) || CHAPTER_MARKERS.test(link.title))
  ));
  const selected = evenlySample(chapterLinks, 8);
  if (!selected.length) return null;

  const chapterSite = { ...site, excerptLimit: 1_200 };
  const results = await mapWithConcurrency(selected, 2, (item) => getExactPage(chapterSite, item.title, fetchImpl));
  const pages = results.filter((result) => result.status === 'fulfilled' && result.value).map((result) => result.value);
  const excerpts = pages
    .filter((page) => page.extract)
    .map((page) => `【${page.title}】\n${compact(page.extract, 1_200)}`);
  if (!excerpts.length) return null;
  return {
    title: `${rootPage.title}（原文章节抽样）`,
    url: rootPage.fullurl,
    provider: site.label,
    kind: '可公开查阅的原文章节抽样',
    excerpt: excerpts.join('\n\n').slice(0, 22_000),
  };
}

function pageSource(site, page, metadata = {}) {
  const excerpt = compact(page?.extract, site.excerptLimit);
  if (!excerpt) return null;
  return {
    title: page.title,
    url: page.fullurl,
    provider: site.label,
    kind: site.kind,
    excerpt,
    ...metadata,
  };
}

export async function researchNamedWork(input, options = {}) {
  const title = compact(typeof input === 'string' ? input : input?.title, 80);
  const declaredKind = compact(input?.kind, 40) || '已有作品';
  const aliases = (Array.isArray(input?.aliases) ? input.aliases : []).map((alias) => compact(alias, 80)).filter(Boolean).slice(0, 6);
  const requestedQueries = (Array.isArray(input?.researchQueries) ? input.researchQueries : input?.research_queries || [])
    .map((item) => ({ dimension: compact(item?.dimension ?? item?.type, 40), query: compact(item?.query ?? item, 120) }))
    .filter((item) => item.dimension && item.query).slice(0, 10);
  const researchQueries = requestedQueries;
  const query = title;
  if (!title) return { attempted: false, detected: false, query, title: '', workKind: '', sources: [], warnings: [] };

  const cacheKey = `${comparableTitle(title)}:${researchQueries.map((item) => `${item.dimension}:${comparableTitle(item.query)}`).join('|')}`;
  const cached = researchCache.get(cacheKey);
  if (!options.fetchImpl && cached?.expiresAt > Date.now()) return cached.value;

  const fetchImpl = options.fetchImpl ?? fetch;
  const warnings = [];
  const pages = Object.fromEntries(await Promise.all(Object.entries(WIKI_SITES).map(async ([id, site]) => {
    try {
      return [id, await findWorkPage(site, title, aliases, fetchImpl)];
    } catch (error) {
      warnings.push(`${site.label}暂时不可用：${error.message}`);
      return [id, null];
    }
  })));
  const wikipediaPage = pages.wikipedia;
  const wikisourcePage = pages.wikisource;

  const sources = [
    pageSource(WIKI_SITES.wikipedia, wikipediaPage),
    pageSource(WIKI_SITES.wikisource, wikisourcePage),
  ].filter(Boolean);

  const relatedResults = await mapWithConcurrency(researchQueries, 2, async (planned) => {
    try {
      const page = await findPage(WIKI_SITES.wikipedia, planned.query, fetchImpl);
      if (page) return pageSource(WIKI_SITES.wikipedia, page, { researchDimension: planned.dimension, researchQuery: planned.query });
    } catch (error) {
      warnings.push(`${planned.dimension} 资料读取未完成：${error.message}`);
    }
    return null;
  });
  sources.push(...relatedResults.filter((result) => result.status === 'fulfilled' && result.value).map((result) => result.value));

  if (wikisourcePage) {
    try {
      const sample = await sampleWikisourceChapters(wikisourcePage, fetchImpl);
      if (sample) sources.push(sample);
    } catch (error) {
      warnings.push(`维基文库章节抽样未完成：${error.message}`);
    }
  }

  const deduplicatedSources = [...new Map(sources.map((source) => [`${source.url || source.title}:${source.researchDimension || 'overview'}`, source])).values()].slice(0, 12);
  const detected = deduplicatedSources.length > 0;
  const result = {
    attempted: true,
    detected,
    query,
    requestedTitle: title,
    title: wikipediaPage?.title || wikisourcePage?.title || title,
    workKind: wikisourcePage ? '书籍' : declaredKind,
    openTextSource: Boolean(wikisourcePage),
    sources: detected ? deduplicatedSources : [],
    warnings,
  };
  if (!options.fetchImpl && result.detected && result.sources.length) {
    researchCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
  }
  return result;
}

export async function researchIdentifiedSource(input, identification, options = {}) {
  const query = compact(input, 240);
  const identified = normalizeSourceIdentification(identification);
  if (identified.mode === 'original') {
    return { attempted: false, detected: false, mode: 'original', query, title: '', workKind: '', works: [], sources: [], warnings: [], identification: identified, identificationMethod: 'llm-v1' };
  }

  const references = identified.works;
  if (identified.mode === 'single_work') {
    const result = await researchNamedWork(references[0], options);
    return { ...result, query, mode: 'reconstruct', sources: result.sources.map((source) => ({ ...source, workTitle: references[0].title })), identification: identified, identificationMethod: 'llm-v1' };
  }

  const works = [];
  const unresolvedReferences = [];
  const warnings = [];
  for (const reference of references) {
    const result = await researchNamedWork(reference, options);
    if (result.detected) works.push(result);
    else {
      unresolvedReferences.push(reference.title);
      warnings.push(...(result.warnings?.length ? result.warnings.map((warning) => `${reference.title}：${warning}`) : [`没有找到“${reference.title}”的可核对公开资料` ]));
    }
  }

  const detected = works.length > 0;
  const sources = works.flatMap((work) => work.sources.map((source) => ({ ...source, workTitle: work.requestedTitle || work.title })));
  return {
    attempted: true,
    detected,
    mode: 'synthesis',
    query,
    title: works.map((work) => work.requestedTitle || work.title).join(' × ') || references.map((work) => work.title).join(' × '),
    workKind: '多作品创新融合',
    works: works.map((work) => ({
      title: work.requestedTitle || work.title,
      workKind: work.workKind,
      openTextSource: work.openTextSource,
      sourceCount: work.sources.length,
    })),
    unresolvedReferences,
    sources: detected ? sources : [],
    warnings,
    identification: identified,
    identificationMethod: 'llm-v1',
  };
}
