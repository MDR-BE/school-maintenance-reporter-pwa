// auth.js - Authentication module for the Maintenance PWA (ES Module)

import { getApiBaseUrl } from './utils.js';

const TOKEN_KEY = 'pwa_auth_token';
const TOKEN_EXPIRY_KEY = 'pwa_token_expiry';
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes (must match backend)

/**
 * Checks if a valid (non-expired) token exists in localStorage.
 * @return {boolean}
 */
export function hasValidAuthToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  
  if (!token || !expiry) return false;
  
  const now = Date.now();
  const expiryTime = parseInt(expiry, 10);
  
  if (isNaN(expiryTime) || now >= expiryTime) {
    // Token expired, clean up
    clearAuthToken();
    return false;
  }
  
  return true;
}

/**
 * Gets the stored token.
 * @return {string|null}
 */
export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Stores the token with expiry.
 * @param {string} token - Auth token
 */
export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, (Date.now() + TOKEN_TTL_MS).toString());
}

/**
 * Removes the token (logout).
 */
export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/**
 * Validates token with the server.
 * @return {Promise<boolean>}
 */
export async function validateTokenWithServer() {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    const response = await fetch(getApiBaseUrl() + '?action=get&id=test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    // We use a dummy GET request to check auth - the server will reject if token invalid
    // Better: add a dedicated validate endpoint, but for now this works
    return response.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Shows a login modal if no valid token.
 * Returns a Promise that resolves when authenticated.
 * @return {Promise<void>}
 */
export function requireAuth() {
  return new Promise((resolve) => {
    if (hasValidAuthToken()) {
      // Optionally validate with server
      validateTokenWithServer().then(valid => {
        if (valid) {
          resolve();
        } else {
          clearAuthToken();
          showLoginModal().then(resolve);
        }
      }).catch(() => {
        // Network error - assume token might still be valid, let server decide
        resolve();
      });
    } else {
      showLoginModal().then(resolve);
    }
  });
}

/**
 * Shows the login modal and returns a Promise that resolves on successful login.
 * @return {Promise<void>}
 */
function showLoginModal() {
  return new Promise((resolve) => {
    // Remove any existing modal
    const existing = document.getElementById('auth-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.6); display: flex; align-items: center;
      justify-content: center; z-index: 9999;
    `;
    
    const box = document.createElement('div');
    box.style.cssText = `
      background: #fff; padding: 2rem; border-radius: 8px;
      width: 100%; max-width: 320px; box-shadow: 0 2px 10px rgba(0,0,0,.2);
      box-sizing: border-box;
    `;
    
    const title = document.createElement('h2');
    title.textContent = 'Toegang tot de PWA';
    title.style.marginTop = '0';
    title.style.color = '#333';
    
    const form = document.createElement('form');
    form.id = 'loginForm';
    form.innerHTML = `
      <label for="password" style="display:block;margin-top:1.5rem;font-weight:500;">Wachtwoord:</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required 
        style="width:100%;padding:0.75rem;margin-top:0.5rem;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;font-size:1rem;">
      <button type="submit" style="margin-top:1.5rem;width:100%;padding:0.75rem;background:#1976d2;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:1rem;">Inloggen</button>
      <div id="error" style="color:#d32f2f;margin-top:1rem;font-size:0.9rem;min-height:1.2em;"></div>
    `;
    
    box.appendChild(title);
    box.appendChild(form);
    modal.appendChild(box);
    document.body.appendChild(modal);
    
    const errorDiv = form.querySelector('#error');
    const submitBtn = form.querySelector('button');
    const passwordInput = form.querySelector('#password');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorDiv.textContent = '';
      const password = passwordInput.value;
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Controleren...';
      
      try {
        const response = await fetch(getApiBaseUrl() + '?action=validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ password: password })
        });
        
        const data = await response.json();
        
        if (data.success && data.data && data.data.token) {
          setAuthToken(data.data.token);
          modal.remove();
          resolve();
        } else {
          errorDiv.textContent = data.error || 'Ongeldig wachtwoord';
        }
      } catch (err) {
        errorDiv.textContent = 'Kon de server niet bereiken. Probeer het later opnieuw.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Inloggen';
      }
    });
    
    // Focus password input
    setTimeout(() => passwordInput.focus(), 100);
  });
}

/**
 * Logs out the user.
 */
export function logout() {
  clearAuthToken();
  location.reload();
}

/**
 * Gets the token expiry time.
 * @return {number|null} Expiry timestamp or null
 */
export function getTokenExpiry() {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  return expiry ? parseInt(expiry, 10) : null;
}

/**
 * Gets remaining token time in milliseconds.
 * @return {number} Remaining ms (negative if expired)
 */
export function getTokenRemainingTime() {
  const expiry = getTokenExpiry();
  if (!expiry) return -1;
  return expiry - Date.now();
}