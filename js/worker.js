// Maintenance worker interface logic for the Maintenance PWA

let currentTasks = [];
let currentTaskId = null;

document.addEventListener('DOMContentLoaded', () => {
  const filterStatus = document.getElementById('filter-status');
  const filterUrgency = document.getElementById('filter-urgency');
  const filterLocation = document.getElementById('filter-location');
  const applyFiltersBtn = document.getElementById('apply-filters');
  const resetFiltersBtn = document.getElementById('reset-filters');
  const taskListLoading = document.getElementById('task-list-loading');
  const taskList = document.getElementById('task-list');
  const taskDetailContainer = document.getElementById('task-detail-container');
  const backToListBtn = document.getElementById('back-to-list');
  const taskDetailContent = document.getElementById('task-detail-content');

  // Load tasks initially
  loadTasks();

  // Event listeners for filters
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', () => {
      loadTasks();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      filterStatus.value = '';
      filterUrgency.value = '';
      filterLocation.value = '';
      loadTasks();
    });
  }

  if (backToListBtn) {
    backToListBtn.addEventListener('click', () => {
      showTaskList();
    });
  }
});

/**
 * Load tasks from the backend with current filters.
 */
async function loadTasks() {
  const status = filterStatus.value;
  const urgency = filterUrgency.value;
  const location = filterLocation.value.trim();

  taskListLoading.classList.remove('hidden');
  taskList.innerHTML = '';
  taskDetailContainer.classList.add('hidden');

  try {
    const filters = {};
    if (status) filters.status = status;
    if (urgency) filters.urgency = urgency;
    if (location) filters.location = location;

    currentTasks = await fetchTasks(filters, 100, 0);
    renderTaskList();
  } catch (error) {
    console.error('Error loading tasks:', error);
    taskListLoading.textContent = 'Failed to load tasks. Please try again.';
  } finally {
    taskListLoading.classList.add('hidden');
  }
}

/**
 * Render the list of tasks.
 */
function renderTaskList() {
  taskList.innerHTML = '';

  if (currentTasks.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No tasks found.';
    li.style.textAlign = 'center';
    li.style.padding = '2rem';
    taskList.appendChild(li);
    return;
  }

  currentTasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.taskId = task.id;

    // Task header with ID and urgency
    const header = document.createElement('div');
    header.className = 'task-header';

    const idSpan = document.createElement('span');
    idSpan.className = 'task-id';
    idSpan.textContent = task.id.substring(0, 8); // show first 8 chars of UUID
    header.appendChild(idSpan);

    const urgencySpan = document.createElement('span');
    urgencySpan.className = `task-urgency ${task.urgency.toLowerCase()}`;
    urgencySpan.textContent = task.urgency;
    header.appendChild(urgencySpan);

    li.appendChild(header);

    // Description
    const descP = document.createElement('p');
    descP.className = 'task-description';
    descP.textContent = task.description;
    li.appendChild(descP);

    // Location and requester
    const metaDiv = document.createElement('div');
    metaDiv.className = 'task-meta';

    const locationP = document.createElement('p');
    locationP.className = 'task-location';
    locationP.innerHTML = `<strong>Location:</strong> ${task.location}`;
    metaDiv.appendChild(locationP);

    const requesterP = document.createElement('p');
    requesterP.className = 'task-requester';
    requesterP.innerHTML = `<strong>Reported by:</strong> ${task.requester_name || 'Anonymous'}`;
    metaDiv.appendChild(requesterP);

    li.appendChild(metaDiv);

    // Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'task-actions';

    const statusBtn = document.createElement('button');
    statusBtn.className = 'status-btn';
    statusBtn.textContent = 'Update Status';
    statusBtn.addEventListener('click', () => {
      showStatusUpdateModal(task);
    });
    actionsDiv.appendChild(statusBtn);

    const notesBtn = document.createElement('button');
    notesBtn.className = 'notes-btn';
    notesBtn.textContent = 'Add Notes';
    notesBtn.addEventListener('click', () => {
      showNotesModal(task);
    });
    actionsDiv.appendChild(notesBtn);

    // Optional: view photos
    if (task.photo_urls && task.photo_urls.length > 0) {
      const photosBtn = document.createElement('button');
      photosBtn.className = 'status-btn';
      photosBtn.textContent = 'View Photos';
      photosBtn.addEventListener('click', () => {
        showPhotosModal(task);
      });
      actionsDiv.appendChild(photosBtn);
    }

    li.appendChild(actionsDiv);

    taskList.appendChild(li);
  });
}

