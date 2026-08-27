// Maintenance PWA - consolidated Google Apps Script backend
// Sections are ordered by responsibility; Apps Script exposes all functions globally.

// =========================================================================
// Source: code/Config.gs
// =========================================================================


// ====================== Spreadsheet Configuration ======================
const TARGET_SPREADSHEET_ID = '1HtYJqAWengq_wvEbt2SE_Rx4cPwSyal5YwHbp_Z0wVY';
const SHEET_NAME_PATTERN = /^klusjes \d{8}$/; // Matches klusjes DDMMYYYY

// Column indices (0-based) - matches Dutch column order
const COL = {
  DESCRIPTION: 0,           // Omschrijving
  REQUESTER_NAME: 1,        // naam aanvrager
  LOCATION: 2,              // Welke klas? Welk lokaal?
  REQUIRED_MATERIALS: 3,    // Benodigd materiaal
  URGENCY: 4,               // prioriteit
  STATUS: 5,                // opvolging
  PHOTO_URLS: 6,            // photo_urls (JSON array string)
  MAINTENANCE_NOTES: 7,     // Opmerkingen
  CREATED_AT: 8,            // datum gemaakt
  UPDATED_AT: 9,            // datum update
  COMPLETED_AT: 10,         // datum opgelost
  TASK_ID: 11               // task_id (UUID)
};

// Headers for new sheets (Dutch)
const SHEET_HEADERS = [
  'Omschrijving',
  'naam aanvrager',
  'Welke klas? Welk lokaal?',
  'Benodigd materiaal',
  'prioriteit',
  'opvolging',
  'photo_urls',
  'Opmerkingen',
  'datum gemaakt',
  'datum update',
  'datum opgelost',
  'task_id'
];

// ====================== Drive Configuration ======================
const DRIVE_ROOT_FOLDER_NAME = 'Maintenance PWA';

// ====================== Property Keys ======================
const PROP = {
  MAINTENANCE_WORKER_EMAIL: 'maintenance_worker_email',
  LOGIN_PASSWORD_HASH: 'login_password_hash',
  LOGIN_PASSWORD_SALT: 'login_password_salt',
  FRONTEND_URL: 'frontend_url',
  PHOTO_FOLDER_ID_PREFIX: 'photo_folder_id_', // + year
  ACTIVE_SHEET_NAME: 'active_sheet_name'
};

// ====================== Authentication ======================
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_TOKEN_PREFIX = 'auth_token_';

// ONE-TIME SETUP: Enter your desired password here.
// Once the app is deployed and you've logged in once,
// you can remove this or leave it as a fallback.
const DEFAULT_PASSWORD = 'CHANGE_THIS_PASSWORD';

// ====================== Validation Constants ======================
const VALID_URGENCIES = ['Normal', 'Important', 'Urgent'];
const VALID_STATUSES = ['New', 'Planned', 'In progress', 'Waiting for materials', 'Completed'];

// Dutch mappings (for sheet storage)
const URGENCY_TO_DUTCH = {
  'Normal': 'niet zo dringend',
  'Important': 'dringend',
  'Urgent': 'zeer dringend'
};

const DUTCH_TO_URGENCY = {
  'niet zo dringend': 'Normal',
  'dringend': 'Important',
  'zeer dringend': 'Urgent'
};

const STATUS_TO_DUTCH = {
  'New': '',
  'Planned': 'overnemen op volgend lijstje',
  'In progress': 'niet voldoende gebeurd',
  'Waiting for materials': 'wachten op materialen',
  'Completed': 'In orde'
};

const DUTCH_TO_STATUS = {
  'In orde': 'Completed',
  'overnemen op volgend lijstje': 'Planned',
  'niet voldoende gebeurd': 'In progress',
  'bezig of in pauze; met extern bedrijf of MAARTEN': 'In progress',
  'wachten op materialen': 'Waiting for materials',
  '': 'New'
};

// Valid state transitions (from -> allowed next states)
const VALID_TRANSITIONS = {
  'New': ['Planned', 'In progress', 'Completed'],
  'Planned': ['In progress', 'Waiting for materials', 'New'],
  'In progress': ['Waiting for materials', 'Completed', 'Planned'],
  'Waiting for materials': ['In progress', 'Planned'],
  'Completed': ['In progress'] // Reopen goes to In progress
};

// ====================== Limits ======================
const LIMITS = {
  MAX_PHOTOS_PER_TASK: 3,
  MAX_PHOTO_SIZE_MB: 5,
  MAX_PHOTO_DIMENSION: 1600,
  JPEG_QUALITY: 0.75,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_REQUESTER_NAME_LENGTH: 100,
  MAX_LOCATION_LENGTH: 200,
  MAX_MATERIALS_LENGTH: 500,
  MAX_NOTES_LENGTH: 2000
};

// ====================== Error Codes ======================
const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  PHOTO_TOO_LARGE: 'PHOTO_TOO_LARGE',
  PHOTO_INVALID: 'PHOTO_INVALID',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_TRANSITION: 'INVALID_TRANSITION'
};

// =========================================================================
// Source: code/Response.gs
// =========================================================================


/**
 * Creates a successful response with CORS headers
 * @param {Object} data - Response data
 * @return {ContentService.TextOutput} JSON response
 */
function successResponse(data) {
  return addCorsHeaders(
    ContentService
      .createTextOutput(JSON.stringify({ success: true, data: data }))
      .setMimeType(ContentService.MimeType.JSON)
  );
}

/**
 * Creates an error response with CORS headers
 * @param {string} code - Error code from ERROR_CODES
 * @param {string} message - Human-readable error message
 * @param {number} httpStatus - HTTP status code (default 400)
 * @return {ContentService.TextOutput} JSON response
 */
function errorResponse(code, message, httpStatus = 400) {
  const output = ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      code: code,
      error: message
    }))
    .setMimeType(ContentService.MimeType.JSON);

  // Note: Apps Script Web Apps don't support setting HTTP status codes directly
  // The status will always be 200, but we include the code in the response body
  return addCorsHeaders(output);
}

/**
 * Adds CORS headers to a ContentService output
 * @param {ContentService.TextOutput} output
 * @return {ContentService.TextOutput}
 */
