// worker.js - Maintenance worker interface logic for the Maintenance PWA (ES Module)

import { fetchTasks, fetchTask, updateTask, parsePhotoData, clearApiCache } from './api.js';
import { showMessage, hideMessage, formatDateTime, escapeHtml, createSafeElement, debounce } from './utils.js';
import { requireAuth, logout } from './auth.js';

// Module-level variables (fixed scope issues)
let filterStatus = null;
let filterUrgency = null;
let filterLocation = null;
let taskListLoading = null;
let taskList = null;
let taskDetailContainer = null;
let taskDetailContent = null;
let backToListBtn = null;
let currentTasks = [];
let currentTaskId = null;

/**
 * Initializes DOM references and event listeners.
 */
function initializeDOM() {
  filterStatus = document.getElementById('filter-status');
  filterUrgency = document.getElementById('filter-urgency');
  filterLocation = document.getElementById('filter-location');
  const applyFiltersBtn = document.getElementById('apply-filters');
  const resetFiltersBtn = document.getElementById('reset-filters');
  taskListLoading = document.getElementById('task-list-loading');
  taskList = document.getElementById('task-list');
  taskDetailContainer = document.getElementById('task-detail-container');
  backToListBtn = document.getElementById('back-to-list');
  taskDetailContent = document.getElementById('task-detail-content');

  // Event listeners for filters
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', () => {
      loadTasks();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (filterStatus) filterStatus.value = '';
      if (filterUrgency) filterUrgency.value = '';
      if (filterLocation) filterLocation.value = '';
      loadTasks();
    });
  }

  if (backToListBtn) {
    backToListBtn.addEventListener('click', () => {
      showTaskList();
    });
  }

  // Add click handler to task list for opening details
  if (taskList) {
    taskList.addEventListener('click', (e) => {
      // Check if clicked on a task item (not a button)
      const taskItem = e.target.closest('.task-item');
      const button = e.target.closest('button');
      
      if (taskItem && !button) {
        const taskId = taskItem.dataset.taskId;
        if (taskId) {
          openTaskDetail(taskId);
        }
      }
    });
  }

  // Add logout button handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

/**
 * Loads tasks from the backend with current filters.
 */
async function loadTasks() {
  if (!filterStatus || !filterUrgency || !filterLocation || !taskListLoading || !taskList) {
    console.error('DOM elements not initialized');
    return;
  }

  const status = filterStatus.value;
  const urgency = filterUrgency.value;
  const location = filterLocation.value.trim();

  taskListLoading.classList.remove('hidden');
  taskList.innerHTML = '';
  if (taskDetailContainer) taskDetailContainer.classList.add('hidden');

  try {
    const filters = {};
    if (status) filters.status = status;
    if (urgency) filters.urgency = urgency;
    if (location) filters.location = location;

    currentTasks = await fetchTasks(filters, 100, 0);
    renderTaskList();
  } catch (error) {
    console.error('Error loading tasks:', error);
    
    let message = 'Failed to load tasks. Please try again.';
    if (error.message === 'AUTH_EXPIRED') {
      message = 'Uw sessie is verlopen. Gelieve opnieuw in te loggen.';
      setTimeout(() => location.reload(), 2000);
    } else if (error.code) {
      message = `Fout: ${error.message}`;
    }
    
    taskListLoading.textContent = message;
  } finally {
    taskListLoading.classList.add('hidden');
  }
}

/**
 * Renders the list of tasks.
 */
