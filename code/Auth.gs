// Auth.gs - Authentication and authorization

/**
 * Hashes a password with salt using PBKDF2-like approach
 * @param {string} password - Plaintext password
 * @param {string} salt - Salt (hex string), generates new if not provided
 * @return {Object} {hash: string, salt: string}
 */
function hashPassword(password, salt = null) {
  if (!salt) {
    // Generate random salt (16 bytes = 32 hex chars)
    const bytes = Utilities.newBlob(Utilities.getUuid()).getBytes();
    salt = bytes.slice(0, 16).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  }
  
  // Use SHA-256 with salt (Apps Script doesn't have PBKDF2, so we iterate)
  let hash = salt + password;
  for (let i = 0; i < 10000; i++) {
    hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, hash)
      .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2))
      .join('');
  }
  
  return { hash, salt };
}

/**
 * Verifies a password against stored hash and salt
 * @param {string} password - Plaintext password to verify
 * @param {string} storedHash - Stored hash (hex)
 * @param {string} storedSalt - Stored salt (hex)
 * @return {boolean} True if password matches
 */
function verifyPassword(password, storedHash, storedSalt) {
  if (!storedHash || !storedSalt) return false;
  const { hash } = hashPassword(password, storedSalt);
  return hash === storedHash;
}

/**
 * Sets the login password (hashes and stores)
 * @param {string} password - Plaintext password
 */
function setLoginPassword(password) {
  if (typeof password !== 'string' || password.trim() === '') {
    throw new Error('Password must be a non-empty string');
  }
  
  const { hash, salt } = hashPassword(password.trim());
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROP.LOGIN_PASSWORD_HASH, hash);
  props.setProperty(PROP.LOGIN_PASSWORD_SALT, salt);
}

/**
 * Gets the stored password hash
 * @return {string|null} Hash or null if not set
 */
function getLoginPasswordHash() {
  return PropertiesService.getScriptProperties().getProperty(PROP.LOGIN_PASSWORD_HASH);
}

/**
 * Gets the stored password salt
 * @return {string|null} Salt or null if not set
 */
function getLoginPasswordSalt() {
  return PropertiesService.getScriptProperties().getProperty(PROP.LOGIN_PASSWORD_SALT);
}

/**
 * Checks if login password is configured
 * @return {boolean}
 */
function isLoginPasswordSet() {
  return !!getLoginPasswordHash();
}

/**
 * Validates login password and returns token if valid
 * @param {string} password - Plaintext password
 * @return {Object} {success: boolean, token?: string, error?: string}
 */
function validateLogin(password) {
  if (!isLoginPasswordSet()) {
    return { 
      success: false, 
      error: 'Login password not configured. Please run setLoginPassword() in the script editor.' 
    };
  }
  
  const storedHash = getLoginPasswordHash();
  const storedSalt = getLoginPasswordSalt();
  
  if (verifyPassword(password.trim(), storedHash, storedSalt)) {
    const token = createToken();
    storeToken(token);
    return { success: true, token };
  } else {
    return { success: false, error: 'Ongeldig wachtwoord' };
  }
}

/**
 * Creates a random UUID token
 * @return {string} Token
 */
function createToken() {
  return Utilities.getUuid();
}

/**
 * Stores a token with timestamp in Script Properties
 * @param {string} token - Token to store
 */
function storeToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: must be a non-empty string');
  }
  PropertiesService.getScriptProperties()
    .setProperty(AUTH_TOKEN_PREFIX + token, Date.now().toString());
}

/**
 * Checks if a token exists and is valid (not expired)
 * @param {string} token - Token to validate
 * @return {boolean}
 */
function isValidToken(token) {
  const key = AUTH_TOKEN_PREFIX + token;
  const ts = PropertiesService.getScriptProperties().getProperty(key);
  if (!ts) return false;
  
  const valid = (Date.now() - parseInt(ts, 10)) < TOKEN_TTL_MS;
  if (!valid) {
    PropertiesService.getScriptProperties().deleteProperty(key);
  }
  return valid;
}

/**
 * Removes a token (logout)
 * @param {string} token - Token to remove
 */
function removeToken(token) {
  if (!token || typeof token !== 'string') return;
  PropertiesService.getScriptProperties()
    .deleteProperty(AUTH_TOKEN_PREFIX + token);
}

/**
 * Extracts token from request (query param or cookie)
 * @param {Object} e - Event parameter
 * @return {string|null} Token or null
 */
