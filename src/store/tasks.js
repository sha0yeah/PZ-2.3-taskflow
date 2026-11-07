import { defineStore } from 'pinia';
import initialTasks from '../data/tasks.js';
import { useProjectsStore } from './projects.js';

const allowedStatuses = ['todo', 'progress', 'done'];
const allowedPriorities = ['low', 'medium', 'high'];
const priorityWeight = { high: 3, medium: 2, low: 1 };

function validDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function normalizeTask(values, projects) {
  const title = String(values.title ?? '').trim();
  const description = String(values.description ?? '').trim();
  const dueDate = String(values.dueDate ?? '').trim();
  const { status, priority } = values;

  if (
    title.length < 3 ||
    title.length > 80 ||
    description.length > 500 ||
    !allowedStatuses.includes(status) ||
    !allowedPriorities.includes(priority) ||
    !validDate(dueDate)
  ) {
    return null;
  }

  const projectId = projects.some(project => project.id === values.projectId)
    ? values.projectId
    : 'general';

  return { title, description, status, priority, dueDate, projectId };
}

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasks: initialTasks.map(task => ({
      ...task,
      projectId: task.projectId ?? 'general',
    })),
    searchText: '',
    selectedStatus: 'all',
    selectedPriority: 'all',
    selectedProject: 'all',
    sortOrder: 'newest',
  }),

  getters: {
    totalTasks: state => state.tasks.length,

    progressTasks: state =>
      state.tasks.filter(task => task.status === 'progress').length,

    completedTasks: state =>
      state.tasks.filter(task => task.status === 'done').length,

    activeTasks: state =>
      state.tasks
        .filter(task => task.status !== 'done')
        .sort((a, b) =>
          priorityWeight[b.priority] - priorityWeight[a.priority] ||
          b.id - a.id,
        )
        .slice(0, 3),

    visibleTasks: state => {
      const term = state.searchText.trim().toLocaleLowerCase('uk-UA');

      const filtered = state.tasks.filter(task => {
        const text = `${task.title} ${task.description ?? ''}`
          .toLocaleLowerCase('uk-UA');

        return (
          (!term || text.includes(term)) &&
          (state.selectedStatus === 'all' || task.status === state.selectedStatus) &&
          (state.selectedPriority === 'all' || task.priority === state.selectedPriority) &&
          (state.selectedProject === 'all' || task.projectId === state.selectedProject)
        );
      });

      return filtered.sort((a, b) => {
        if (state.sortOrder === 'title') {
          return a.title.localeCompare(b.title, 'uk-UA') || a.id - b.id;
        }

        if (state.sortOrder === 'priority') {
          return priorityWeight[b.priority] - priorityWeight[a.priority] ||
            b.id - a.id;
        }

        if (state.sortOrder === 'dueDate') {
          if (!a.dueDate && b.dueDate) return 1;
          if (a.dueDate && !b.dueDate) return -1;

          return (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || b.id - a.id;
        }

        return b.id - a.id;
      });
    },
  },

  actions: {
    addTask(values) {
      const normalized = normalizeTask(values, useProjectsStore().projects);
      if (!normalized) return null;

      const id = Math.max(0, ...this.tasks.map(task => task.id)) + 1;
      const task = { id, ...normalized };
      this.tasks.unshift(task);
      return task;
    },

    updateTask(values) {
      const task = this.tasks.find(item => item.id === Number(values.id));
      if (!task) return null;

      const normalized = normalizeTask(values, useProjectsStore().projects);
      if (!normalized) return null;

      Object.assign(task, normalized);
      return task;
    },

    deleteTask(id) {
      const index = this.tasks.findIndex(task => task.id === Number(id));
      if (index === -1) return false;

      this.tasks.splice(index, 1);
      return true;
    },

    setTaskStatus({ id, status }) {
      if (!allowedStatuses.includes(status)) return false;
      const task = this.tasks.find(item => item.id === Number(id));
      if (!task) return false;

      task.status = status;
      return true;
    },

    setTaskPriority({ id, priority }) {
      if (!allowedPriorities.includes(priority)) return false;
      const task = this.tasks.find(item => item.id === Number(id));
      if (!task) return false;

      task.priority = priority;
      return true;
    },

    resetFilters() {
      this.searchText = '';
      this.selectedStatus = 'all';
      this.selectedPriority = 'all';
      this.selectedProject = 'all';
      this.sortOrder = 'newest';
    },
  },
});