// Utility functions for the Maintenance PWA

/**
 * Returns the base URL of the Google Apps Script Web App.
 * In a real deployment, this would be set to the actual web app URL.
 * For development, we can use a placeholder.
 */
function getApiBaseUrl() {
  // TODO: Replace with the actual web app URL after deployment
  // For now, we'll return a placeholder; the user must update this.
  return 'https://script.google.com/macros/s/AKfycbyXuW3sq5gCSS0jdGdoP19KIGyQHpZ2kVNHc6kIUgoykCJxgMsZP990hJQNpNg6NPkA/exec';
}

/**
 * Shows a message in the form-message element.
 * @param {string} message - The message to show.
 * @param {string} type - The type of message: 'success', 'error', 'info'.
 */
function showMessage(elementId, message, type = 'info') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = `message ${type}`;
  el.classList.remove('hidden');
}

/**
 * Hides a message element.
 * @param {string} elementId - The ID of the element to hide.
 */
function hideMessage(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.add('hidden');
  }
}

/**
 * Generates a UUID (simplified version).
 * @return {string} A UUID-like string.
 */
function generateUuid() {
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
function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString();
}

/**
 * Debounce function to limit the rate of function calls.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The wait time in milliseconds.
 * @return {Function} The debounced function.
 */
function debounce(func, wait) {
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