function renderTaskList() {
  if (!taskList) return;
  
  taskList.innerHTML = '';

  if (currentTasks.length === 0) {
    const li = createSafeElement('li', 'Geen taken gevonden.', { class: 'task-item', style: 'text-align:center;padding:2rem;' });
    taskList.appendChild(li);
    return;
  }

  currentTasks.forEach(task => {
    const li = createSafeElement('li', null, { class: 'task-item', dataset: { taskId: task.id } });

    // Task header with ID and urgency
    const header = createSafeElement('div', null, { class: 'task-header' });

    const idSpan = createSafeElement('span', task.id.substring(0, 8), { class: 'task-id' });
    header.appendChild(idSpan);

    const urgencySpan = createSafeElement('span', task.urgency, { class: `task-urgency ${task.urgency.toLowerCase()}` });
    header.appendChild(urgencySpan);

    li.appendChild(header);

    // Description
    const descP = createSafeElement('p', task.description, { class: 'task-description' });
    li.appendChild(descP);

    // Location and requester
    const metaDiv = createSafeElement('div', null, { class: 'task-meta' });

    const locationP = createSafeElement('p', null, { class: 'task-location' });
    const locationStrong = createSafeElement('strong', 'Locatie: ');
    locationP.appendChild(locationStrong);
    locationP.appendChild(document.createTextNode(task.location));
    metaDiv.appendChild(locationP);

    const requesterP = createSafeElement('p', null, { class: 'task-requester' });
    const requesterStrong = createSafeElement('strong', 'Gemeld door: ');
    requesterP.appendChild(requesterStrong);
    requesterP.appendChild(document.createTextNode(task.requester_name || 'Anoniem'));
    metaDiv.appendChild(requesterP);

    li.appendChild(metaDiv);

    // Actions
    const actionsDiv = createSafeElement('div', null, { class: 'task-actions' });

    const statusBtn = createSafeElement('button', 'Status wijzigen', { class: 'status-btn' });
    statusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showStatusUpdateModal(task);
    });
    actionsDiv.appendChild(statusBtn);

    const notesBtn = createSafeElement('button', 'Notities', { class: 'notes-btn' });
    notesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showNotesModal(task);
    });
    actionsDiv.appendChild(notesBtn);

    // Optional: view photos
    const photos = parsePhotoData(task.photo_urls);
    if (photos.length > 0) {
      const photosBtn = createSafeElement('button', 'Foto\'s bekijken', { class: 'status-btn' });
      photosBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPhotosModal(task);
      });
      actionsDiv.appendChild(photosBtn);
    }

    li.appendChild(actionsDiv);
    taskList.appendChild(li);
  });
}

/**
 * Opens task detail view.
 * @param {string} taskId - Task ID to open
 */
async function openTaskDetail(taskId) {
  if (!taskDetailContainer || !taskDetailContent || !taskListLoading) return;

  currentTaskId = taskId;
  
  // Find task in current list first (avoid extra API call)
  let task = currentTasks.find(t => t.id === taskId);
  
  if (!task) {
    // Fetch from API if not in current list
    try {
      task = await fetchTask(taskId);
    } catch (error) {
      console.error('Error fetching task:', error);
      showMessage('task-detail-content', 'Kon taak niet laden.', 'error');
      return;
    }
  }
  
  showTaskDetail(task);
}

/**
 * Shows the task list view.
 */
function showTaskList() {
  if (!taskDetailContainer || !taskListLoading) return;
  
  taskDetailContainer.classList.add('hidden');
  taskListLoading.classList.remove('hidden');
  // Reload tasks to reflect any changes
  loadTasks();
}

/**
 * Shows the task detail view.
 * @param {Object} task - The task to show details for.
 */