function addCorsHeaders(output) {
  try {
    if (output && typeof output.setHeader === 'function') {
      const origin = getFrontendOrigin();
      output.setHeader('Access-Control-Allow-Origin', origin);
      output.setHeader('Access-Control-Allow-Credentials', 'true');
      output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
  } catch (e) {
    // Silently fail - CORS headers are best effort
  }
  return output;
}

/**
 * Adds CORS headers to an HtmlService output (for login page)
 * @param {HtmlService.HtmlOutput} output
 * @return {HtmlService.HtmlOutput}
 */
function addCorsHeadersHtml(output) {
  try {
    if (output && typeof output.setHeader === 'function') {
      const origin = getFrontendOrigin();
      output.setHeader('Access-Control-Allow-Origin', origin);
      output.setHeader('Access-Control-Allow-Credentials', 'true');
      output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  } catch (e) {
    // Silently fail
  }
  return output;
}

/**
 * Gets the frontend origin for CORS
 * @return {string} Origin or * as fallback
 */
function getFrontendOrigin() {
  const frontendUrl = PropertiesService.getScriptProperties().getProperty(PROP.FRONTEND_URL) || '';
  try {
    const url = new URL(frontendUrl);
    return url.origin;
  } catch (_) {
    return '*'; // Fallback - less secure but functional
  }
}

// =========================================================================
// Source: code/Auth.gs
// =========================================================================


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
  const hasStored = !!getLoginPasswordHash();
  const hasDefault = typeof DEFAULT_PASSWORD !== 'undefined' && DEFAULT_PASSWORD !== '' && DEFAULT_PASSWORD !== 'CHANGE_THIS_PASSWORD';
  return hasStored || hasDefault;
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
      error: 'Login password not configured. Please set DEFAULT_PASSWORD in Config.gs.'
    };
  }

  const storedHash = getLoginPasswordHash();
  const storedSalt = getLoginPasswordSalt();

  // Try stored hash first
  if (storedHash && storedSalt) {
    if (verifyPassword(password.trim(), storedHash, storedSalt)) {
      const token = createToken();
      storeToken(token);
      return { success: true, token };
    }
  }

  // Fallback to DEFAULT_PASSWORD from Config.gs if not hashed yet
  if (typeof DEFAULT_PASSWORD !== 'undefined' && DEFAULT_PASSWORD !== '' && DEFAULT_PASSWORD !== 'CHANGE_THIS_PASSWORD') {
    if (password.trim() === DEFAULT_PASSWORD.trim()) {
      // Auto-hash for next time if possible
      try {
        setLoginPassword(password.trim());
      } catch (e) {
        // PropertiesService might be restricted, but we still allow login
      }
      const token = createToken();
      storeToken(token);
      return { success: true, token };
    }
  }

  return { success: false, error: 'Ongeldig wachtwoord' };
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

// =========================================================================
// Source: code/Validation.gs
// =========================================================================


/**
 * Validates task creation input
 * @param {Object} input - Raw input from request
 * @return {Object} {valid: boolean, errors: string[], sanitized: Object}
 */
