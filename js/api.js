// Timeout for fetch requests in milliseconds
const FETCH_TIMEOUT = 8000;

/**
 * Fetch with timeout
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function timeoutFetch(url, options) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT)
    )
  ]);
}

// api.js - API client for the Maintenance PWA (ES Module)

import { getApiBaseUrl, getAuthToken } from './utils.js';

const apiCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Generic API fetch with caching and error handling.
 * Uses form-urlencoded to avoid CORS preflight issues.
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
  
  // Prepare form-urlencoded body for POST requests
  let body = null;
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  
  if (options.body && options.method && options.method.toUpperCase() === 'POST') {
    // Convert body object to form data
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.body)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // For arrays (like photos), stringify as JSON
          params.append(key, JSON.stringify(value));
        } else {
          params.append(key, String(value));
        }
      }
    }
    body = params.toString();
  }
  
  // Use timeoutFetch instead of regular fetch
  const response = await timeoutFetch(url.toString(), {
    ...options,
    headers,
    body
  });
  
  if (response.status === 401 || response.status === 403) {
    clearAuthToken();
    // Don't reload here - let the caller handle it
    throw new Error('AUTH_EXPIRED');
  }
  
  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch (e) {
      // Ignore parse errors
    }
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Handle standardized response format
  if (data.success === false) {
    const error = new Error(data.error || 'API Error');
    error.code = data.code;
    throw error;
  }
  
  // Cache successful GET responses
  if (useCache && (!options.method || options.method === 'GET')) {
    apiCache.set(cacheKey, { data: data.data || data, timestamp: Date.now() });
  }
  
  return data.data || data;
}

/**
 * Clears the API cache.
 */
export function clearApiCache() {
  apiCache.clear();
}

/**
 * Fetches all tasks with optional filters.
 * @param {Object} filters - Filter options (status, urgency, location)
 * @param {number} limit - Maximum number of tasks
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} Array of tasks
 */
export async function fetchTasks(filters = {}, limit = 50, offset = 0) {
  const params = new URLSearchParams({ action: 'list' });
  if (filters.status) params.set('status', filters.status);
  if (filters.urgency) params.set('urgency', filters.urgency);
  if (filters.location) params.set('location', filters.location);
  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);
  
  return apiFetch('?' + params.toString(), {}, true);
}

/**
 * Fetches a single task by ID.
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} Task object
 */
export async function fetchTask(taskId) {
  const params = new URLSearchParams({ action: 'get', id: taskId });
  return apiFetch('?' + params.toString(), {}, true);
}

/**
 * Fetches task counts by status.
 * @returns {Promise<Object>} Counts object
 */
export async function fetchTaskCounts() {
  const params = new URLSearchParams({ action: 'counts' });
  return apiFetch('?' + params.toString(), {}, true);
}

/**
 * Creates a new task with optional photos.
 * @param {Object} taskData - Task data (description, requester_name, location, etc.)
 * @param {File|File[]|null} photos - Optional photo file(s)
 * @returns {Promise<Object>} Result with taskId and task
 */
export async function createTask(taskData, photos = null) {
  try {
    const photoArray = photos
      ? (Array.isArray(photos) ? photos : [photos])
      : [];
  
    // Process photos to base64 with individual error handling
    const convertedPhotos = [];
    for (const photo of photoArray) {
      try {
        const base64 = await photoToBase64(photo);
        convertedPhotos.push({
          filename: photo.name,
          mimeType: photo.type,
          base64: base64
        });
      } catch (photoError) {
        console.error('Error processing photo:', photoError);
        throw new Error(`Failed to process photo ${photo.name}: ${photoError.message}`);
      }
    }
  
    // Prepare payload
    const payload = {
      ...taskData,
      photos: convertedPhotos
    };
  
    // Remove photos from payload if empty (optional field)
    if (convertedPhotos.length === 0) {
      delete payload.photos;
    }
  
    return apiFetch('', {
      method: 'POST',
      body: { action: 'create', ...payload }
    });
  } catch (error) {
    // Re-throw with additional context if needed
    if (error.message === 'AUTH_EXPIRED') {
      throw error;
    }
    throw new Error(`Failed to create task: ${error.message}`);
  }
}

/**
 * Updates an existing task.
 * @param {string} taskId - Task ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated task
 */
export async function updateTask(taskId, updates) {
  try {
    return apiFetch('', {
      method: 'POST',
      body: { action: 'update', id: taskId, ...updates }
    });
  } catch (error) {
    if (error.message === 'AUTH_EXPIRED') {
      throw error;
    }
    throw new Error(`Failed to update task: ${error.message}`);
  }
}

/**
 * Uploads photos to an existing task.
 * @param {string} taskId - Task ID
 * @param {File|File[]} photos - Photo file(s)
 * @returns {Promise<Object>} Updated task
 */
export async function uploadPhotos(taskId, photos) {
  try {
    const photoArray = Array.isArray(photos) ? photos : [photos];
    const convertedPhotos = [];
    
    for (const photo of photoArray) {
      try {
        const base64 = await photoToBase64(photo);
        convertedPhotos.push({
          filename: photo.name,
          mimeType: photo.type,
          base64: base64
        });
      } catch (photoError) {
        console.error('Error processing photo for upload:', photoError);
        throw new Error(`Failed to process photo ${photo.name} for upload: ${photoError.message}`);
      }
    }
    
    return apiFetch('', {
      method: 'POST',
      body: { action: 'upload_photos', id: taskId, photos: convertedPhotos }
    });
  } catch (error) {
    if (error.message === 'AUTH_EXPIRED') {
      throw error;
    }
    throw new Error(`Failed to upload photos: ${error.message}`);
  }
}