function showTaskDetail(task) {
  if (!taskDetailContainer || !taskDetailContent || !taskListLoading) return;

  currentTaskId = task.id;
  taskDetailContainer.classList.remove('hidden');
  taskListLoading.classList.add('hidden');

  // Build the detail view
  taskDetailContent.innerHTML = '';

  const fields = [
    { label: 'Task ID', value: task.id },
    { label: 'Omschrijving', value: task.description },
    { label: 'Locatie', value: task.location },
    { label: 'Gemeld door', value: task.requester_name || 'Anoniem' },
    { label: 'Prioriteit', value: task.urgency },
    { label: 'Status', value: task.status },
    { label: 'Benodigd materiaal', value: task.required_materials || 'Geen' },
    { label: 'Onderhoudsnotities', value: task.maintenance_notes || 'Geen' },
    { label: 'Aangemaakt', value: formatDateTime(task.created_at) },
    { label: 'Laatst bijgewerkt', value: formatDateTime(task.updated_at) },
    { label: 'Voltooid', value: formatDateTime(task.completed_at) }
  ];

  fields.forEach(field => {
    const div = createSafeElement('div', null, { style: 'margin-bottom:0.5rem;' });
    const label = createSafeElement('strong', `${field.label}: `);
    div.appendChild(label);
    div.appendChild(document.createTextNode(field.value));
    taskDetailContent.appendChild(div);
  });

  // Photos
  const photos = parsePhotoData(task.photo_urls);
  if (photos.length > 0) {
    const photosHeading = createSafeElement('h3', 'Foto\'s');
    taskDetailContent.appendChild(photosHeading);

    const photosDiv = createSafeElement('div', null, { 
      style: 'display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem;' 
    });

    photos.forEach(photo => {
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.filename || 'Foto';
      img.style.maxWidth = '150px';
      img.style.maxHeight = '150px';
      img.style.border = '1px solid #ddd';
      img.style.borderRadius = '4px';
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => {
        window.open(photo.url, '_blank');
      });
      photosDiv.appendChild(img);
    });

    taskDetailContent.appendChild(photosDiv);
  }

  // Action buttons
  const actionsDiv = createSafeElement('div', null, { 
    style: 'margin-top:1.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;' 
  });

  const updateStatusBtn = createSafeElement('button', 'Status wijzigen', { class: 'submit-btn' });
  updateStatusBtn.addEventListener('click', () => {
    showStatusUpdateModal(task);
  });
  actionsDiv.appendChild(updateStatusBtn);

  const addNotesBtn = createSafeElement('button', 'Notities bewerken', { class: 'submit-btn' });
  addNotesBtn.addEventListener('click', () => {
    showNotesModal(task);
  });
  actionsDiv.appendChild(addNotesBtn);

  const completeBtn = createSafeElement(
    'button', 
    task.status === 'Completed' ? 'Heropenen' : 'Markeer als voltooid', 
    { class: task.status === 'Completed' ? 'cancel-btn' : 'submit-btn' }
  );
  completeBtn.addEventListener('click', async () => {
    try {
      if (task.status === 'Completed') {
        await updateTaskStatus(task.id, 'In progress'); // Reopen goes to In progress
      } else {
        await updateTaskStatus(task.id, 'Completed');
      }
      // Refresh will happen in the update functions
    } catch (error) {
      console.error('Error updating status:', error);
    }
  });
  actionsDiv.appendChild(completeBtn);

  taskDetailContent.appendChild(actionsDiv);
}

/**
 * Shows a modal to update the task status.
 * @param {Object} task - The task to update.
 */
