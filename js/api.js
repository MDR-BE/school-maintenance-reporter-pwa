/* api.js - Shared API utilities for the Maintenance PWA */

const apiCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Generic API fetch with caching and error handling
 * @param {string} endpoint - API endpoint (e.g., '?action=list')
 * @param {Object} options - Fetch options
 * @param {boolean} useCache - Whether to use cache for GET requests
 * @returns {Promise<Object>} Parsed JSON response
 */
async function apiFetch(endpoint, options = {}, useCache = false) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No auth token available');
  }

  const url = new URL(getApiBaseUrl() + endpoint);
  url.searchParams.set('token', token);

  const cacheKey = url.toString() + JSON.stringify(options);
  
  // Check cache for GET requests
  if (useCache && (!options.method || options.method === 'GET')) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': options.body instanceof FormData ? undefined : 'application/json',
      ...options.headers
    }
  });

  if (response.status === 401 || response.status === 403) {
    clearAuthToken();
    location.reload();
    throw new Error('Authentication failed');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Cache successful GET responses
  if (useCache && (!options.method || options.method === 'GET')) {
    apiCache.set(cacheKey, { data, timestamp: Date.now() });
  }

  return data;
}

/**
 * Fetch all tasks with optional filters
 * @param {Object} filters - Filter options (status, urgency, location)
 * @param {number} limit - Maximum number of tasks
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} Array of tasks
 */
async function fetchTasks(filters = {}, limit = 50, offset = 0) {
  const params = new URLSearchParams({ action: 'list' });
  if (filters.status) params.set('status', filters.status);
  if (filters.urgency) params.set('urgency', filters.urgency);
  if (filters.location) params.set('location', filters.location);
  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);

  return apiFetch('?' + params.toString(), {}, true);
}

/**
 * Fetch a single task by ID
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} Task object
 */
async function fetchTask(taskId) {
  const params = new URLSearchParams({ action: 'get', id: taskId });
  return apiFetch('?' + params.toString(), {}, true);
}

/**
 * Create a new task
 * @param {Object} taskData - Task data (description, requester_name, location, etc.)
 * @param {File} photo - Optional photo file
 * @returns {Promise<Object>} Result with taskId
 */
async function createTask(taskData, photo = null) {
  const formData = new FormData();
  
  Object.entries(taskData).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, value);
    }
  });
  
  if (photo) {
    formData.append('file', photo);
  }

  return apiFetch('', {
    method: 'POST',
    body: formData
  });
}

/**
 * Update an existing task
 * @param {string} taskId - Task ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Result
 */
async function updateTask(taskId, updates) {
  const params = new URLSearchParams({ action: 'update', id: taskId });
  
  return apiFetch('?' + params.toString(), {
    method: 'POST',
    body: JSON.stringify(updates)
  });
}

/**
 * Clear the API cache
 */
function clearApiCache() {
  apiCache.clear();
}

/**
 * Show a message in the form-message element
 * @param {string} elementId - The message element ID
 * @param {string} message - The message to show
 * @param {string} type - The type of message: 'success', 'error', 'info'
 */
function showMessage(elementId, message, type = 'info') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = `message ${type}`;
  el.classList.remove('hidden');
}

/**
 * Hide a message element
 * @param {string} elementId - The ID of the element to hide
 */
function hideMessage(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.add('hidden');
  }
}