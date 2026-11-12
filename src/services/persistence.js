import { reactive } from 'vue';
import { useTasksStore } from '../store/tasks.js';
import { useProjectsStore } from '../store/projects.js';
import { readSnapshot, writeSnapshot } from './database.js';

export const persistenceState = reactive({
  status: 'loading',
  error: '',
  canRetry: false,
  lastSavedAt: null,
});

let taskStore;
let projectStore;
let enabled = false;
let writing = false;
let scheduled = false;
let pendingSnapshot = null;
let lastRequested = '';

function serializeSnapshot() {
  return JSON.stringify({
    tasks: taskStore.tasks,
    projects: projectStore.projects,
    nextProjectId: projectStore.nextProjectId,
  });
}

async function flushChanges() {
  if (!enabled || writing) return;
  writing = true;

  try {
    while (pendingSnapshot !== null) {
      const snapshot = pendingSnapshot;
      pendingSnapshot = null;

      await writeSnapshot(snapshot);
      persistenceState.lastSavedAt = new Date();
    }

    persistenceState.status = 'saved';
    persistenceState.error = '';
    persistenceState.canRetry = false;
  } catch (error) {
    console.error('TaskFlow: не вдалося зберегти дані:', error);
    persistenceState.status = 'error';
    persistenceState.error = 'Зміни поки що залишилися лише в пам’яті.';
    persistenceState.canRetry = true;
  } finally {
    writing = false;
  }
}

function requestSave(force = false) {
  if (!enabled) return;

  const serialized = serializeSnapshot();
  if (!force && serialized === lastRequested) return;

  lastRequested = serialized;
  pendingSnapshot = JSON.parse(serialized);

  persistenceState.status = 'saving';
  persistenceState.error = '';
  persistenceState.canRetry = false;

  void flushChanges();
}

function onStoreChanged() {
  if (scheduled) return;
  scheduled = true;

  queueMicrotask(() => {
    scheduled = false;
    requestSave();
  });
}

export function retrySave() {
  if (persistenceState.canRetry) {
    requestSave(true);
  }
}

function resolveNextProjectId(snapshot) {
  let minimum = 1;

  for (const project of snapshot.projects) {
    const match = /^project-(\d+)$/.exec(String(project.id));
    if (match) {
      minimum = Math.max(minimum, Number(match[1]) + 1);
    }
  }

  return Number.isSafeInteger(snapshot.nextProjectId)
    ? Math.max(minimum, snapshot.nextProjectId)
    : minimum;
}

export async function initializePersistence(pinia) {
  taskStore = useTasksStore(pinia);
  projectStore = useProjectsStore(pinia);

  try {
    const snapshot = await readSnapshot();

    if (snapshot.initialized) {
      projectStore.$patch({
        projects: snapshot.projects,
        nextProjectId: resolveNextProjectId(snapshot),
      });

      taskStore.$patch({ tasks: snapshot.tasks });
    } else {
      await writeSnapshot(JSON.parse(serializeSnapshot()));
      persistenceState.lastSavedAt = new Date();
    }

    lastRequested = serializeSnapshot();
    enabled = true;

    const options = { detached: true, flush: 'sync' };
    taskStore.$subscribe(onStoreChanged, options);
    projectStore.$subscribe(onStoreChanged, options);

    persistenceState.status = 'saved';
  } catch (error) {
    enabled = false;
    console.error('TaskFlow: не вдалося підготувати IndexedDB:', error);
    persistenceState.status = 'error';
    persistenceState.error =
      'Не вдалося відкрити або відновити локальні дані. '
      + 'Автоматичне збереження вимкнено.';
    persistenceState.canRetry = false;
  }
}