function showStatusUpdateModal(task) {
  const modal = createSafeElement('div', null, { class: 'modal' });
  
  const modalContent = createSafeElement('div', null, { class: 'modal-content' });
  
  const closeBtn = createSafeElement('span', '×', { class: 'close-btn' });
  closeBtn.style.cssText = 'position:absolute;top:10px;right:15px;color:#aaa;font-size:28px;font-weight:bold;cursor:pointer;';
  closeBtn.addEventListener('click', () => modal.remove());
  
  const title = createSafeElement('h2', 'Status wijzigen', { style: 'margin-top:0;' });
  
  const form = createSafeElement('form', null, { id: 'status-form' });
  
  const selectDiv = createSafeElement('div', null, { style: 'margin-bottom:1rem;' });
  const label = createSafeElement('label', 'Nieuwe status:', { 
    for: 'status-select', 
    style: 'display:block;margin-bottom:0.5rem;font-weight:500;' 
  });
  const select = createSafeElement('select', null, { 
    id: 'status-select', 
    required: true,
    style: 'width:100%;padding:0.5rem;border:1px solid #ddd;border-radius:4px;'
  });
  
  const statuses = ['New', 'Planned', 'In progress', 'Waiting for materials', 'Completed'];
  statuses.forEach(s => {
    const option = createSafeElement('option', s, { value: s });
    select.appendChild(option);
  });
  
  selectDiv.appendChild(label);
  selectDiv.appendChild(select);
  form.appendChild(selectDiv);
  
  const btnDiv = createSafeElement('div', null, { style: 'display:flex;gap:0.5rem;' });
  const submitBtn = createSafeElement('button', 'Bijwerken', { 
    type: 'submit', 
    class: 'submit-btn',
    style: 'flex:1;' 
  });
  const cancelBtn = createSafeElement('button', 'Annuleren', { 
    type: 'button', 
    id: 'cancel-status-btn', 
    class: 'cancel-btn',
    style: 'flex:1;' 
  });
  
  btnDiv.appendChild(submitBtn);
  btnDiv.appendChild(cancelBtn);
  form.appendChild(btnDiv);
  
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(title);
  modalContent.appendChild(form);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Set current status
  select.value = task.status;

  const closeModal = () => modal.remove();

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newStatus = select.value;
    if (!newStatus) {
      showMessage('status-form', 'Gelieve een status te selecteren.', 'error');
      return;
    }

    try {
      await updateTaskStatus(task.id, newStatus);
      showMessage('status-form', 'Status succesvol bijgewerkt.', 'success');
      setTimeout(async () => {
        closeModal();
        await loadTasks(); // refresh the list
        if (!taskDetailContainer.classList.contains('hidden') && currentTaskId === task.id) {
          const updatedTask = await fetchTask(task.id);
          showTaskDetail(updatedTask); // refresh detail
        }
      }, 1000);
    } catch (error) {
      console.error('Error updating status:', error);
      let message = 'Kon status niet bijwerken. Probeer het opnieuw.';
      if (error.code === 'INVALID_TRANSITION') {
        message = `Ongeldige status overgang: ${task.status} → ${newStatus}`;
      } else if (error.message === 'AUTH_EXPIRED') {
        message = 'Uw sessie is verlopen. Gelieve opnieuw in te loggen.';
        setTimeout(() => location.reload(), 2000);
      }
      showMessage('status-form', message, 'error');
    }
  });
}

/**
 * Shows a modal to add/edit maintenance notes.
 * @param {Object} task - The task to update.
 */
