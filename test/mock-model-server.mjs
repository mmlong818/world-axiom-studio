import http from 'node:http';

const responses = {
  understand: {
    mode: 'multi_work',
    delivery_mode: 'source_expand',
    works: ['镜花缘', '哈利·波特'].map((title, index) => ({ title, role: index === 0 ? 'primary' : 'secondary', entry_point: index === 0 ? '唐敖等人启程海外、逐国见闻的原著阶段' : '在海外航路抵达一个与魔法学校相通的港口之后', kind: '书籍', aliases: [], research_queries: [
      { dimension: 'plot', query: `${title} 情节` }, { dimension: 'geography', query: `${title} 地理` },
      { dimension: 'peoples', query: `${title} 族群` }, { dimension: 'factions', query: `${title} 组织` },
      { dimension: 'daily_life', query: `${title} 生活` }, { dimension: 'history', query: `${title} 历史` },
      { dimension: 'geography', query: `${title} 代表地域` }, { dimension: 'peoples', query: `${title} 代表种族` },
    ] })),
    fusion_plan: { primary_world: '镜花缘', secondary_worlds: ['哈利·波特'], time_space_correspondence: '以《镜花缘》海外游历为主轴，在抵达一处可通往魔法学校的海外港口时接入《哈利·波特》的战后阶段。', precedence: '《镜花缘》的旅程、海外诸国和人物经历优先；魔法世界只从港口通道进入并保留自身历史。' },
    objective: '先复现两部作品的故事、人物、地方、风物与事件，再在主世界连续性上补足融合内容。',
    intended_use: '世界之书',
    scope: '区域或国家',
    must_preserve: ['资料研究先于创作'],
    must_avoid: ['不换名替代原作专名与事件，不把两部作品打碎成无关世界'],
    research_questions: ['人物怎样开始认识世界', '故事去过哪些地方并遇到哪些社会', '哪些事件最能呈现民风和公共生活'],
    interpretation: '以《镜花缘》为主世界延续海外旅程，让《哈利·波特》从明确港口和战后时点进入。',
  },
  analyze: {
    summary: '《镜花缘》让唐敖等人在海外旅行中连续进入不同国家，人物每到一地，都会先看到当地人的外貌、礼俗、政治或性别秩序，再通过见闻和遭遇显出社会讽喻。《哈利·波特》则从一个孩子得知魔法世界存在开始，经由入学、交友、课堂、比赛和冲突，逐步认识学校、家庭、政府与黑暗势力。前者的世界感来自不断抵达陌生国度，后者的世界感来自在一个可长期生活的魔法社会中成长。新的世界方向应先保留两部原著的地方、人物、民风和事件，再把缺失的跨界联系补成有主有次的连续世界。',
    plot_arcs: [
      { source: '镜花缘', starting_situation: '唐敖等人离开熟悉社会准备远行。', stages: ['启程海外', '逐国见闻', '进入异俗社会', '完成主要海外游历'].map((name, index) => ({ id: `mirror-stage-${index + 1}`, name, summary: `${name}推动旅行者认识新的地域和居民。`, places: ['海外诸国'], participants: ['唐敖等旅行者'], evidence: ['source-1'] })), ending_situation: '旅行者带着对诸国风俗与社会差异的认识结束主要游历。', evidence: ['source-1'] },
      { source: '哈利·波特', starting_situation: '少年尚不知道魔法社会与自己的身世。', stages: ['得知身世', '进入魔法学校', '在成长中面对公共冲突', '黑暗势力最终败退'].map((name, index) => ({ id: `magic-stage-${index + 1}`, name, summary: `${name}使人物逐步认识魔法社会及其冲突。`, places: ['魔法学校'], participants: ['魔法少年与同伴'], evidence: ['source-1'] })), ending_situation: '战争结束后，幸存者重建魔法社会并继续生活。', evidence: ['source-1'] },
    ],
    narrative_elements: [
      { source: '镜花缘', category: '地域与地点', name: '海外诸国', description: '旅行者连续抵达风俗和社会秩序不同的国家。', story_function: '让读者通过比较逐步认识世界的广阔和荒诞。', transferable_value: '把旅途中的每次抵达变成认识一种地方生活的机会。', evidence: ['source-1'], confidence: 'high' },
      { source: '镜花缘', category: '族群与种族', name: '海外旅行者', description: '唐敖等人以外来者身份观察并经历各国生活。', story_function: '替读者提出疑问，也承受陌生礼俗带来的冲击。', transferable_value: '保留外来者进入陌生社会时的见闻与误解。', evidence: ['source-1'], confidence: 'high' },
      { source: '镜花缘', category: '地域与地点', name: '女儿国', description: '具有独特性别秩序和生活习俗的海外国家。', story_function: '以具体社会反差呈现异域。', transferable_value: '发展具有不同家庭秩序的原创地区。', evidence: ['source-1'], confidence: 'high' },
      { source: '镜花缘', category: '族群与种族', name: '海外诸国居民', description: '各国居民拥有不同外貌、礼俗与社会位置。', story_function: '让地域差异通过居民生活可见。', transferable_value: '发展多族群港城。', evidence: ['source-1'], confidence: 'high' },
      { source: '镜花缘', category: '组织与势力', name: '海外国政与官署', description: '各国统治者和官署维持不同社会秩序。', story_function: '把异俗落实为公共权力。', transferable_value: '发展地方自治组织。', evidence: ['source-1'], confidence: 'high' },
      { source: '镜花缘', category: '民风与日常', name: '异俗日常', description: '饮食、婚姻、交易和礼法随国家变化。', story_function: '用日常差异呈现世界。', transferable_value: '发展各地可见民俗。', evidence: ['source-1'], confidence: 'high' },
      { source: '哈利·波特', category: '地域与地点', name: '魔法学校', description: '少年在住宿学校中学习魔法、结交朋友并接触社会冲突。', story_function: '把庞大的魔法世界转化为可以日常体验的成长场所。', transferable_value: '用一处可长期生活的学习场所逐层打开整个社会。', evidence: ['source-1'], confidence: 'high' },
      { source: '哈利·波特', category: '民风与日常', name: '魔法教育生活', description: '课堂、学院、比赛、节庆和假期共同构成学生生活。', story_function: '让奇异能力进入普通的学习、友情和竞争。', transferable_value: '让异常能力通过课程、考试和节庆成为真实日常。', evidence: ['source-1'], confidence: 'high' },
      { source: '哈利·波特', category: '地域与地点', name: '魔法商业街区', description: '巫师购买学习用品并接触行业生活的街区。', story_function: '呈现学校之外的社会经济。', transferable_value: '发展服务特殊知识的市场。', evidence: ['source-1'], confidence: 'high' },
      { source: '哈利·波特', category: '族群与种族', name: '巫师与普通人', description: '魔法社会与普通社会彼此相邻又保持隐蔽。', story_function: '建立社会边界。', transferable_value: '发展公开与隐秘居民群体。', evidence: ['source-1'], confidence: 'high' },
      { source: '哈利·波特', category: '族群与种族', name: '非人魔法族群', description: '非人族群参与劳动、金融和公共冲突。', story_function: '显示魔法社会并非只有巫师。', transferable_value: '发展多族群公共服务。', evidence: ['source-1'], confidence: 'high' },
      { source: '哈利·波特', category: '组织与势力', name: '魔法政府与学校', description: '政府和学校共同影响教育与公共秩序。', story_function: '呈现制度之间的制约。', transferable_value: '发展知识机构和行政组织。', evidence: ['source-1'], confidence: 'high' },
    ],
    key_events: [
      { source: '镜花缘', name: '启程海外', description: '旅行者离开熟悉社会，开始逐国见闻。', participants: ['唐敖等旅行者'], places: ['海外诸国'], world_revealed: '世界由许多民风和制度差异巨大的国家组成。', transferable_value: '让一次公共远行把彼此隔绝的地方串成可比较的世界。', consequences: ['旅行成为认识各国社会的主线'], evidence: ['source-1'], confidence: 'high' },
      { source: '哈利·波特', name: '进入魔法学校', description: '少年得知自己的身世并进入魔法学校学习。', participants: ['魔法少年与同学'], places: ['魔法学校'], world_revealed: '魔法不是孤立奇观，而是拥有教育、职业与公共生活的社会。', transferable_value: '让入学成为进入隐秘社会和公共生活的门槛事件。', consequences: ['人物在成长中持续接触更大的魔法世界'], evidence: ['source-1'], confidence: 'high' },
      { source: '镜花缘', name: '抵达女儿国', description: '旅行者进入具有不同性别秩序的国家并亲历当地生活。', world_revealed: '各国制度会直接改变外来者的处境。', transferable_value: '把抵达异国发展为社会关系转折。', evidence: ['source-1'], confidence: 'high' },
      { source: '哈利·波特', name: '魔法战争结束', description: '不同群体共同抵抗黑暗势力，战争结束后社会开始重建。', world_revealed: '学校生活与公共政治最终汇合。', transferable_value: '发展跨群体共同重建的公共历史。', evidence: ['source-1'], confidence: 'high' },
    ],
    question_answers: [
      { question: '人物怎样开始认识世界', answer: '两部作品分别用海外启程和进入学校作为认识陌生世界的入口。', evidence: ['source-1'] },
      { question: '故事去过哪些地方并遇到哪些社会', answer: '材料呈现了海外诸国的异俗社会，以及由学校、家庭和公共机构组成的魔法社会。', evidence: ['source-1'] },
      { question: '哪些事件最能呈现民风和公共生活', answer: '逐国旅行中的社会遭遇与入学后的课堂、节庆和冲突最能呈现公共生活。', evidence: ['source-1'] },
    ],
    source_impressions: [
      { source: '镜花缘', presentation: '以旅行见闻不断打开陌生国家，用奇异民风和社会遭遇呈现世界。', memorable_content: ['海外诸国', '异俗见闻', '社会讽喻'], usable_material: '借鉴逐地见闻与社会比较的阅读体验。' },
      { source: '哈利·波特', presentation: '以少年入学和成长经历进入一个可日常生活的魔法社会。', memorable_content: ['魔法学校', '同伴关系', '课堂与节庆', '公共冲突'], usable_material: '借鉴在学校生活中逐层认识隐秘社会的体验。' },
    ],
    confirmed_facts: ['用户要求先复现两部作品，再以《镜花缘》为主完成有时空接点的融合'],
    conflicts: [],
    gaps: ['尚未决定特殊知识的物理来源'],
    design_constraints: ['必须沿用原作角色、地点、组织、事件和时间顺序；原创只用于资料缺口与融合桥梁'],
  },
  directions: {
    comparison: '三者都延续《镜花缘》海外游历，只分别从旅程、居民日常和公共危机介绍融合后的世界。',
    cards: ['双界航程', '港校日常', '战后通路'].map((name, index) => ({
      seed_id: `card-${index + 1}`, name, construction_mode: 'source_expand', model_type: ['沿旅途逐地认识', '从普通居民生活进入', '从公共危机回看世界'][index],
      one_line: ['唐敖等人的海外航程抵达与魔法学校相通的新港口。', '从女儿国与魔法学校两地居民的日常往来认识世界。', '从魔法战争后的通道危机回看海外诸国与魔法社会。'][index],
      overview: `这个方向以《镜花缘》的海外游历为主轴，先保留唐敖等人启程海外、抵达海外诸国和女儿国的原著经历，再让旅程在一处港口与《哈利·波特》魔法战争结束后的时空相接。魔法学校、巫师与普通人以及魔法政府仍保持原著身份，不会被换成陌生专名。介绍会沿${['旅行者的抵达顺序', '港口居民与学生的一天', '通道失衡引发的公共危机'][index]}展开，说明两边的人如何相遇、交易和处理冲突；只有原著没有交代的跨界通道、港口制度和战后往来会被补足。`,
      primary_continuity: '以《镜花缘》为主世界，保留海外诸国、女儿国、唐敖等旅行者、启程海外和逐国见闻的原著顺序与社会关系。',
      secondary_integration: [{ source: '哈利·波特', entry_point: '在《镜花缘》海外航程抵达新港口时，接入《哈利·波特》魔法战争结束后的学校与社会。', retained: '保留魔法学校、巫师与普通人、魔法政府与学校，以及进入魔法学校和战争结束的历史。' }],
      research_refs: ['element-1', 'element-2', 'event-1', 'element-7', 'element-10', 'event-2'],
    })),
  },
  canon: {
    identity: { name: '双界航程', one_line: '唐敖等人的海外航程抵达战后魔法社会', thesis: '《镜花缘》的海外诸国、女儿国、海外旅行者、海外诸国居民、海外国政与官署和异俗日常继续成立，并从港口接入魔法世界。' },
    source_plan: { primary_work: '镜花缘', secondary_works: ['哈利·波特'], time_space_correspondence: '在唐敖等人启程海外并开始逐国见闻的阶段，一处海外港口接入魔法战争结束后的魔法学校与社会。', precedence: '《镜花缘》的旅程、海外诸国与既有人物关系优先；魔法世界保留自身事实，但不能覆盖主世界历史。' },
    axioms: [
      { id: 'axiom-1', statement: '海外诸国仍按《镜花缘》的地理与异俗秩序存在', consequences: ['唐敖等旅行者继续逐国见闻'], limits: ['新增港口不能替代女儿国等原著地点'] },
      { id: 'axiom-2', statement: '魔法学校所在社会只从明确港口通道进入主世界', consequences: ['巫师与普通人可以和海外诸国居民往来'], limits: ['魔法政府不能改写主世界既有历史'] },
    ],
    spatial_order: { overview: '海外诸国和女儿国保持原著位置；魔法学校与魔法商业街区位于港口通道另一侧。', regions: [{ id: 'region-1', name: '海外诸国', type: '主世界地域', definition: '唐敖等人逐国见闻的主要空间，其中包括女儿国。', importance: '维持主世界旅程', relations: ['经港口通道连接魔法学校'] }, { id: 'region-2', name: '魔法学校', type: '次世界地点', definition: '与魔法商业街区和魔法社会相连的原著学校。', importance: '次世界进入点', relations: ['通向海外港口'] }], relations: ['主次世界只经港口通道往来'] },
    societies: [{ id: 'society-1', name: '海外旅行者与海外诸国居民', type: '主世界人群', definition: '旅行者继续观察各国居民的礼俗。', importance: '保留原著观察视角', relations: ['与巫师与普通人相遇'] }, { id: 'society-2', name: '巫师与普通人及非人魔法族群', type: '次世界人群', definition: '保留魔法社会既有身份和关系。', importance: '呈现次世界社会', relations: ['在港口与海外诸国居民往来'] }],
    institutions: [{ id: 'institution-1', name: '海外国政与官署及魔法政府与学校', type: '原著机构', definition: '两边机构各自维持原有秩序，只共同管理跨界港口。', importance: '避免融合抹平主次关系', relations: ['共同处理通道事件'] }],
    history: [{ id: 'history-1', era: '海外游历阶段', event: '启程海外并抵达女儿国', causes: ['唐敖等人离开熟悉社会'], consequences: ['继续逐国见闻'], present_traces: ['海外航路仍按原著顺序延伸'] }, { id: 'history-2', era: '魔法战争后', event: '进入魔法学校与魔法战争结束', causes: ['魔法社会既有冲突'], consequences: ['战后开始有限跨界往来'], present_traces: ['学校和政府保留战后秩序'] }],
    daily_life: [{ id: 'life-1', topic: '主世界日常', fact: '异俗日常继续体现在饮食、婚姻、交易和礼法中。', depends_on: ['axiom-1'] }, { id: 'life-2', topic: '次世界日常', fact: '魔法教育生活保留课堂、学院、比赛、节庆和假期。', depends_on: ['axiom-2'] }, { id: 'life-3', topic: '港口往来', fact: '两边居民只在开放日通过港口交易、访学和办理通行手续。', depends_on: ['region-1', 'region-2', 'institution-1'] }],
    entities: [
      { id: 'entity-1', name: '海外港口通道', type: '地点', definition: '连接主次世界的有限通道。', importance: '让两部作品在明确位置相接。' },
      { id: 'entity-2', name: '唐敖等旅行者', type: '人群', definition: '继续逐国见闻的原著旅行者。', importance: '维持主世界观察视角。' },
      { id: 'entity-3', name: '魔法教育生活', type: '习俗', definition: '由课堂、学院、比赛和节庆组成的学校日常。', importance: '保留次世界的生活感。' },
      { id: 'entity-4', name: '跨界通行手续', type: '制度', definition: '两边机构共同维持的有限往来规则。', importance: '避免通道抹平两个世界。' },
    ],
    source_continuity: [
      ['element-1', ['axiom-1', 'region-1']], ['element-2', ['society-1']], ['element-3', ['region-1']], ['element-4', ['society-1']],
      ['element-5', ['institution-1']], ['element-6', ['life-1']], ['element-7', ['axiom-2', 'region-2']], ['element-8', ['life-2']],
      ['element-9', ['region-2']], ['element-10', ['society-2']], ['element-11', ['society-2']], ['element-12', ['institution-1']],
      ['event-1', ['history-1']], ['event-2', ['history-2']], ['event-3', ['history-1']], ['event-4', ['history-2']],
    ].map(([research_id, canon_refs]) => ({ research_id, canon_refs, treatment: 'preserved', time_space_correspondence: '对应各自原著事件已经发生并形成既有社会关系的阶段。', explanation: '保留原著名称、身份、时空位置和既有事件后果，不以新设定替代。' })),
    extensions: [], tensions: ['跨界港口开放程度仍有争议'], unknowns: ['原著没有说明跨界通道的长期后果'], evidence_policy: '原著事实优先；只有跨界港口属于用于连接两部作品的明确扩展。',
  },
};