function validateTaskCreate(input) {
  const errors = [];
  const sanitized = {};

  // Description (required)
  if (!input.description || typeof input.description !== 'string') {
    errors.push('Description is required');
  } else {
    const desc = input.description.trim();
    if (desc.length === 0) {
      errors.push('Description cannot be empty');
    } else if (desc.length > LIMITS.MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description too long (max ${LIMITS.MAX_DESCRIPTION_LENGTH} characters)`);
    } else {
      sanitized.description = desc;
    }
  }

  // Requester name (required)
  if (!input.requester_name || typeof input.requester_name !== 'string') {
    errors.push('Requester name is required');
  } else {
    const name = input.requester_name.trim();
    if (name.length === 0) {
      errors.push('Requester name cannot be empty');
    } else if (name.length > LIMITS.MAX_REQUESTER_NAME_LENGTH) {
      errors.push(`Requester name too long (max ${LIMITS.MAX_REQUESTER_NAME_LENGTH} characters)`);
    } else {
      sanitized.requester_name = name;
    }
  }

  // Location (required)
  if (!input.location || typeof input.location !== 'string') {
    errors.push('Location is required');
  } else {
    const loc = input.location.trim();
    if (loc.length === 0) {
      errors.push('Location cannot be empty');
    } else if (loc.length > LIMITS.MAX_LOCATION_LENGTH) {
      errors.push(`Location too long (max ${LIMITS.MAX_LOCATION_LENGTH} characters)`);
    } else {
      sanitized.location = loc;
    }
  }

  // Required materials (optional)
  if (input.required_materials !== undefined) {
    if (typeof input.required_materials === 'string') {
      const materials = input.required_materials.trim();
      if (materials.length > LIMITS.MAX_MATERIALS_LENGTH) {
        errors.push(`Required materials too long (max ${LIMITS.MAX_MATERIALS_LENGTH} characters)`);
      } else {
        sanitized.required_materials = materials;
      }
    } else {
      sanitized.required_materials = '';
    }
  } else {
    sanitized.required_materials = '';
  }

  // Urgency (optional, defaults to Normal)
  if (input.urgency !== undefined) {
    if (!VALID_URGENCIES.includes(input.urgency)) {
      errors.push(`Invalid urgency. Allowed: ${VALID_URGENCIES.join(', ')}`);
    } else {
      sanitized.urgency = input.urgency;
    }
  } else {
    sanitized.urgency = 'Normal';
  }

  // Status (optional, defaults to New - server enforces)
  sanitized.status = 'New'; // Always set by server for new tasks

  // Photos (optional, validated separately)
  if (input.photos !== undefined) {
    if (!Array.isArray(input.photos)) {
      errors.push('Photos must be an array');
    } else if (input.photos.length > LIMITS.MAX_PHOTOS_PER_TASK) {
      errors.push(`Too many photos (max ${LIMITS.MAX_PHOTOS_PER_TASK})`);
    } else {
      sanitized.photos = input.photos; // Will be validated in photo handler
    }
  } else {
    sanitized.photos = [];
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    sanitized: sanitized
  };
}

/**
 * Validates task update input
 * @param {Object} input - Raw input from request
 * @param {Object} existingTask - Current task data (for transition validation)
 * @return {Object} {valid: boolean, errors: string[], sanitized: Object}
 */
function validateTaskUpdate(input, existingTask) {
  const errors = [];
  const sanitized = {};

  // Description (optional)
  if (input.description !== undefined) {
    if (typeof input.description !== 'string') {
      errors.push('Description must be a string');
    } else {
      const desc = input.description.trim();
      if (desc.length === 0) {
        errors.push('Description cannot be empty');
      } else if (desc.length > LIMITS.MAX_DESCRIPTION_LENGTH) {
        errors.push(`Description too long (max ${LIMITS.MAX_DESCRIPTION_LENGTH} characters)`);
      } else {
        sanitized.description = desc;
      }
    }
  }

  // Requester name (optional)
  if (input.requester_name !== undefined) {
    if (typeof input.requester_name !== 'string') {
      errors.push('Requester name must be a string');
    } else {
      const name = input.requester_name.trim();
      if (name.length > LIMITS.MAX_REQUESTER_NAME_LENGTH) {
        errors.push(`Requester name too long (max ${LIMITS.MAX_REQUESTER_NAME_LENGTH} characters)`);
      } else {
        sanitized.requester_name = name;
      }
    }
  }

  // Location (optional)
  if (input.location !== undefined) {
    if (typeof input.location !== 'string') {
      errors.push('Location must be a string');
    } else {
      const loc = input.location.trim();
      if (loc.length > LIMITS.MAX_LOCATION_LENGTH) {
        errors.push(`Location too long (max ${LIMITS.MAX_LOCATION_LENGTH} characters)`);
      } else {
        sanitized.location = loc;
      }
    }
  }

  // Required materials (optional)
  if (input.required_materials !== undefined) {
    if (typeof input.required_materials === 'string') {
      const materials = input.required_materials.trim();
      if (materials.length > LIMITS.MAX_MATERIALS_LENGTH) {
        errors.push(`Required materials too long (max ${LIMITS.MAX_MATERIALS_LENGTH} characters)`);
      } else {
        sanitized.required_materials = materials;
      }
    } else {
      sanitized.required_materials = '';
    }
  }

  // Urgency (optional)
  if (input.urgency !== undefined) {
    if (!VALID_URGENCIES.includes(input.urgency)) {
      errors.push(`Invalid urgency. Allowed: ${VALID_URGENCIES.join(', ')}`);
    } else {
      sanitized.urgency = input.urgency;
    }
  }

  // Status (optional, but if provided must be valid transition)
  if (input.status !== undefined) {
    if (!VALID_STATUSES.includes(input.status)) {
      errors.push(`Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`);
    } else if (existingTask && existingTask.status) {
      const currentStatus = existingTask.status;
      const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
      if (!allowedNext.includes(input.status)) {
        errors.push(`Invalid status transition: ${currentStatus} → ${input.status}. Allowed: ${allowedNext.join(', ')}`);
      } else {
        sanitized.status = input.status;
      }
    } else {
      sanitized.status = input.status;
    }
  }

  // Maintenance notes (optional)
  if (input.maintenance_notes !== undefined) {
    if (typeof input.maintenance_notes === 'string') {
      const notes = input.maintenance_notes.trim();
      if (notes.length > LIMITS.MAX_NOTES_LENGTH) {
        errors.push(`Notes too long (max ${LIMITS.MAX_NOTES_LENGTH} characters)`);
      } else {
        sanitized.maintenance_notes = notes;
      }
    } else {
      sanitized.maintenance_notes = '';
    }
  }

  // Photos (optional, for adding new photos)
  if (input.photos !== undefined) {
    if (!Array.isArray(input.photos)) {
      errors.push('Photos must be an array');
    } else if (input.photos.length > LIMITS.MAX_PHOTOS_PER_TASK) {
      errors.push(`Too many photos (max ${LIMITS.MAX_PHOTOS_PER_TASK})`);
    } else {
      sanitized.photos = input.photos;
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    sanitized: sanitized
  };
}

/**
 * Validates a single photo object
 * @param {Object} photo - Photo object with base64, filename, mimeType
 * @return {Object} {valid: boolean, error: string|null}
 */
function validatePhoto(photo) {
  if (!photo || typeof photo !== 'object') {
    return { valid: false, error: 'Photo must be an object' };
  }

  // Check required fields
  if (!photo.base64 || typeof photo.base64 !== 'string') {
    return { valid: false, error: 'Photo missing base64 data' };
  }

  if (!photo.filename || typeof photo.filename !== 'string') {
    return { valid: false, error: 'Photo missing filename' };
  }

  if (!photo.mimeType || typeof photo.mimeType !== 'string') {
    return { valid: false, error: 'Photo missing mimeType' };
  }

  // Validate MIME type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(photo.mimeType)) {
    return { valid: false, error: `Invalid image type: ${photo.mimeType}. Allowed: ${allowedTypes.join(', ')}` };
  }

  // Estimate size from base64 (base64 is ~33% larger than binary)
  const base64Length = photo.base64.length;
  const estimatedBytes = Math.round(base64Length * 0.75);
  const maxBytes = LIMITS.MAX_PHOTO_SIZE_MB * 1024 * 1024;

  if (estimatedBytes > maxBytes) {
    return { valid: false, error: `Photo too large: ${Math.round(estimatedBytes / 1024)}KB (max ${LIMITS.MAX_PHOTO_SIZE_MB}MB)` };
  }

  // Validate base64 format
  try {
    Utilities.base64Decode(photo.base64);
  } catch (e) {
    return { valid: false, error: 'Invalid base64 encoding' };
  }

  return { valid: true, error: null };
}

/**
 * Sanitizes a string for safe storage (removes control characters)
 * @param {string} str - Input string
 * @return {string} Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  // Remove control characters except newlines and tabs
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Validates task ID format (UUID)
 * @param {string} taskId - Task ID to validate
 * @return {boolean}
 */
function isValidTaskId(taskId) {
  if (!taskId || typeof taskId !== 'string') return false;
  // UUID v4 regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(taskId);
}

// =========================================================================
// Source: code/Photos.gs
// =========================================================================


/**
 * Gets the photo folder for a specific year, creating if needed
 * @param {number} year - Year (e.g., 2026)
 * @return {GoogleAppsScript.Drive.Folder} The photo folder
 */
function getPhotoFolderForYear(year) {
  const folderName = year.toString();
  const props = PropertiesService.getScriptProperties();
  const propKey = PROP.PHOTO_FOLDER_ID_PREFIX + year;

  // Check if we have a cached folder ID
  const folderId = props.getProperty(propKey);
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      // Folder was deleted, will create new one
    }
  }

  // Get or create root folder
  const rootFolder = getOrCreateRootFolder();

  // Find or create year folder
  const yearFolders = rootFolder.getFoldersByName(folderName);
  let yearFolder;
  if (yearFolders.hasNext()) {
    yearFolder = yearFolders.next();
  } else {
    yearFolder = rootFolder.createFolder(folderName);
  }

  // Cache the folder ID
  props.setProperty(propKey, yearFolder.getId());
  return yearFolder;
}

/**
 * Gets or creates the root "Maintenance PWA" folder
 * @return {GoogleAppsScript.Drive.Folder}
 */
function getOrCreateRootFolder() {
  const props = PropertiesService.getScriptProperties();
  const rootFolderId = props.getProperty('photo_root_folder_id');

  if (rootFolderId) {
    try {
      return DriveApp.getFolderById(rootFolderId);
    } catch (e) {
      // Folder deleted, will create new
    }
  }

  // Find existing root folder
  const folders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
  let rootFolder;
  if (folders.hasNext()) {
    rootFolder = folders.next();
  } else {
    rootFolder = DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
  }

  props.setProperty('photo_root_folder_id', rootFolder.getId());
  return rootFolder;
}

/**
 * Uploads photos to Google Drive and returns structured metadata
 * @param {Array<Object>} photos - Array of {base64, filename, mimeType}
 * @param {string} taskId - Task UUID
 * @return {Array<Object>} Array of {url, filename, id, mimeType}
 */
function uploadPhotos(photos, taskId) {
  const year = new Date().getFullYear();
  const yearFolder = getPhotoFolderForYear(year);

  // Create task-specific subfolder
  const taskFolderName = 'task-' + taskId;
  const taskFolders = yearFolder.getFoldersByName(taskFolderName);
  let taskFolder;
  if (taskFolders.hasNext()) {
    taskFolder = taskFolders.next();
  } else {
    taskFolder = yearFolder.createFolder(taskFolderName);
  }

  const results = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];

    // Validate photo
    const validation = validatePhoto(photo);
    if (!validation.valid) {
      throw new Error('Photo ' + (i + 1) + ': ' + validation.error);
    }

    try {
      // Decode base64
      const bytes = Utilities.base64Decode(photo.base64);

      // Create blob
      const blob = Utilities.newBlob(bytes, photo.mimeType, photo.filename);

      // Generate unique filename: {taskId}-{index}.{ext}
      const ext = photo.mimeType === 'image/png' ? 'png' :
                  photo.mimeType === 'image/webp' ? 'webp' : 'jpg';
      const uniqueFilename = taskId + '-' + (i + 1) + '.' + ext;

      // Upload to task folder
      const file = taskFolder.createFile(blob);
      file.setName(uniqueFilename);

      // Get shareable URL (viewable by anyone with link)
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const fileUrl = file.getUrl();

      results.push({
        url: fileUrl,
        filename: uniqueFilename,
        id: file.getId(),
        mimeType: photo.mimeType,
        originalName: photo.filename
      });

    } catch (e) {
      throw new Error('Failed to upload photo ' + (i + 1) + ': ' + e.message);
    }
  }

  return results;
}

/**
 * Deletes photos for a task (cleanup)
 * @param {string} taskId - Task UUID
 * @param {number} year - Year (optional, searches all if not provided)
 */
function deleteTaskPhotos(taskId, year = null) {
  try {
    if (year) {
      const yearFolder = getPhotoFolderForYear(year);
      const taskFolders = yearFolder.getFoldersByName('task-' + taskId);
      while (taskFolders.hasNext()) {
        taskFolders.next().setTrashed(true);
      }
    } else {
      // Search all year folders (less efficient)
      const rootFolder = getOrCreateRootFolder();
      const yearFolders = rootFolder.getFolders();
      while (yearFolders.hasNext()) {
        const yf = yearFolders.next();
        const taskFolders = yf.getFoldersByName('task-' + taskId);
        while (taskFolders.hasNext()) {
          taskFolders.next().setTrashed(true);
        }
      }
    }
  } catch (e) {
    // Log but don't throw - cleanup is best effort
    console.error('Error deleting task photos:', e);
  }
}

/**
 * Gets photo URLs for a task from Drive (reconstructs from folder structure)
 * @param {string} taskId - Task UUID
 * @param {number} year - Year to search
 * @return {Array<Object>} Array of photo metadata
 */
function getTaskPhotosFromDrive(taskId, year) {
  const results = [];

  try {
    const yearFolder = getPhotoFolderForYear(year);
    const taskFolders = yearFolder.getFoldersByName('task-' + taskId);

    if (taskFolders.hasNext()) {
      const taskFolder = taskFolders.next();
      const files = taskFolder.getFiles();

      while (files.hasNext()) {
        const file = files.next();
        // Ensure sharing is set
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        results.push({
          url: file.getUrl(),
          filename: file.getName(),
          id: file.getId(),
          mimeType: file.getMimeType()
        });
      }

      // Sort by filename to maintain order
      results.sort((a, b) => a.filename.localeCompare(b.filename));
    }
  } catch (e) {
    // Folder doesn't exist or other error
    console.error('Error getting task photos:', e);
  }

  return results;
}

/**
 * Parses photo URLs from sheet (handles both old comma-separated and new JSON format)
 * @param {string} photoUrlsString - String from sheet
 * @return {Array<Object>} Array of photo objects
 */
function parsePhotoUrls(photoUrlsString) {
  if (!photoUrlsString) return [];

  const str = String(photoUrlsString).trim();
  if (!str) return [];

  // Try parsing as JSON first (new format)
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) {
      return parsed.map(p => ({
        url: p.url || p,
        filename: p.filename || '',
        id: p.id || '',
        mimeType: p.mimeType || ''
      }));
    }
  } catch (e) {
    // Not JSON, fall through to comma-separated parsing
  }

  // Old format: comma-separated URLs
  return str.split(',')
    .map(url => url.trim())
    .filter(url => url.length > 0)
    .map(url => ({ url, filename: '', id: '', mimeType: '' }));
}

/**
 * Serializes photos array to JSON string for sheet storage
 * @param {Array<Object>} photos - Array of photo objects
 * @return {string} JSON string
 */
function serializePhotos(photos) {
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    return '[]';
  }
  return JSON.stringify(photos.map(p => ({
    url: p.url,
    filename: p.filename || '',
    id: p.id || '',
    mimeType: p.mimeType || ''
  })));
}

// =========================================================================
// Source: code/Tasks.gs
// =========================================================================


/**
 * Gets the active sheet (most recent klusjes DDMMYYYY)
 * Creates new sheet for today if none exists
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getActiveSheet() {
  const ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const sheets = ss.getSheets();
  let activeSheet = null;
  let latestDate = null;

  for (const sheet of sheets) {
    const name = sheet.getName();
    if (SHEET_NAME_PATTERN.test(name)) {
      const dateStr = name.substring(8); // after 'klusjes '
      const day = parseInt(dateStr.substring(0, 2), 10);
      const month = parseInt(dateStr.substring(2, 4), 10);
      const year = parseInt(dateStr.substring(4, 8), 10);
      const date = new Date(year, month - 1, day); // month is 0-indexed

      if (!latestDate || date > latestDate) {
        latestDate = date;
        activeSheet = sheet;
      }
    }
  }

  if (!activeSheet) {
    // No matching sheet - create one for today
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const sheetName = `klusjes ${day}${month}${year}`;
    activeSheet = ss.insertSheet(sheetName);
    activeSheet.appendRow(SHEET_HEADERS);

    // Cache active sheet name
    PropertiesService.getScriptProperties().setProperty(PROP.ACTIVE_SHEET_NAME, sheetName);
  }

  return activeSheet;
}

/**
 * Creates a new quarter sheet and copies unfinished tasks
 * @return {Object} Result info
 */
function createNewQuarterSheet() {
  const ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const sheetName = `klusjes ${day}${month}${year}`;

  // Check if sheet already exists
  const existing = ss.getSheetByName(sheetName);
  if (existing) {
    return { success: false, error: 'Sheet already exists: ' + sheetName };
  }

  // Get current active sheet
  const currentSheet = getActiveSheet();
  if (currentSheet.getName() === sheetName) {
    return { success: false, error: 'Already on the latest sheet' };
  }

  // Create new sheet with headers
  const newSheet = ss.insertSheet(sheetName);
  newSheet.appendRow(SHEET_HEADERS);

  // Copy formatting from current sheet
  try {
    copySheetFormatting(currentSheet, newSheet);
  } catch (e) {
    console.warn('Could not copy formatting:', e);
  }

  // Get unfinished tasks from current sheet
  const data = currentSheet.getDataRange().getValues();
  const headers = data[0];

  // Map headers to indices
  const headerIndices = {};
  headers.forEach((header, index) => {
    headerIndices[header] = index;
  });

  const taskIdCol = headerIndices['task_id'] || COL.TASK_ID;
  const statusCol = headerIndices['opvolging'] || COL.STATUS;

  const unfinishedTasks = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusCol] || '';
    const mappedStatus = DUTCH_TO_STATUS[status.trim()] || 'New';

    // Copy if not completed
    if (mappedStatus !== 'Completed') {
      unfinishedTasks.push(row);
    }
  }

  // Append unfinished tasks to new sheet
  if (unfinishedTasks.length > 0) {
    newSheet.getRange(2, 1, unfinishedTasks.length, unfinishedTasks[0].length)
      .setValues(unfinishedTasks);
  }

  // Update active sheet cache
  PropertiesService.getScriptProperties().setProperty(PROP.ACTIVE_SHEET_NAME, sheetName);

  return {
    success: true,
    sheetName: sheetName,
    tasksCopied: unfinishedTasks.length
  };
}

/**
 * Copies formatting from source sheet to target sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sourceSheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} targetSheet
 */
function copySheetFormatting(sourceSheet, targetSheet) {
  const sourceRange = sourceSheet.getDataRange();
  const numRows = sourceRange.getNumRows();
  const numCols = sourceRange.getNumColumns();

  if (numRows === 0 || numCols === 0) return;

  // 1. Copy column widths
  for (let col = 1; col <= numCols; col++) {
    const width = sourceSheet.getColumnWidth(col);
    if (width > 0) {
      targetSheet.setColumnWidth(col, width);
    }
  }

  // 2. Copy frozen rows
  const frozenRows = sourceSheet.getFrozenRows();
  if (frozenRows > 0) {
    targetSheet.setFrozenRows(frozenRows);
  }

  // 3. Copy data validation rules (dropdowns)
  const dataValidations = sourceRange.getDataValidations();
  if (dataValidations) {
    const targetRange = targetSheet.getRange(1, 1, numRows, numCols);
    targetRange.setDataValidations(dataValidations);
  }

  // 4. Copy conditional formatting rules
  const conditionalFormats = sourceSheet.getConditionalFormatRules();
  if (conditionalFormats && conditionalFormats.length > 0) {
    const targetConditionalFormats = [];
    for (const rule of conditionalFormats) {
      const ranges = rule.getRanges();
      const newRanges = [];
      for (const range of ranges) {
        const newRange = targetSheet.getRange(
          range.getRow(),
          range.getColumn(),
          range.getNumRows(),
          range.getNumColumns()
        );
        newRanges.push(newRange);
      }
      const newRule = rule.copy()
        .setRanges(newRanges)
        .build();
      targetConditionalFormats.push(newRule);
    }
    targetSheet.setConditionalFormatRules(targetConditionalFormats);
  }

  // 5. Copy cell formatting for header row and first data row
  const headerRow = sourceSheet.getRange(1, 1, 1, numCols);
  const targetHeaderRow = targetSheet.getRange(1, 1, 1, numCols);
  headerRow.copyTo(targetHeaderRow, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

  if (numRows > 1) {
    const firstDataRow = sourceSheet.getRange(2, 1, 1, numCols);
    const targetFirstDataRow = targetSheet.getRange(2, 1, 1, numCols);
    firstDataRow.copyTo(targetFirstDataRow, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }
}

/**
 * Creates a new task in the spreadsheet with LockService
 * @param {Object} taskData - Validated task data
 * @param {Array<Object>} photos - Array of photo metadata from uploadPhotos
 * @return {string} Task ID
 */
function createTask(taskData, photos = []) {
  const lock = LockService.getScriptLock();
  const lockAcquired = lock.tryLock(10000); // 10 second timeout

  if (!lockAcquired) {
    throw new Error('Could not acquire lock for task creation. Please try again.');
  }

  try {
    const sheet = getActiveSheet();
    const taskId = Utilities.getUuid();
    const now = new Date().toISOString();

    // Prepare photo URLs as JSON
    const photoUrlsJson = serializePhotos(photos);

    // Prepare row data (by column index)
    const row = [
      taskData.description || '',                                    // 0: Omschrijving
      taskData.requester_name || '',                                 // 1: naam aanvrager
      taskData.location || '',                                       // 2: Welke klas? Welk lokaal?
      taskData.required_materials || '',                             // 3: Benodigd materiaal
      URGENCY_TO_DUTCH[taskData.urgency] || 'niet zo dringend',     // 4: prioriteit
      STATUS_TO_DUTCH[taskData.status] || '',                        // 5: opvolging
      photoUrlsJson,                                                 // 6: photo_urls (JSON)
      taskData.maintenance_notes || '',                              // 7: Opmerkingen
      now,                                                           // 8: datum gemaakt
      now,                                                           // 9: datum update
      '',                                                            // 10: datum opgelost
      taskId                                                         // 11: task_id
    ];

    sheet.appendRow(row);

    // Return task with photos for response
    return taskId;

  } finally {
    lock.releaseLock();
  }
}

/**
 * Gets a task by ID from the active sheet
 * @param {string} taskId - Task UUID
 * @return {Object|null} Task object or null if not found
 */
function getTaskById(taskId) {
  if (!isValidTaskId(taskId)) return null;

  const sheet = getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const headerIndices = {};
  headers.forEach((header, index) => {
    headerIndices[header] = index;
  });

  const taskIdCol = headerIndices['task_id'] || COL.TASK_ID;

  for (let i = 1; i < data.length; i++) {
    if (data[i][taskIdCol] === taskId) {
      return mapRowToTask(data[i], headerIndices);
    }
  }

  return null;
}

/**
 * Gets tasks with optional filtering, pagination
 * @param {Object} filters - Filter options
 * @param {number} limit - Max results
 * @param {number} offset - Pagination offset
 * @return {Array<Object>} Array of tasks
 */
function getTasks(filters = {}, limit = 50, offset = 0) {
  const sheet = getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const headerIndices = {};
  headers.forEach((header, index) => {
    headerIndices[header] = index;
  });

  const tasks = [];
  let skipped = 0;

  // Iterate backwards (newest first) for better UX
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const task = mapRowToTask(row, headerIndices);

    // Apply filters
    if (filters.status && task.status !== filters.status) continue;
    if (filters.urgency && task.urgency !== filters.urgency) continue;
    if (filters.location && !task.location.toLowerCase().includes(filters.location.toLowerCase())) continue;

    // Apply offset
    if (offset > 0 && skipped < offset) {
      skipped++;
      continue;
    }

    tasks.push(task);

    // Apply limit
    if (limit > 0 && tasks.length >= limit) break;
  }

  return tasks;
}

/**
 * Maps a sheet row to a task object (Dutch → English)
 * @param {Array} row - Sheet row data
 * @param {Object} headerIndices - Header name to column index mapping
 * @return {Object} Task object
 */
function mapRowToTask(row, headerIndices) {
  const getCol = (name, fallback) => row[headerIndices[name] || fallback] || '';

  const dutchStatus = getCol('opvolging', COL.STATUS);
  const dutchUrgency = getCol('prioriteit', COL.URGENCY);
  const photoUrlsStr = getCol('photo_urls', COL.PHOTO_URLS);

  return {
    id: getCol('task_id', COL.TASK_ID),
    description: getCol('Omschrijving', COL.DESCRIPTION),
    requester_name: getCol('naam aanvrager', COL.REQUESTER_NAME),
    location: getCol('Welke klas? Welk lokaal?', COL.LOCATION),
    required_materials: getCol('Benodigd materiaal', COL.REQUIRED_MATERIALS),
    urgency: DUTCH_TO_URGENCY[dutchUrgency] || 'Normal',
    status: DUTCH_TO_STATUS[dutchStatus] || 'New',
    photo_urls: parsePhotoUrls(photoUrlsStr),
    maintenance_notes: getCol('Opmerkingen', COL.MAINTENANCE_NOTES),
    created_at: getCol('datum gemaakt', COL.CREATED_AT),
    updated_at: getCol('datum update', COL.UPDATED_AT),
    completed_at: getCol('datum opgelost', COL.COMPLETED_AT)
  };
}

/**
 * Updates a task with LockService and state machine validation
 * @param {string} taskId - Task UUID
 * @param {Object} updates - Fields to update (already validated)
 * @return {Object} Updated task
 */
function updateTask(taskId, updates) {
  if (!isValidTaskId(taskId)) {
    throw new Error('Invalid task ID format');
  }

  const lock = LockService.getScriptLock();
  const lockAcquired = lock.tryLock(10000);

  if (!lockAcquired) {
    throw new Error('Could not acquire lock for task update. Please try again.');
  }

  try {
    const sheet = getActiveSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const headerIndices = {};
    headers.forEach((header, index) => {
      headerIndices[header] = index;
    });

    const taskIdCol = headerIndices['task_id'] || COL.TASK_ID;

    // Find task row
    let taskRowIndex = -1;
    let existingTask = null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][taskIdCol] === taskId) {
        taskRowIndex = i;
        existingTask = mapRowToTask(data[i], headerIndices);
        break;
      }
    }

    if (taskRowIndex === -1) {
      throw new Error('Task not found');
    }

    const row = data[taskRowIndex];
    const now = new Date().toISOString();
    let statusChanged = false;
    let completedNow = false;

    // Apply updates
    if (updates.description !== undefined) {
      row[headerIndices['Omschrijving'] || COL.DESCRIPTION] = updates.description;
    }
    if (updates.requester_name !== undefined) {
      row[headerIndices['naam aanvrager'] || COL.REQUESTER_NAME] = updates.requester_name;
    }
    if (updates.location !== undefined) {
      row[headerIndices['Welke klas? Welk lokaal?'] || COL.LOCATION] = updates.location;
    }
    if (updates.required_materials !== undefined) {
      row[headerIndices['Benodigd materiaal'] || COL.REQUIRED_MATERIALS] = updates.required_materials;
    }
    if (updates.urgency !== undefined) {
      row[headerIndices['prioriteit'] || COL.URGENCY] = URGENCY_TO_DUTCH[updates.urgency] || 'niet zo dringend';
    }
    if (updates.status !== undefined) {
      const oldStatus = existingTask.status;
      const newStatus = updates.status;

      // Validate transition (already done in validation, but double-check)
      const allowed = VALID_TRANSITIONS[oldStatus] || [];
      if (!allowed.includes(newStatus)) {
        throw new Error(`Invalid status transition: ${oldStatus} → ${newStatus}`);
      }

      row[headerIndices['opvolging'] || COL.STATUS] = STATUS_TO_DUTCH[newStatus] || '';
      statusChanged = true;
      completedNow = (newStatus === 'Completed' && oldStatus !== 'Completed');
    }
    if (updates.maintenance_notes !== undefined) {
      row[headerIndices['Opmerkingen'] || COL.MAINTENANCE_NOTES] = updates.maintenance_notes;
    }
    if (updates.photos !== undefined && Array.isArray(updates.photos)) {
      // Append new photos to existing
      const existingPhotos = parsePhotoUrls(row[headerIndices['photo_urls'] || COL.PHOTO_URLS] || '[]');
      const combined = [...existingPhotos, ...updates.photos];
      row[headerIndices['photo_urls'] || COL.PHOTO_URLS] = serializePhotos(combined);
    }

    // Always update updated_at
    row[headerIndices['datum update'] || COL.UPDATED_AT] = now;

    // Set completed_at if transitioning to Completed
    if (completedNow) {
      row[headerIndices['datum opgelost'] || COL.COMPLETED_AT] = now;
    }

    // Write back to sheet
    sheet.getRange(taskRowIndex + 1, 1, 1, row.length).setValues([row]);

    // Return updated task
    return mapRowToTask(row, headerIndices);

  } finally {
    lock.releaseLock();
  }
}

/**
 * Adds photos to an existing task
 * @param {string} taskId - Task UUID
 * @param {Array<Object>} photos - Photo metadata from uploadPhotos
 * @return {Object} Updated task
 */
function addPhotosToTask(taskId, photos) {
  if (!isValidTaskId(taskId)) {
    throw new Error('Invalid task ID format');
  }

  const lock = LockService.getScriptLock();
  const lockAcquired = lock.tryLock(10000);

  if (!lockAcquired) {
    throw new Error('Could not acquire lock for photo upload. Please try again.');
  }

  try {
    const sheet = getActiveSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const headerIndices = {};
    headers.forEach((header, index) => {
      headerIndices[header] = index;
    });

    const taskIdCol = headerIndices['task_id'] || COL.TASK_ID;

    // Find task row
    let taskRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][taskIdCol] === taskId) {
        taskRowIndex = i;
        break;
      }
    }

    if (taskRowIndex === -1) {
      throw new Error('Task not found');
    }

    const row = data[taskRowIndex];
    const photoUrlsCol = headerIndices['photo_urls'] || COL.PHOTO_URLS;

    // Get existing photos and append new ones
    const existingPhotos = parsePhotoUrls(row[photoUrlsCol] || '[]');
    const combined = [...existingPhotos, ...photos];

    // Check limit
    if (combined.length > LIMITS.MAX_PHOTOS_PER_TASK) {
      throw new Error(`Maximum ${LIMITS.MAX_PHOTOS_PER_TASK} photos per task allowed`);
    }

    row[photoUrlsCol] = serializePhotos(combined);
    row[headerIndices['datum update'] || COL.UPDATED_AT] = new Date().toISOString();

    sheet.getRange(taskRowIndex + 1, 1, 1, row.length).setValues([row]);

    return mapRowToTask(row, headerIndices);

  } finally {
    lock.releaseLock();
  }
}

/**
 * Gets task count by status (for dashboard)
 * @return {Object} Counts by status
 */
function getTaskCounts() {
  const sheet = getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const headerIndices = {};
  headers.forEach((header, index) => {
    headerIndices[header] = index;
  });

  const statusCol = headerIndices['opvolging'] || COL.STATUS;

  const counts = {
    'New': 0,
    'Planned': 0,
    'In progress': 0,
    'Waiting for materials': 0,
    'Completed': 0,
    total: 0
  };

  for (let i = 1; i < data.length; i++) {
    const dutchStatus = data[i][statusCol] || '';
    const status = DUTCH_TO_STATUS[dutchStatus] || 'New';
    if (counts[status] !== undefined) {
      counts[status]++;
    }
    counts.total++;
  }

  return counts;
}

// =========================================================================
// Source: code/Code.gs
// =========================================================================


/**
 * Handles GET requests
 * Supported actions:
 *   (none) or action=login -> Show login page
 *   action=list -> List tasks (requires auth, worker role)
 *   action=get -> Get single task (requires auth, worker role)
 *   action=validate -> Handled via POST
 *   action=counts -> Get task counts by status (requires auth, worker role)
 * @param {Object} e - Event parameter
 * @return {ContentService.TextOutput|HtmlService.HtmlOutput}
 */
function doGet(e) {
  // Handle undefined event
  if (!e || !e.parameter) {
    return getLoginPage();
  }

  const action = e.parameter.action || 'login';

  // Login page (no auth required)
  if (action === 'login') {
    return getLoginPage();
  }

  // All other actions require authentication
  if (!checkAuth(e)) {
    return authErrorResponse();
  }

  // Check worker role for read operations
  if (!isWorker(e)) {
    return forbiddenResponse();
  }

  try {
    switch (action) {
      case 'list': {
        const filters = {};
        if (e.parameter.status) filters.status = e.parameter.status;
        if (e.parameter.urgency) filters.urgency = e.parameter.urgency;
        if (e.parameter.location) filters.location = e.parameter.location;
        const limit = e.parameter.limit ? parseInt(e.parameter.limit, 10) : 50;
        const offset = e.parameter.offset ? parseInt(e.parameter.offset, 10) : 0;

        const tasks = getTasks(filters, limit, offset);
        return successResponse(tasks);
      }

      case 'get': {
        const taskId = e.parameter.id;
        if (!taskId) {
          return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Task ID is required');
        }

        const task = getTaskById(taskId);
        if (!task) {
          return errorResponse(ERROR_CODES.TASK_NOT_FOUND, 'Task not found');
        }

        return successResponse(task);
      }

      case 'counts': {
        const counts = getTaskCounts();
        return successResponse(counts);
      }

      default: {
        return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Unknown action: ' + action);
      }
    }
  } catch (err) {
    console.error('GET error:', err);
    return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Server error: ' + err.message);
  }
}

/**
 * Handles POST requests
 * Supported actions:
 *   action=validate -> Verify password, return token (no auth required)
 *   action=create -> Create new task (requires auth, staff/worker role)
 *   action=update -> Update existing task (requires auth, worker role)
 *   action=upload_photos -> Add photos to existing task (requires auth, worker role)
 * @param {Object} e - Event parameter
 * @return {ContentService.TextOutput}
 */
function doPost(e) {
  // Handle undefined event
  if (!e || !e.parameter) {
    return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid request');
  }

  const action = e.parameter.action;

  // Password validation (no auth required)
  if (action === 'validate') {
    const password = e.parameter.password;
    if (!password || typeof password !== 'string') {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Password is required');
    }

    const result = validateLogin(password);
    if (result.success) {
      return successResponse({ token: result.token });
    } else {
      return errorResponse(ERROR_CODES.AUTH_INVALID, result.error);
    }
  }

  // All other actions require authentication
  if (!checkAuth(e)) {
    return authErrorResponse();
  }

  try {
    // Parse form-urlencoded body
    const postData = e.postData.contents || '';
    const params = parseFormData(postData);

    // Merge URL params with body params (body takes precedence)
    const input = { ...e.parameter, ...params };

    switch (action) {
      case 'create': {
        if (!canCreateTask(e)) {
          return forbiddenResponse();
        }

        // Validate input
        const validation = validateTaskCreate(input);
        if (!validation.valid) {
          return errorResponse(ERROR_CODES.VALIDATION_ERROR, validation.errors.join('; '));
        }

        // Handle photos
        let photos = [];
        if (validation.sanitized.photos && validation.sanitized.photos.length > 0) {
          // Upload photos to Drive
          const taskId = Utilities.getUuid(); // Pre-generate for folder naming
          photos = uploadPhotos(validation.sanitized.photos, taskId);
        }

        // Create task
        const taskId = createTask(validation.sanitized, photos);

        // Get created task for response
        const task = getTaskById(taskId);

        return successResponse({ taskId: taskId, task: task });
      }

      case 'update': {
        if (!isWorker(e)) {
          return forbiddenResponse();
        }

        const taskId = e.parameter.id || input.id;
        if (!taskId) {
          return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Task ID is required');
        }

        // Validate input
        const existingTask = getTaskById(taskId);
        if (!existingTask) {
          return errorResponse(ERROR_CODES.TASK_NOT_FOUND, 'Task not found');
        }

        const validation = validateTaskUpdate(input, existingTask);
        if (!validation.valid) {
          return errorResponse(ERROR_CODES.VALIDATION_ERROR, validation.errors.join('; '));
        }

        // Handle new photos if provided
        let photosToAdd = [];
        if (validation.sanitized.photos && validation.sanitized.photos.length > 0) {
          photosToAdd = uploadPhotos(validation.sanitized.photos, taskId);
          // Add to updates
          validation.sanitized.photos = photosToAdd;
        } else {
          delete validation.sanitized.photos;
        }

        // Update task
        const updatedTask = updateTask(taskId, validation.sanitized);

        return successResponse(updatedTask);
      }

      case 'upload_photos': {
        if (!isWorker(e)) {
          return forbiddenResponse();
        }

        const taskId = e.parameter.id || input.id;
        if (!taskId) {
          return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Task ID is required');
        }

        // Check task exists
        const existingTask = getTaskById(taskId);
        if (!existingTask) {
          return errorResponse(ERROR_CODES.TASK_NOT_FOUND, 'Task not found');
        }

        // Parse photos from input
        let photos = [];
        if (input.photos) {
          try {
            photos = JSON.parse(input.photos);
          } catch (e) {
            return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid photos format');
          }
        }

        if (!Array.isArray(photos) || photos.length === 0) {
          return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'No photos provided');
        }

        if (photos.length > LIMITS.MAX_PHOTOS_PER_TASK) {
          return errorResponse(ERROR_CODES.VALIDATION_ERROR, `Too many photos (max ${LIMITS.MAX_PHOTOS_PER_TASK})`);
        }

        // Upload photos
        const uploadedPhotos = uploadPhotos(photos, taskId);

        // Add to task
        const updatedTask = addPhotosToTask(taskId, uploadedPhotos);

        return successResponse(updatedTask);
      }

      default: {
        return errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Unknown action: ' + action);
      }
    }
  } catch (err) {
    console.error('POST error:', err);

    // Map specific errors to error codes
    const message = err.message || 'Unknown error';
    let code = ERROR_CODES.INTERNAL_ERROR;

    if (message.includes('lock')) code = ERROR_CODES.DATABASE_ERROR;
    else if (message.includes('not found')) code = ERROR_CODES.TASK_NOT_FOUND;
    else if (message.includes('transition')) code = ERROR_CODES.INVALID_TRANSITION;
    else if (message.includes('photo') || message.includes('upload')) code = ERROR_CODES.STORAGE_ERROR;
    else if (message.includes('validation') || message.includes('Invalid')) code = ERROR_CODES.VALIDATION_ERROR;

    return errorResponse(code, message);
  }
}

/**
 * Parses form-urlencoded data
 * @param {string} data - Form data string
 * @return {Object} Parsed key-value pairs
 */
function parseFormData(data) {
  const result = {};
  if (!data) return result;

  const pairs = data.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      try {
        result[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      } catch (e) {
        result[key] = value || '';
      }
    }
  }

  return result;
}

/**
 * Initialization function - run once to set up the system
 * Sets maintenance worker email, login password, and frontend URL
 */
function initialize() {
  // Set the maintenance worker email
  PropertiesService.getScriptProperties()
    .setProperty(PROP.MAINTENANCE_WORKER_EMAIL, 'maartenderyck@sint-albertschool.be');

  // Set the frontend URL (GitHub Pages) - adjust if your repo/branch differs
  PropertiesService.getScriptProperties()
    .setProperty(PROP.FRONTEND_URL, 'https://mdr-be.github.io/school-maintenance-reporter-pwa/');

  Logger.log('Initialization complete. Password will be set from Config.gs on first login.');
}

/**
 * Helper to change the login password after initialization
 * @param {string} newPassword - New plaintext password
 */
function changeLoginPassword(newPassword) {
  setLoginPassword(newPassword);
  Logger.log('Login password updated successfully');
}

/**
 * Test function to verify the setup
 */
function testSetup() {
  const props = PropertiesService.getScriptProperties();

  Logger.log('Frontend URL:', props.getProperty(PROP.FRONTEND_URL));
  Logger.log('Worker Email:', props.getProperty(PROP.MAINTENANCE_WORKER_EMAIL));
  Logger.log('Password Hash Set:', !!props.getProperty(PROP.LOGIN_PASSWORD_HASH));
  Logger.log('Password Salt Set:', !!props.getProperty(PROP.LOGIN_PASSWORD_SALT));

  // Test token creation
  const token = createToken();
  Logger.log('Test Token:', token);

  // Test token storage
  storeToken(token);
  Logger.log('Token Valid:', isValidToken(token));

  // Test password verification
  const hash = props.getProperty(PROP.LOGIN_PASSWORD_HASH);
  const salt = props.getProperty(PROP.LOGIN_PASSWORD_SALT);
  if (hash && salt) {
    Logger.log('Password Verify (correct):', verifyPassword('CHANGE_THIS_PASSWORD', hash, salt));
    Logger.log('Password Verify (wrong):', verifyPassword('wrong', hash, salt));
  }

  // Test sheet access
  try {
    const sheet = getActiveSheet();
    Logger.log('Active Sheet:', sheet.getName());
    const counts = getTaskCounts();
    Logger.log('Task Counts:', counts);
  } catch (e) {
    Logger.log('Sheet Error:', e.message);
  }

  // Test Drive access
  try {
    const folder = getOrCreateRootFolder();
    Logger.log('Root Folder:', folder.getName(), folder.getId());
    const yearFolder = getPhotoFolderForYear(new Date().getFullYear());
    Logger.log('Year Folder:', yearFolder.getName(), yearFolder.getId());
  } catch (e) {
    Logger.log('Drive Error:', e.message);
  }
}
