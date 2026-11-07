<script setup>
import { computed, nextTick, ref } from 'vue';
import { storeToRefs } from 'pinia';

import AppTabbar from '../components/AppTabbar.vue';
import TaskCard from '../components/TaskCard.vue';
import TaskForm from '../components/TaskForm.vue';
import TaskListControls from '../components/TaskListControls.vue';
import { useTasksStore } from '../store/tasks.js';
import { useProjectsStore } from '../store/projects.js';

import '../css/task-components.css';
import '../css/task-form.css';
import '../css/task-list.css';

const taskStore = useTasksStore();
const projectStore = useProjectsStore();

const {
  tasks,
  visibleTasks,
  searchText,
  selectedStatus,
  selectedPriority,
  selectedProject,
  sortOrder,
} = storeToRefs(taskStore);

const { projects } = storeToRefs(projectStore);

const showForm = ref(false);
const editingId = ref(null);
const formAnchor = ref(null);
const feedback = ref('');
const saveError = ref('');
const newProjectTitle = ref('');
const newProjectError = ref('');

const editingTask = computed(() =>
  tasks.value.find(task => task.id === editingId.value) ?? null,
);

const projectStats = computed(() =>
  projects.value.map(project => ({
    ...project,
    taskCount: tasks.value.filter(task => task.projectId === project.id).length,
  })),
);

async function openForm(id) {
  editingId.value = id;
  showForm.value = true;
  feedback.value = '';
  saveError.value = '';

  await nextTick();
  formAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelForm() {
  showForm.value = false;
  editingId.value = null;
  saveError.value = '';
}

function saveTask(values) {
  const isEditing = editingId.value !== null;
  const saved = isEditing
    ? taskStore.updateTask({ ...values, id: editingId.value })
    : taskStore.addTask(values);

  if (!saved) {
    saveError.value = 'Не вдалося зберегти завдання. Перевірте поля форми.';
    return;
  }

  feedback.value = isEditing
    ? `Завдання «${saved.title}» оновлено.`
    : `Завдання «${saved.title}» створено.`;

  cancelForm();
}

function handleDelete(id) {
  const task = tasks.value.find(item => item.id === Number(id));
  if (!task) return;

  if (!window.confirm(`Видалити завдання «${task.title}»?`)) return;
  if (!taskStore.deleteTask(id)) return;

  if (editingId.value === task.id) cancelForm();
  feedback.value = `Завдання «${task.title}» видалено.`;
}

function createProject() {
  const project = projectStore.addProject(newProjectTitle.value);

  if (!project) {
    newProjectError.value =
      'Введіть назву від 3 до 40 символів, якої ще немає у списку.';
    return;
  }

  newProjectTitle.value = '';
  newProjectError.value = '';
  selectedProject.value = project.id;
  feedback.value = `Проєкт «${project.title}» створено.`;
}
</script>

<template>
  <f7-page name="tasks" class="tf3-page">
    <f7-navbar title="Мої завдання" />

    <div class="tf3-container">
      <section class="tf3-hero">
        <div class="tf3-eyebrow">TASKFLOW / TASK MANAGER</div>
        <h1>Керування завданнями і проєктами</h1>
        <p>Створюйте проєкти та впорядковуйте свої завдання.</p>

        <button
          type="button"
          class="tf5-btn tf5-btn--primary tf5-new"
          @click="openForm(null)"
        >
          + Додати завдання
        </button>
      </section>

      <p v-if="feedback" class="tf4-feedback" role="status">
        {{ feedback }}
      </p>

      <section class="tf5-panel tf6-project-panel" aria-label="Проєкти">
        <h2>Мої проєкти</h2>

        <div class="tf6-project-list">
          <span
            v-for="project in projectStats"
            :key="project.id"
            class="tf6-project-pill"
          >
            {{ project.title }} <strong>{{ project.taskCount }}</strong>
          </span>
        </div>

        <form class="tf6-project-form" @submit.prevent="createProject">
          <label>
            Назва нового проєкту
            <input
              v-model="newProjectTitle"
              type="text"
              maxlength="40"
              placeholder="Наприклад: Лабораторні"
              @input="newProjectError = ''"
            />
          </label>

          <button type="submit" class="tf5-btn tf5-btn--primary">
            Створити проєкт
          </button>
        </form>

        <p v-if="newProjectError" class="tf5-error" role="alert">
          {{ newProjectError }}
        </p>
      </section>

      <div v-if="showForm" ref="formAnchor" class="tf4-form-section">
        <TaskForm
          :key="editingId ?? 'new'"
          :task="editingTask"
          :projects="projects"
          @save="saveTask"
          @cancel="cancelForm"
        />

        <p v-if="saveError" class="tf5-error" role="alert">
          {{ saveError }}
        </p>
      </div>

      <TaskListControls
        v-model:search="searchText"
        v-model:status="selectedStatus"
        v-model:priority="selectedPriority"
        v-model:project="selectedProject"
        v-model:sort="sortOrder"
        :projects="projects"
        @reset="taskStore.resetFilters()"
      />

      <section class="tf3-section">
        <div class="tf3-section-heading">
          <div>
            <div class="tf3-eyebrow">TASK LIST</div>
            <h2>Список завдань</h2>
          </div>

          <div class="tf3-counter">
            Показано: {{ visibleTasks.length }} із {{ tasks.length }}
          </div>
        </div>

        <div v-if="visibleTasks.length" class="tf3-task-grid">
          <TaskCard
            v-for="task in visibleTasks"
            :key="task.id"
            :task="task"
            :project-title="projectStore.projectTitle(task.projectId)"
            :editable="true"
            @status-change="taskStore.setTaskStatus"
            @priority-change="taskStore.setTaskPriority"
            @edit="openForm"
            @delete="handleDelete"
          />
        </div>

        <div v-else class="tf5-empty">
          <p>За поточними умовами завдань не знайдено.</p>

          <button type="button" class="tf5-btn" @click="taskStore.resetFilters()">
            Показати всі завдання
          </button>
        </div>
      </section>
    </div>

    <template #fixed>
      <AppTabbar active="tasks" />
    </template>
  </f7-page>
</template>