/**
 * Show the task list view.
 */
function showTaskList() {
  taskDetailContainer.classList.add('hidden');
  taskListLoading.classList.remove('hidden');
  // Reload tasks to reflect any changes
  loadTasks();
}

/**
 * Show the task detail view.
 * @param {Object} task - The task to show details for.
 */
async function showTaskDetail(task) {
  currentTaskId = task.id;
  taskDetailContainer.classList.remove('hidden');
  taskListLoading.classList.add('hidden');

  // Build the detail view
  taskDetailContent.innerHTML = '';

  const fields = [
    { label: 'Task ID', value: task.id },
    { label: 'Description', value: task.description },
    { label: 'Location', value: task.location },
    { label: 'Reported by', value: task.requester_name || 'Anonymous' },
    { label: 'Urgency', value: task.urgency },
    { label: 'Status', value: task.status },
    { label: 'Required Materials', value: task.required_materials || 'None' },
    { label: 'Maintenance Notes', value: task.maintenance_notes || 'None' },
    { label: 'Created at', value: formatDateTime(task.created_at) },
    { label: 'Updated at', value: formatDateTime(task.updated_at) },
    { label: 'Completed at', value: formatDateTime(task.completed_at) }
  ];

  fields.forEach(field => {
    const div = document.createElement('div');
    div.style.marginBottom = '0.5rem';
    const label = document.createElement('strong');
    label.textContent = `${field.label}: `;
    div.appendChild(label);
    div.appendChild(document.createTextNode(field.value));
    taskDetailContent.appendChild(div);
  });

  // Photos
  if (task.photo_urls && task.photo_urls.length > 0) {
    const photosHeading = document.createElement('h3');
    photosHeading.textContent = 'Photos';
    taskDetailContent.appendChild(photosHeading);

    const photosDiv = document.createElement('div');
    photosDiv.style.display = 'flex';
    photosDiv.style.flexWrap = 'wrap';
    photosDiv.style.gap = '0.5rem';

    task.photo_urls.forEach(url => {
      const img = document.createElement('img');
      img.src = url;
      img.style.maxWidth = '150px';
      img.style.maxHeight = '150px';
      img.style.border = '1px solid #ddd';
      img.style.borderRadius = '4px';
      photosDiv.appendChild(img);
    });

    taskDetailContent.appendChild(photosDiv);
  }

  // Action buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.style.marginTop = '1.5rem';
  actionsDiv.style.display = 'flex';
  actionsDiv.style.gap = '0.5rem';

  const updateStatusBtn = document.createElement('button');
  updateStatusBtn.className = 'submit-btn';
  updateStatusBtn.textContent = 'Update Status';
  updateStatusBtn.addEventListener('click', () => {
    showStatusUpdateModal(task);
  });
  actionsDiv.appendChild(updateStatusBtn);

  const addNotesBtn = document.createElement('button');
  addNotesBtn.className = 'submit-btn';
  addNotesBtn.textContent = 'Add/Edit Notes';
  addNotesBtn.addEventListener('click', () => {
    showNotesModal(task);
  });
  actionsDiv.appendChild(addNotesBtn);

  const completeBtn = document.createElement('button');
  completeBtn.className = task.status === 'Completed' ? 'cancel-btn' : 'submit-btn';
  completeBtn.textContent = task.status === 'Completed' ? 'Reopen' : 'Mark as Completed';
  completeBtn.addEventListener('click', () => {
    if (task.status === 'Completed') {
      updateTaskStatus(task.id, 'New');
    } else {
      updateTaskStatus(task.id, 'Completed');
    }
  });
  actionsDiv.appendChild(completeBtn);

  taskDetailContent.appendChild(actionsDiv);
}

/**
 * Show a modal to update the task status.
 * @param {Object} task - The task to update.
 */
