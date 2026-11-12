import { openDB } from 'idb';

const DB_NAME = 'taskflow-db';
const DB_VERSION = 1;
const STORES = ['tasks', 'projects', 'metadata'];

let databasePromise = null;

export function getDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('Цей браузер не підтримує IndexedDB.'),
    );
  }

  if (!databasePromise) {
    databasePromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
      },
    }).catch(error => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

export async function readSnapshot() {
  const db = await getDatabase();
  const tx = db.transaction(STORES, 'readonly');
  const metadata = tx.objectStore('metadata');

  const [tasks, projects, initialized, nextProjectId] = await Promise.all([
    tx.objectStore('tasks').getAll(),
    tx.objectStore('projects').getAll(),
    metadata.get('initialized'),
    metadata.get('nextProjectId'),
    tx.done,
  ]);

  return {
    tasks,
    projects,
    initialized: initialized === true,
    nextProjectId,
  };
}

export async function writeSnapshot(snapshot) {
  const db = await getDatabase();
  const tx = db.transaction(STORES, 'readwrite');
  const tasks = tx.objectStore('tasks');
  const projects = tx.objectStore('projects');
  const metadata = tx.objectStore('metadata');
  const done = tx.done;

  try {
    await tasks.clear();
    await projects.clear();

    for (const task of snapshot.tasks) {
      await tasks.put(task);
    }

    for (const project of snapshot.projects) {
      await projects.put(project);
    }

    await metadata.put(true, 'initialized');
    await metadata.put(snapshot.nextProjectId, 'nextProjectId');
    await done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // IndexedDB могла вже скасувати транзакцію.
    }

    await done.catch(() => {});
    throw error;
  }
}