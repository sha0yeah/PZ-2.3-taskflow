import { reactive } from 'vue';
import initialTasks from '../data/tasks.js';

const allowedStatuses = ['todo', 'progress', 'done'];
const allowedPriorities = ['low', 'medium', 'high'];

export const taskState = reactive({
  tasks: initialTasks.map(task => ({ ...task })),
});

function findTask(id) {
  return taskState.tasks.find(task => task.id === Number(id));
}

function validDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}` === value;
}

function normalizeTaskData(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const title =
    typeof data.title === 'string' ? data.title.trim() : '';

  const description =
    typeof data.description === 'string'
      ? data.description.trim()
      : '';

  if (title.length < 3 || title.length > 80) return null;
  if (description.length > 500) return null;
  if (!allowedStatuses.includes(data.status)) return null;
  if (!allowedPriorities.includes(data.priority)) return null;

  // У цій роботі термін можна не вказувати.
  const dueDate = data.dueDate ?? '';

  if (dueDate !== '' && !validDate(dueDate)) {
    return null;
  }

  return {
    title,
    description,
    status: data.status,
    priority: data.priority,
    dueDate,
  };
}

export function addTask(data) {
  const normalized = normalizeTaskData(data);

  if (!normalized) {
    return null;
  }

  const nextId =
    taskState.tasks.reduce(
      (maxId, task) => Math.max(maxId, task.id),
      0,
    ) + 1;

  const newTask = {
    id: nextId,
    ...normalized,
  };

  taskState.tasks.unshift(newTask);

  return newTask;
}

export function updateTask({ id, ...data }) {
  const task = findTask(id);
  const normalized = normalizeTaskData(data);

  if (!task || !normalized) {
    return null;
  }

  Object.assign(task, normalized);

  return task;
}

export function setTaskStatus({ id, status }) {
  if (!allowedStatuses.includes(status)) {
    return false;
  }

  const task = findTask(id);

  if (!task) {
    return false;
  }

  task.status = status;

  return true;
}

export function setTaskPriority({ id, priority }) {
  if (!allowedPriorities.includes(priority)) {
    return false;
  }

  const task = findTask(id);

  if (!task) {
    return false;
  }

  task.priority = priority;

  return true;
}

export function deleteTask(id) {
  const index = taskState.tasks.findIndex(
    task => task.id === Number(id),
  );

  if (index === -1) {
    return false;
  }

  taskState.tasks.splice(index, 1);

  return true;
}