function showStatusUpdateModal(task) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-btn">&times;</span>
      <h2>Update Status</h2>
      <form id="status-form">
        <div>
          <label for="status-select">New Status:</label>
          <select id="status-select" required>
            <option value="">Select status</option>
            <option value="New">New</option>
            <option value="Planned">Planned</option>
            <option value="In progress">In progress</option>
            <option value="Waiting for materials">Waiting for materials</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <button type="submit" class="submit-btn">Update</button>
        <button type="button" id="cancel-status-btn" class="cancel-btn">Cancel</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  const statusSelect = modal.querySelector('#status-select');
  statusSelect.value = task.status;

  const closeBtn = modal.querySelector('.close-btn');
  const cancelBtn = modal.querySelector('#cancel-status-btn');
  const form = modal.querySelector('#status-form');

  const closeModal = () => {
    modal.remove();
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newStatus = statusSelect.value;
    if (!newStatus) {
      showMessage('status-form', 'Please select a status.', 'error');
      return;
    }

    try {
      await updateTaskStatus(task.id, newStatus);
      showMessage('status-form', 'Status updated successfully.', 'success');
      setTimeout(async () => {
        closeModal();
        loadTasks(); // refresh the list
        if (!taskDetailContainer.classList.contains('hidden') && currentTaskId === task.id) {
          const updatedTask = await getTaskById(task.id);
          showTaskDetail(updatedTask); // refresh detail
        }
      }, 1500);
    } catch (error) {
      console.error('Error updating status:', error);
      showMessage('status-form', 'Failed to update status. Please try again.', 'error');
    }
  });
}

/**
 * Show a modal to add/edit maintenance notes.
 * @param {Object} task - The task to update.
 */
function showNotesModal(task) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-btn">&times;</span>
      <h2>Maintenance Notes</h2>
      <form id="notes-form">
        <div>
          <label for="notes-textarea">Notes:</label>
          <textarea id="notes-textarea" rows="4">${task.maintenance_notes || ''}</textarea>
        </div>
        <button type="submit" class="submit-btn">Save Notes</button>
        <button type="button" id="cancel-notes-btn" class="cancel-btn">Cancel</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  const notesTextarea = modal.querySelector('#notes-textarea');
  const closeBtn = modal.querySelector('.close-btn');
  const cancelBtn = modal.querySelector('#cancel-notes-btn');
  const form = modal.querySelector('#notes-form');

  const closeModal = () => {
    modal.remove();
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const notes = notesTextarea.value.trim();

    try {
      await updateTaskNotes(task.id, notes);
      showMessage('notes-form', 'Notes saved successfully.', 'success');
      setTimeout(async () => {
        closeModal();
        loadTasks(); // refresh the list
        if (!taskDetailContainer.classList.contains('hidden') && currentTaskId === task.id) {
          const updatedTask = await getTaskById(task.id);
          showTaskDetail(updatedTask); // refresh detail
        }
      }, 1500);
    } catch (error) {
      console.error('Error saving notes:', error);
      showMessage('notes-form', 'Failed to save notes. Please try again.', 'error');
    }
  });
}

/**
 * Show a modal to view photos.
 * @param {Object} task - The task whose photos to view.
 */
function showPhotosModal(task) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-btn">&times;</span>
      <h2>Photos</h2>
      <div id="photos-container" style="display: flex; flex-wrap: wrap; gap: 0.5rem; max-height: 80vh; overflow-y: auto;">
        <!-- Photos will be inserted here -->
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const photosContainer = modal.querySelector('#photos-container');
  const closeBtn = modal.querySelector('.close-btn');

  task.photo_urls.forEach(url => {
    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '200px';
    img.style.maxHeight = '200px';
    img.style.border = '1px solid #ddd';
    img.style.borderRadius = '4px';
    photosContainer.appendChild(img);
  });

  const closeModal = () => {
    modal.remove();
  };

  closeBtn.addEventListener('click', closeModal);
}

/**
 * Update the status of a task via the backend.
 * @param {string} taskId - The task ID.
 * @param {string} newStatus - The new status.
 * @return {Promise} Promise that resolves when the update is complete.
 */
async function updateTaskStatus(taskId, newStatus) {
  return updateTask(taskId, { status: newStatus });
}

/**
 * Update the maintenance notes of a task via the backend.
 * @param {string} taskId - The task ID.
 * @param {string} notes - The notes to save.
 * @return {Promise} Promise that resolves when the update is complete.
 */
async function updateTaskNotes(taskId, notes) {
  return updateTask(taskId, { maintenance_notes: notes });
}

/**
 * Get a task by its ID from the backend.
 * @param {string} taskId - The task ID.
 * @return {Promise<Object>} The task.
 */
async function getTaskById(taskId) {
  return fetchTask(taskId);
}