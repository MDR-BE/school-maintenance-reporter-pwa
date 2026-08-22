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

  // Prepare headers
  const headers = {
    ...options.headers
  };

  // Set Content-Type appropriately
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers
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
 * Convert a File object to the format expected by Apps Script (Base64)
 * @param {File} file
 * @returns {Promise<Object>} {filename, mimeType, base64}
 */
async function photoToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result;

      // Remove "data:image/jpeg;base64," prefix
      const base64 = dataUrl.split(',')[1];

      resolve({
        filename: file.name,
        mimeType: file.type,
        base64: base64
      });
    };

    reader.onerror = () => {
      reject(new Error(`Could not read photo: ${file.name}`));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Creates a new task and optionally uploads one or more photos.
 * @param {Object} taskData - Task data (description, requester_name, location, etc.)
 * @param {File|File[]|null} photos - Optional photo file(s)
 * @returns {Promise<Object>} Result with taskId
 */
async function createTask(taskData, photos = null) {
  const photoArray = photos
    ? (Array.isArray(photos) ? photos : [photos])
    : [];

  const convertedPhotos = await Promise.all(
    photoArray.map(photoToBase64)
  );

  const payload = {
    ...taskData,
    photos: convertedPhotos
  };

  return apiFetch('', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
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
    headers: {
      'Content-Type': 'application/json'
    },
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