function showNotesModal(task) {
  const modal = createSafeElement('div', null, { class: 'modal' });
  
  const modalContent = createSafeElement('div', null, { class: 'modal-content' });
  
  const closeBtn = createSafeElement('span', '×', { class: 'close-btn' });
  closeBtn.style.cssText = 'position:absolute;top:10px;right:15px;color:#aaa;font-size:28px;font-weight:bold;cursor:pointer;';
  closeBtn.addEventListener('click', () => modal.remove());
  
  const title = createSafeElement('h2', 'Onderhoudsnotities', { style: 'margin-top:0;' });
  
  const form = createSafeElement('form', null, { id: 'notes-form' });
  
  const textareaDiv = createSafeElement('div', null, { style: 'margin-bottom:1rem;' });
  const label = createSafeElement('label', 'Notities:', { 
    for: 'notes-textarea', 
    style: 'display:block;margin-bottom:0.5rem;font-weight:500;' 
  });
  const textarea = createSafeElement('textarea', task.maintenance_notes || '', { 
    id: 'notes-textarea', 
    rows: 4,
    style: 'width:100%;padding:0.5rem;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;font-family:inherit;'
  });
  
  textareaDiv.appendChild(label);
  textareaDiv.appendChild(textarea);
  form.appendChild(textareaDiv);
  
  const btnDiv = createSafeElement('div', null, { style: 'display:flex;gap:0.5rem;' });
  const submitBtn = createSafeElement('button', 'Opslaan', { 
    type: 'submit', 
    class: 'submit-btn',
    style: 'flex:1;' 
  });
  const cancelBtn = createSafeElement('button', 'Annuleren', { 
    type: 'button', 
    id: 'cancel-notes-btn', 
    class: 'cancel-btn',
    style: 'flex:1;' 
  });
  
  btnDiv.appendChild(submitBtn);
  btnDiv.appendChild(cancelBtn);
  form.appendChild(btnDiv);
  
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(title);
  modalContent.appendChild(form);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const closeModal = () => modal.remove();

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const notes = textarea.value.trim();

    try {
      await updateTaskNotes(task.id, notes);
      showMessage('notes-form', 'Notities opgeslagen.', 'success');
      setTimeout(async () => {
        closeModal();
        await loadTasks();
        if (!taskDetailContainer.classList.contains('hidden') && currentTaskId === task.id) {
          const updatedTask = await fetchTask(task.id);
          showTaskDetail(updatedTask);
        }
      }, 1000);
    } catch (error) {
      console.error('Error saving notes:', error);
      let message = 'Kon notities niet opslaan. Probeer het opnieuw.';
      if (error.message === 'AUTH_EXPIRED') {
        message = 'Uw sessie is verlopen. Gelieve opnieuw in te loggen.';
        setTimeout(() => location.reload(), 2000);
      }
      showMessage('notes-form', message, 'error');
    }
  });
}

/**
 * Shows a modal to view photos.
 * @param {Object} task - The task whose photos to view.
 */
function showPhotosModal(task) {
  const modal = createSafeElement('div', null, { class: 'modal' });
  
  const modalContent = createSafeElement('div', null, { class: 'modal-content' });
  
  const closeBtn = createSafeElement('span', '×', { class: 'close-btn' });
  closeBtn.style.cssText = 'position:absolute;top:10px;right:15px;color:#aaa;font-size:28px;font-weight:bold;cursor:pointer;';
  closeBtn.addEventListener('click', () => modal.remove());
  
  const title = createSafeElement('h2', 'Foto\'s', { style: 'margin-top:0;' });
  
  const photosContainer = createSafeElement('div', null, { 
    id: 'photos-container', 
    style: 'display:flex;flex-wrap:wrap;gap:0.5rem;max-height:80vh;overflow-y:auto;margin-top:1rem;' 
  });
  
  const photos = parsePhotoData(task.photo_urls);
  photos.forEach(photo => {
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.filename || 'Foto';
    img.style.maxWidth = '200px';
    img.style.maxHeight = '200px';
    img.style.border = '1px solid #ddd';
    img.style.borderRadius = '4px';
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => {
      window.open(photo.url, '_blank');
    });
    photosContainer.appendChild(img);
  });
  
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(title);
  modalContent.appendChild(photosContainer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

/**
 * Updates the status of a task via the backend.
 * @param {string} taskId - The task ID.
 * @param {string} newStatus - The new status.
 * @return {Promise} Promise that resolves when the update is complete.
 */
async function updateTaskStatus(taskId, newStatus) {
  const result = await updateTask(taskId, { status: newStatus });
  clearApiCache(); // Invalidate cache after mutation
  return result;
}

/**
 * Updates the maintenance notes of a task via the backend.
 * @param {string} taskId - The task ID.
 * @param {string} notes - The notes to save.
 * @return {Promise} Promise that resolves when the update is complete.
 */
async function updateTaskNotes(taskId, notes) {
  const result = await updateTask(taskId, { maintenance_notes: notes });
  clearApiCache(); // Invalidate cache after mutation
  return result;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  // Require authentication
  await requireAuth();
  
  initializeDOM();
  loadTasks();
});