function getAuthTokenFromRequest(e) {
  if (!e) return null;
  
  // Check query parameter first (for cross-origin requests)
  if (e.parameter && e.parameter.token) {
    return decodeURIComponent(e.parameter.token);
  }
  
  // Check cookie (for same-origin)
  if (e.cookie) {
    const match = e.cookie.match(/(?:^|;\s*)pwa_auth=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
  
  return null;
}

/**
 * Checks if request is authenticated
 * @param {Object} e - Event parameter
 * @return {boolean}
 */
function checkAuth(e) {
  const token = getAuthTokenFromRequest(e);
  if (!token) return false;
  return isValidToken(token);
}

/**
 * Gets the user role from request (based on email)
 * @param {Object} e - Event parameter
 * @return {string} 'worker' | 'staff' | 'unknown'
 */
function getUserRole(e) {
  // In Apps Script web app deployed as "Execute as: Me", 
  // we can't get the user's email directly from the request.
  // We use token-based auth instead, and could store role with token.
  // For now, all authenticated users are workers (can read/update).
  // Staff only need to create tasks, which doesn't require special role.
  return 'worker'; // Default - could be enhanced with role in token
}

/**
 * Checks if user has worker role (can read/update tasks)
 * @param {Object} e - Event parameter
 * @return {boolean}
 */
function isWorker(e) {
  // For MVP, all authenticated users can be workers
  // In future, check against maintenance worker email list
  return checkAuth(e);
}

/**
 * Checks if user can create tasks (staff or worker)
 * @param {Object} e - Event parameter
 * @return {boolean}
 */
function canCreateTask(e) {
  // Both staff and workers can create tasks
  return checkAuth(e);
}

/**
 * Returns unauthorized error response
 * @return {ContentService.TextOutput}
 */
function authErrorResponse() {
  return errorResponse(ERROR_CODES.AUTH_REQUIRED, 'Authentication required');
}

/**
 * Returns forbidden error response
 * @return {ContentService.TextOutput}
 */
function forbiddenResponse() {
  return errorResponse(ERROR_CODES.FORBIDDEN, 'Insufficient permissions');
}

/**
 * Returns the login page with CORS headers
 * @return {HtmlService.HtmlOutput}
 */
function getLoginPage() {
  const frontendUrl = getFrontendUrl();
  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PWA Login</title>
  <style>
    body {font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f5f5f5; margin:0; padding:0; display:flex; height:100vh; align-items:center; justify-content:center;}
    .card {background:#fff; padding:2rem; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,.1); width:100%; max-width:320px; box-sizing:border-box;}
    h2 {margin-top:0; color:#333;}
    label {display:block; margin-top:1.5rem; font-weight:500;}
    input {width:100%; padding:0.75rem; margin-top:0.5rem; border:1px solid #ddd; border-radius:4px; box-sizing:border-box; font-size:1rem;}
    button {margin-top:1.5rem; width:100%; padding:0.75rem; background:#1976d2; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:1rem;}
    button:hover {background:#1565c0;}
    .error {color:#d32f2f; margin-top:1rem; font-size:0.9rem; min-height:1.2em;}
    .info {color:#666; font-size:0.85rem; margin-top:1.5rem; text-align:center;}
  </style>
</head>
<body>
  <div class="card">
    <h2>Toegang tot de PWA</h2>
    <form id="loginForm">
      <label for="password">Wachtwoord:</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required>
      <button type="submit">Inloggen</button>
      <div id="error" class="error"></div>
    </form>
    <div class="info">School Maintenance Reporter</div>
  </div>
  <script>
    (function() {
      const form = document.getElementById('loginForm');
      const errorDiv = document.getElementById('error');
      
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        errorDiv.textContent = '';
        const password = document.getElementById('password').value;
        const submitBtn = form.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Controleren...';
        
        try {
          const resp = await fetch(window.location.href + '?action=validate', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({password: password})
          });
          const data = await resp.json();
          
          if (data.success) {
            // Store token in localStorage and redirect
            localStorage.setItem('pwa_auth_token', data.token);
            localStorage.setItem('pwa_token_expiry', Date.now() + 15 * 60 * 1000);
            window.location.href = '${frontendUrl}';
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
    })();
  </script>
</body>
</html>`;
  
  return addCorsHeadersHtml(HtmlService.createHtmlOutput(html));
}