function choose(prompt) {
  if (prompt.includes('只回复“连接成功”')) return '连接成功';
  if (prompt.includes('本次阶段：理解用户真正要完成')) return responses.understand;
  if (prompt.includes('本次阶段：把用户材料和检索资料')) return responses.analyze;
  if (prompt.includes('本次阶段：基于任务简报和研究档案')) return responses.directions;
  if (prompt.includes('本次阶段：世界定位与原著边界')) return { identity: responses.canon.identity, source_plan: responses.canon.source_plan };
  if (prompt.includes('本次阶段：核心规律与地方关系')) return { axioms: responses.canon.axioms, spatial_order: responses.canon.spatial_order };
  if (prompt.includes('本次阶段：历史、居民与制度')) return { history: responses.canon.history, societies: responses.canon.societies, institutions: responses.canon.institutions };
  if (prompt.includes('本次阶段：日常生活、关键名称与依据映射')) return {
    daily_life: responses.canon.daily_life, entities: responses.canon.entities, source_continuity: responses.canon.source_continuity,
    extensions: responses.canon.extensions, tensions: responses.canon.tensions, unknowns: responses.canon.unknowns, evidence_policy: responses.canon.evidence_policy,
  };
  if (prompt.includes('本次阶段：把选定方向建立为唯一的世界正典')) return responses.canon;
  return { error: 'unknown stage' };
}

http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/v1/models') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ data: [{ id: 'mock-world-model', name: 'Mock World Model' }] }));
    return;
  }
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const prompt = body.messages?.at(-1)?.content || body.input?.at(-1)?.content || '';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(choose(prompt)) } }] }));
  });
}).listen(4319, '127.0.0.1');
