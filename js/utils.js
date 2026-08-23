// utils.js - Shared utilities for the Maintenance PWA (ES Module)

/**
 * Returns the base URL of the Google Apps Script Web App.
 * Must be configured after deployment.
 */
export function getApiBaseUrl() {
  // Try to get from localStorage first (set after deployment)
  const savedUrl = localStorage.getItem('pwa_api_base_url');
  if (savedUrl) {
    return savedUrl;
  }
  
  // Fallback to a default that should be replaced
  // TODO: Replace with the actual web app URL after deployment
  return 'https://script.google.com/macros/s/AKfycbzsGdvD4ATywZzchjfozluOgtlw6mR2vZKUZuTpmcd1qyPNmH_0rzjUEaahQCQkxVLJ/exec';
}

/**
 * Generates a UUID (simplified version).
 * @return {string} A UUID-like string.
 */
export function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Formats a date string to a local date-time string for display.
 * @param {string} isoString - ISO date string.
 * @return {string} Formatted date string.
 */
export function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Debounce function to limit the rate of function calls.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The wait time in milliseconds.
 * @return {Function} The debounced function.
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str - String to escape
 * @return {string} Escaped string
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

/**
 * Safely sets text content on an element (XSS-safe alternative to innerHTML).
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text content
 */
export function safeSetText(element, text) {
  if (!element) return;
  element.textContent = text;
}

/**
 * Creates an element with safe text content.
 * @param {string} tag - HTML tag name
 * @param {string} text - Text content
 * @param {Object} attributes - Optional attributes
 * @return {HTMLElement}
 */
export function createSafeElement(tag, text, attributes = {}) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value);
  });
  return el;
}

/**
 * Shows a message in a message element.
 * @param {string} elementId - The message element ID
 * @param {string} message - The message to show
 * @param {string} type - The type of message: 'success', 'error', 'info'
 */
export function showMessage(elementId, message, type = 'info') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = `message ${type}`;
  el.classList.remove('hidden');
}

/**
 * Hides a message element.
 * @param {string} elementId - The ID of the element to hide
 */
export function hideMessage(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.add('hidden');
  }
}

/**
 * Validates file for photo upload.
 * @param {File} file - File to validate
 * @return {Object} {valid: boolean, error: string|null}
 */
export function validatePhotoFile(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP` };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 5MB)` };
  }
  
  return { valid: true, error: null };
}

/**
 * Resizes and compresses an image file using canvas.
 * @param {File} file - Image file
 * @param {Object} options - {maxDimension: number, quality: number}
 * @return {Promise<string>} Base64 data URL (without prefix)
 */
export function processImage(file, options = {}) {
  const maxDimension = options.maxDimension || 1600;
  const quality = options.quality || 0.75;
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round(height * maxDimension / width);
          width = maxDimension;
        } else {
          width = Math.round(width * maxDimension / height);
          height = maxDimension;
        }
      }
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to base64 (JPEG for photos, PNG for transparency)
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, quality);
      
      // Remove "data:image/jpeg;base64," prefix
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a File to base64 with processing.
 * @param {File} file - Image file
 * @return {Promise<Object>} {filename, mimeType, base64}
 */
export async function photoToBase64(file) {
  const base64 = await processImage(file);
  return {
    filename: file.name,
    mimeType: file.type,
    base64: base64
  };
}

/**
 * Parses photo URLs from backend (handles both old and new formats).
 * @param {string|Array} photoData - Photo data from backend
 * @return {Array<Object>} Array of photo objects
 */
export function parsePhotoData(photoData) {
  if (!photoData) return [];
  
  // New format: array of objects
  if (Array.isArray(photoData)) {
    return photoData.map(p => ({
      url: p.url || p,
      filename: p.filename || '',
      id: p.id || '',
      mimeType: p.mimeType || ''
    }));
  }
  
  // Old format: comma-separated string
  if (typeof photoData === 'string') {
    try {
      const parsed = JSON.parse(photoData);
      if (Array.isArray(parsed)) {
        return parsed.map(p => ({
          url: p.url || p,
          filename: p.filename || '',
          id: p.id || '',
          mimeType: p.mimeType || ''
        }));
      }
    } catch (e) {
      // Fall through to comma-separated parsing
    }
    
    return photoData.split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0)
      .map(url => ({ url, filename: '', id: '', mimeType: '' }));
  }
  
  /**
 * Returns true if browser is online, false if offline
 * @return {boolean} Online status
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Returns a Promise that resolves when online status changes
 * @param {Function} callback - Function to call when status changes
 * @return {Function} Unsubscribe function
 */
export function onOnlineChange(callback) {
  const handler = () => callback(navigator.onLine);
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}

/**
 * Simple request queue for offline storage (preparation for future implementation)
 */
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  /**
   * Add a request to the queue
   * @param {Object} request - {url, options, timestamp}
   */
  async enqueue(request) {
    this.queue.push({
      ...request,
      timestamp: Date.now()
    });
    await this.persistQueue();
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process all queued requests
   */
  async processQueue() {
    if (this.processing || !navigator.onLine) return;
    
    this.processing = true;
    while (this.queue.length > 0 && navigator.onLine) {
      const request = this.queue.shift();
      try {
        // Attempt the request
        await timeoutFetch(request.url, request.options);
        await this.persistQueue(); // Update persisted queue
      } catch (error) {
        // If request fails, put it back at the end of the queue
        console.warn('Request failed, re-queuing:', error);
        this.queue.push(request);
        await this.persistQueue();
        break; // Stop processing if we're offline now
      }
    }
    this.processing = false;
    
    // Retry after a delay if there are still items
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 30000); // 30 seconds
    }
  }

  /**
   * Persist queue to localStorage
   */
  async persistQueue() {
    try {
      localStorage.setItem('pwa_request_queue', JSON.stringify(this.queue));
    } catch (e) {
      console.warn('Failed to persist request queue:', e);
    }
  }

  /**
   * Load queue from localStorage
   */
  async loadQueue() {
    try {
      const saved = localStorage.getItem('pwa_request_queue');
      if (saved) {
        this.queue = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load request queue:', e);
      this.queue = [];
    }
  }
}

// Create singleton instance
export const requestQueue = new RequestQueue();
