// utils.js - Shared utilities for the Maintenance PWA (ES Module)

/**
 * Returns the base URL of the Google Apps Script Web App.
 * Must be configured after deployment.
 */
export function getApiBaseUrl() {
  // TODO: Replace with the actual web app URL after deployment
  // For now, we'll return a placeholder; the user must update this.
  return 'https://script.google.com/macros/s/AKfycbzsGdvD4ATywZzchjfozluOgtlw6mR2vZKUZuTpmcd1qyPNmH_0rzjUEaahQCQkxVLJ/exec';
}

/**
 * Generates a UUID (simplified version).
 * @return {string} A UUID-like string.
 */
export function generateUuid() {
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
  
  return [];
}
