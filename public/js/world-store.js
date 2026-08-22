const DB_NAME = 'world-axiom-studio';
const DB_VERSION = 1;
const STORE_NAME = 'worlds';

const clone = (value) => structuredClone(value);
const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;
      try {
        result = action(store);
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

const requestValue = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function initializeWorldStore() {
  const existing = await listWorlds();
  const legacyExamples = existing.filter((world) => world.isTemplate === true);
  if (legacyExamples.length) {
    await withStore('readwrite', (store) => {
      legacyExamples.forEach((world) => store.delete(world.id));
    });
  }
  return listWorlds();
}

export async function listWorlds() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    return await requestValue(transaction.objectStore(STORE_NAME).getAll());
  } finally {
    database.close();
  }
}

export async function getWorld(id) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    return await requestValue(transaction.objectStore(STORE_NAME).get(id));
  } finally {
    database.close();
  }
}

export async function putWorld(world) {
  const next = { ...clone(world), updatedAt: new Date().toISOString() };
  await withStore('readwrite', (store) => store.put(next));
  return next;
}

export async function createBlankWorld() {
  const now = new Date().toISOString();
  return putWorld({
    id: uid('world'),
    title: '未命名世界',
    oneLine: '从一段简要说明或一本书开始。',
    family: 'narrative',
    sourceReference: '用户输入',
    license: '由用户输入决定',
    pipeline: 'auto',
    linterProfile: 'auto',
    testFocus: '等待首次生成。',
    tags: ['新世界'],
    tone: '未设定',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    blueprint: {
      brief: '', purpose: '世界之书', skin: '自动判断', ipTier: '自动判断', buildIntent: 'auto',
      dials: {}, tone: '自动判断', focuses: [],
    },
    seed: null,
    tasks: [{ id: uid('task'), title: '添加依据并建立世界模型', kind: 'generate', status: 'ready' }],
    snapshot: null,
  });
}

export function canDeleteWorld(world) {
  return Boolean(world && world.status === 'archived');
}

export async function archiveWorld(worldId) {
  const world = await getWorld(worldId);
  if (!world) throw new Error('找不到要归档的世界。');
  if (world.status === 'archived') return world;
  world.previousStatus = world.status || 'draft';
  world.status = 'archived';
  world.archivedAt = new Date().toISOString();
  return putWorld(world);
}

export async function restoreWorld(worldId) {
  const world = await getWorld(worldId);
  if (!world) throw new Error('找不到要恢复的世界。');
  if (world.status !== 'archived') return world;
  const restorableStatuses = new Set(['draft', 'in-progress', 'ready']);
  world.status = restorableStatuses.has(world.previousStatus) ? world.previousStatus : 'draft';
  delete world.previousStatus;
  delete world.archivedAt;
  return putWorld(world);
}

export async function deleteArchivedWorld(worldId) {
  const world = await getWorld(worldId);
  if (!world) throw new Error('找不到要删除的世界。');
  if (!canDeleteWorld(world)) throw new Error('世界必须先归档，才能永久删除。');
  await withStore('readwrite', (store) => store.delete(worldId));
  return worldId;
}

export async function addWorldTask(worldId, title, kind = 'content') {
  const world = await getWorld(worldId);
  if (!world) throw new Error('找不到要更新的世界。');
  if (world.status === 'archived') throw new Error('已归档的世界不能追加任务，请先恢复。');
  const cleanTitle = title.trim();
  if (!cleanTitle) return world;
  world.tasks = [...(world.tasks || []), { id: uid('task'), title: cleanTitle, kind, status: 'ready' }];
  return putWorld(world);
}

export async function updateWorldTask(worldId, taskId, status) {
  const world = await getWorld(worldId);
  if (!world) return null;
  world.tasks = (world.tasks || []).map((item) => item.id === taskId ? { ...item, status } : item);
  return putWorld(world);
}
