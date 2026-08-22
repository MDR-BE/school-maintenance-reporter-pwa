// ====================== Configuration ======================
const SHEET_NAME_PATTERN = /^klusjes \d{8}$/; // Matches klusjes DDMMYYYY
const PHOTO_FOLDER_NAME = 'Klusjes_Photos';  // Single folder name (no path separator)
// ID of the specific spreadsheet we want to use
const TARGET_SPREADSHEET_ID = '1HtYJqAWengq_wvEbt2SE_Rx4cPwSyal5YwHbp_Z0wVY';
// Property keys
const MAINTENANCE_WORKER_PROPERTY = 'maintenance_worker';     // e‑mail of the maintenance worker
const LOGIN_PASSWORD_PROPERTY   = 'login_password';          // the gate password (set once)
const AUTH_TOKEN_PROPERTY_PREFIX = 'auth_token_';           // prefix for per‑user token storage
const FRONTEND_URL_PROPERTY     = 'frontend_url';            // URL of the GitHub Pages PWA
const TOKEN_TTL_MS = 15 * 60 * 1000;                         // 15 minutes

// Default urgency levels and statuses (for validation)
const VALID_URGENCIES = ['Normal', 'Important', 'Urgent'];
const VALID_STATUSES  = ['New', 'Planned', 'In progress', 'Waiting for materials', 'Completed'];

// ====================== Helper Functions ======================
/**
 * Returns the active sheet (most recent sheet matching the pattern) from the target spreadsheet.
 * If no sheet matches, creates a new one with today's date.
 * @return {GoogleAppsScript.Spreadsheet.Sheet} The active sheet.
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
      const date = new Date(year, month - 1, day); // month is 0‑indexed
      if (!latestDate || date > latestDate) {
        latestDate = date;
        activeSheet = sheet;
      }
    }
  }

  if (!activeSheet) {
    // No matching sheet – create one for today
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const sheetName = `klusjes ${day}${month}${year}`;
    activeSheet = ss.insertSheet(sheetName);
    const headers = [
      'Omschrijving',           // 0
      'naam aanvrager',         // 1
      'Welke klas? Welk lokaal?', // 2
      'Benodigd materiaal',     // 3
      'prioriteit',             // 4
      'opvolging',              // 5
      'photo_urls',             // 6 (new)
      'Opmerkingen',            // 7 (existing)
      'datum gemaakt',          // 8 (existing)
      'datum update',           // 9 (existing)
      'datum opgelost',         // 10 (existing)
      'task_id'                 // 11
    ];
    activeSheet.appendRow(headers);
  }

  return activeSheet;
}

/**
 * Returns the Google Drive folder for storing photos.
 * Uses folder ID from script properties, creates if not exists.
 * @return {GoogleAppsScript.Drive.Folder} The photo folder.
 */
function getPhotoFolder() {
  const folderId = PropertiesService.getScriptProperties().getProperty('photo_folder_id');
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      // Folder was deleted, create new one
    }
  }
  // Folder doesn't exist or was deleted, create it
  const folder = DriveApp.createFolder(PHOTO_FOLDER_NAME);
  PropertiesService.getScriptProperties().setProperty('photo_folder_id', folder.getId());
  return folder;
}

/**
 * Sets the maintenance worker e‑mail.
 * @param {string} email - The maintenance worker e‑mail address.
 */
function setMaintenanceWorker(email) {
  PropertiesService.getScriptProperties()
    .setProperty(MAINTENANCE_WORKER_PROPERTY, email);
}

/**
 * Returns the login password for the gate.
 * @return {string} The password.
 */
function getLoginPassword() {
  return PropertiesService.getScriptProperties().getProperty(LOGIN_PASSWORD_PROPERTY) || '';
}

/**
 * Sets the login password for the gate.
 * @param {string} password - The password to protect the PWA.
 */
function setLoginPassword(password) {
  if (typeof password !== 'string' || password.trim() === '') {
    throw new Error('Password must be a non-empty string.');
  }
  PropertiesService.getScriptProperties()
    .setProperty(LOGIN_PASSWORD_PROPERTY, password);
}

/**
 * Returns the frontend URL (GitHub Pages) where the PWA lives.
 * @return {string} The frontend URL.
 */
function getFrontendUrl() {
  return PropertiesService.getScriptProperties().getProperty(FRONTEND_URL_PROPERTY) || '';
}

/**
 * Sets the frontend URL.
 * @param {string} url - The URL of the GitHub Pages PWA (e.g. https://mdr-be.github.io/school-maintenance-reporter-pwa/).
 */
function setFrontendUrl(url) {
  PropertiesService.getScriptProperties().setProperty(FRONTEND_URL_PROPERTY, url);
}

/**
 * Returns the origin of the frontend (GitHub Pages) for CORS headers.
 * @return {string} The origin (e.g., https://mdr-be.github.io) or * if unable to determine.
 */
function getFrontendOrigin() {
  const frontendUrl = PropertiesService.getScriptProperties().getProperty(FRONTEND_URL_PROPERTY) || '';
  try {
    const url = new URL(frontendUrl);
    return url.origin;   // e.g. https://mdr-be.github.io
  } catch (_) {
    // fallback – allow any origin (less secure, but works if you can't determine it)
    return '*';
  }
}

/**
 * Adds CORS headers to a ContentService output.
 * @param {ContentService.TextOutput} output The output to modify.
 * @return {ContentService.TextOutput} The output with CORS headers.
 */
function addCorsHeaders(output) {
  try {
    // Validate that we have a valid output object with setHeader method
    if (output && typeof output.setHeader === 'function') {
      output.setHeader('Access-Control-Allow-Origin', getFrontendOrigin());
      output.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } catch (e) {
    // If something goes wrong, just return the output without headers
    return output;
  }
  return output;
}

/**
 * Adds CORS headers to an HtmlService output.
 * @param {HtmlService.HtmlOutput} output The output to modify.
 * @return {HtmlService.HtmlOutput} The output with CORS headers.
 */
function addCorsHeadersHtml(output) {
  try {
    // Validate that we have a valid output object with required methods
    if (output && typeof output.setXFrameOptionsMode === 'function' && 
        typeof output.setHeader === 'function') {
      output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      output.setHeader('Access-Control-Allow-Origin', getFrontendOrigin());
      output.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } catch (e) {
    // If something goes wrong, just return the output without headers
    return output;
  }
  return output;
}

/**
 * Creates a random UUID-like token.
 * @return {string} A random token.
 */
function createToken() {
  return Utilities.getUuid();
}

/**
 * Stores a token with a timestamp in Script Properties.
 * @param {string} token - The token to store.
 */
function storeToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: must be a non-empty string');
  }
  PropertiesService.getScriptProperties()
    .setProperty(AUTH_TOKEN_PROPERTY_PREFIX + token, Date.now().toString());
}

/**
 * Checks whether a token exists and is still valid (not expired).
 * @param {string} token - The token to validate.
 * @return {boolean} True if token exists and is within TTL.
 */
function isValidToken(token) {
  const key = AUTH_TOKEN_PROPERTY_PREFIX + token;
  const ts = PropertiesService.getScriptProperties().getProperty(key);
  if (!ts) return false;
  const valid = (Date.now() - parseInt(ts, 10)) < TOKEN_TTL_MS;
  if (!valid) {
    PropertiesService.getScriptProperties().deleteProperty(key);
  }
  return valid;
}

/**
 * Removes a token from Script Properties (logout).
 * @param {string} token - The token to remove.
 */
function removeToken(token) {
  if (!token || typeof token !== 'string') {
    // Invalid token, nothing to remove
    return;
  }
  PropertiesService.getScriptProperties()
    .deleteProperty(AUTH_TOKEN_PROPERTY_PREFIX + token);
}

/**
 * Extracts the pwa_auth token from the request cookie or query parameter.
 * @param {Object} e - The event parameter.
 * @return {string|null} The token if present, otherwise null.
 */
function getAuthTokenFromRequest(e) {
  // Handle case where e is undefined
  if (!e) return null;
  
  // First check query parameter (for cross-domain requests)
  if (e.parameter && e.parameter.token) {
    return decodeURIComponent(e.parameter.token);
  }
  
  // Then check cookie (for same-domain requests)
  if (e.cookie) {
    const match = e.cookie.match(/(?:^|;)\s*pwa_auth=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
  
  return null;
}

/**
 * Checks whether the current request is authenticated.
 * @param {Object} e - The event parameter.
 * @return {boolean} True if authenticated.
 */
function checkAuth(e) {
  const token = getAuthTokenFromRequest(e);
  if (token === null) return false;
  return isValidToken(token);
}

/**
 * Returns an unauthorized JSON response with CORS headers.
 * @return {ContentService.TextOutput} JSON with error.
 */
function authError() {
  return addCorsHeaders(
    ContentService
      .createTextOutput(JSON.stringify({ error: 'Not authorized' }))
      .setMimeType(ContentService.MimeType.JSON)
  );
}

/**
 * Login page HTML shown when the user is not authenticated.
 */
const LOGIN_PAGE = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PWA Login</title>
  <style>
    body {font-family: Arial, sans-serif; background:#f5f5f5; margin:0; padding:0; display:flex; height:100vh; align-items:center; justify-content:center;}
    .card {background:#fff; padding:2rem; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,.1); width:320px;}
    h2 {margin-top:0;}
    label {display:block; margin-top:1.5rem;}
    input {width:100%; padding:0.5rem; margin-top:0.25rem; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;}
    button {margin-top:1.5rem; width:100%; padding:0.75rem; background:#1976d2; color:#fff; border:none; border-radius:4px; cursor:pointer;}
    button:hover {background:#1565c0;}
    .error {color:#d32f2f; margin-top:1rem; font-size:0.9rem;}
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
  </div>
  <script>
    const form = document.getElementById('loginForm');
    const errorDiv = document.getElementById('error');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      errorDiv.textContent = '';
      const password = document.getElementById('password').value;
      const resp = await fetch(window.location.href + '?action=validate', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({password: password})
      });
      const data = await resp.json();
      if (data.success) {
        // Set cookie and redirect to frontend
        document.cookie = "pwa_auth=" + data.token + "; path=/; max-age=" + (15*60) + "; SameSite=Lax";
        window.location.href = "' + getFrontendUrl() + '";
      } else {
        errorDiv.textContent = data.error || 'Ongeldig wachtwoord';
      }
    });
  </script>
</body>
</html>
`;

/**
 * Handles GET requests.
 * Supported actions:
 *   (no action) or action=login -> show login page
 *   action=list / action=get   -> require auth, then proxy to API
 *   action=validate            -> handled via POST (see doPost)
 * @param {Object} e The event parameter.
 * @return {string} JSON or HTML response.
 */
function doGet(e) {
  // Handle case where e or e.parameter is undefined
  if (!e || !e.parameter || !e.parameter.action || e.parameter.action === 'login') {
    return addCorsHeadersHtml(
      HtmlService.createHtmlOutput(LOGIN_PAGE)
    );
  }

  // For API actions, require authentication
  if (!checkAuth(e)) {
    return authError();
  }

  const action = e.parameter.action;
  if (action === 'list') {
    const filters = {};
    if (e.parameter.status) filters.status = e.parameter.status;
    if (e.parameter.urgency) filters.urgency = e.parameter.urgency;
    if (e.parameter.location) filters.location = e.parameter.location;
    const limit = e.parameter.limit ? parseInt(e.parameter.limit, 10) : undefined;
    const offset = e.parameter.offset ? parseInt(e.parameter.offset, 10) : undefined;
    const result = getTasks(filters, limit, offset);
    return addCorsHeaders(
      ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON)
    );
  } else if (action === 'get') {
    const taskId = e.parameter.id;
    if (!taskId) {
      return addCorsHeaders(
        ContentService
          .createTextOutput(JSON.stringify({ error: 'Task ID is required' }))
          .setMimeType(ContentService.MimeType.JSON)
      );
    }
    const tasks = getTasks({}, 1); // get all then filter
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      return addCorsHeaders(
        ContentService
          .createTextOutput(JSON.stringify({ error: 'Task not found' }))
          .setMimeType(ContentService.MimeType.JSON)
      );
    }
    return addCorsHeaders(
      ContentService
        .createTextOutput(JSON.stringify(task))
        .setMimeType(ContentService.MimeType.JSON)
    );
  } else {
    // Unknown action
    return addCorsHeaders(
      ContentService
        .createTextOutput(JSON.stringify({ error: 'Unknown action' }))
        .setMimeType(ContentService.MimeType.JSON)
    );
  }
}

/**
 * Handles POST requests.
 * Supported actions:
 *   action=validate   -> verify password, set cookie via JS redirect
 *   (no action)       -> create a new task (multipart/form-data)
 *   action=update&id= -> update a task (JSON body)
 * @param {Object} e The event parameter.
 * @return {string} JSON or HTML response.
 */
function doPost(e) {
  // If the request is for validation, handle it without auth check
  if (e.parameter && e.parameter.action === 'validate') {
    const password = e.parameter.password;
    const correct = getLoginPassword();
    if (!correct) {
      return addCorsHeaders(
        ContentService
          .createTextOutput(JSON.stringify({ error: 'Login password not set. Please run setLoginPassword() in the script editor.' }))
          .setMimeType(ContentService.MimeType.JSON)
      );
    }
    if (password === correct) {
      const token = createToken();
      storeToken(token);
      // Return JSON with success and token (frontend expects JSON response)
      return addCorsHeaders(
        ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            token: token
          }))
          .setMimeType(ContentService.MimeType.JSON)
      );
    } else {
      return addCorsHeaders(
        ContentService
          .createTextOutput(JSON.stringify({ error: 'Ongeldig wachtwoord' }))
          .setMimeType(ContentService.MimeType.JSON)
      );
    }
  }

  // For all other POST actions, require authentication
  if (!checkAuth(e)) {
    return authError();
  }

  const action = e.parameter.action;
  if (action === 'update') {
    const taskId = e.parameter.id;
    if (!taskId) {
      return addCorsHeaders(
        ContentService
          .createTextOutput(JSON.stringify({ error: 'Task ID is required for update' }))
          .setMimeType(ContentService.MimeType.JSON)
      );
    }
    const postData = e.postData.contents;
    let updates;
    try {
      updates = JSON.parse(postData);
    } catch (parseError) {
      return addCorsHeaders(
        ContentService
          .createTextOutput(JSON.stringify({ error: 'Invalid JSON in request body' }))
          .setMimeType(ContentService.MimeType.JSON)
      );
    }
    const success = updateTask(taskId, updates);
    if (!success) {
      return addCorsHeaders(
        ContentService
          .createTextOutput(JSON.stringify({ error: 'Task not found' }))
          .setMimeType(ContentService.MimeType.JSON)
      );
    }
    return addCorsHeaders(
      ContentService
        .createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON)
    );
  } else {
    // Create a new task (JSON with base64-encoded photos)
    // Expected JSON format:
    // {
    //   description: "...",
    //   requester_name: "...",
    //   location: "...",
    //   required_materials: "...",
    //   urgency: "Normal",
    //   status: "New",
    //   photos: [
    //     { filename: "photo.jpg", mimeType: "image/jpeg", base64: "..." }
    //   ]
    // }
    let description = '';
    let requester_name = '';
    let location = '';
    let required_materials = '';
    let urgency = 'Normal';
    let status = 'New';
    let photoUrls = [];

    const contentType = e.postData.type || '';
    const postData = e.postData.contents;

    if (contentType.includes('application/json') && postData) {
      try {
        const data = JSON.parse(postData);
        
        description = data.description || '';
        requester_name = data.requester_name || '';
        location = data.location || '';
        required_materials = data.required_materials || '';
        urgency = data.urgency || 'Normal';
        status = data.status || 'New';

        // Handle base64-encoded photos
        if (data.photos && Array.isArray(data.photos)) {
          for (const photo of data.photos) {
            if (photo.base64 && photo.mimeType && photo.filename) {
              try {
                const bytes = Utilities.base64Decode(photo.base64);
                const blob = Utilities.newBlob(bytes, photo.mimeType, photo.filename);
                const photoFolder = getPhotoFolder();
                const file = photoFolder.createFile(blob);
                const fileUrl = file.getUrl();
                photoUrls.push(fileUrl);
              } catch (fileError) {
                console.error('Error uploading photo:', fileError);
                // Fail the request so user knows photo upload failed
                return addCorsHeaders(
                  ContentService
                    .createTextOutput(JSON.stringify({ 
                      success: false, 
                      error: 'Photo upload failed: ' + fileError.message 
                    }))
                    .setMimeType(ContentService.MimeType.JSON)
                );
              }
            }
          }
        }
      } catch (parseError) {
        return addCorsHeaders(
          ContentService
            .createTextOutput(JSON.stringify({ error: 'Invalid JSON in request body' }))
            .setMimeType(ContentService.MimeType.JSON)
        );
      }
    } else {
      // Fallback to URL-encoded parameters (for backward compatibility)
      description = e.parameter.description || '';
      requester_name = e.parameter.requester_name || '';
      location = e.parameter.location || '';
      required_materials = e.parameter.required_materials || '';
      urgency = e.parameter.urgency || 'Normal';
      status = e.parameter.status || 'New';
    }

    const taskData = {
      description: description,
      requester_name: requester_name,
      location: location,
      required_materials: required_materials,
      urgency: urgency,
      status: status,
      photo_urls: photoUrls.join(','),
      maintenance_notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: ''
    };

    return addCorsHeaders(
      ContentService
        .createTextOutput(JSON.stringify({ success: true, taskId: createTask(taskData) }))
        .setMimeType(ContentService.MimeType.JSON)
    );
  }
}

/**
 * Parses multipart/form-data content.
 * @param {string} data - The raw multipart content.
 * @param {string} boundary - The multipart boundary.
 * @return {Object} Parsed fields and file.
 */

/**
 * Copies formatting from source sheet to target sheet.
 * Includes: column widths, frozen rows, data validation, conditional formatting, 
 * and basic cell formatting (borders, backgrounds, fonts).
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sourceSheet - The sheet to copy formatting from
 * @param {GoogleAppsScript.Spreadsheet.Sheet} targetSheet - The sheet to apply formatting to
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
      // Clone the rule but apply to target sheet ranges
      const ranges = rule.getRanges();
      const newRanges = [];
      for (const range of ranges) {
        // Create corresponding range in target sheet
        const newRange = targetSheet.getRange(
          range.getRow(),
          range.getColumn(),
          range.getNumRows(),
          range.getNumColumns()
        );
        newRanges.push(newRange);
      }
      // Copy the rule with new ranges
      const newRule = rule.copy()
        .setRanges(newRanges)
        .build();
      targetConditionalFormats.push(newRule);
    }
    targetSheet.setConditionalFormatRules(targetConditionalFormats);
  }
  
  // 5. Copy cell formatting for header row and first few data rows
  // This copies backgrounds, fonts, borders, number formats, etc.
  const headerRow = sourceSheet.getRange(1, 1, 1, numCols);
  const targetHeaderRow = targetSheet.getRange(1, 1, 1, numCols);
  
  // Copy header formatting using copyTo with PASTE_FORMAT (copies all formatting including borders)
  headerRow.copyTo(targetHeaderRow, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  
  // Copy formatting for first data row (as template for data rows)
  if (numRows > 1) {
    const firstDataRow = sourceSheet.getRange(2, 1, 1, numCols);
    const targetFirstDataRow = targetSheet.getRange(2, 1, 1, numCols);
    
    firstDataRow.copyTo(targetFirstDataRow, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }
}

/**
 * Maps the Dutch priority value to the PWA urgency.
 * @param {string} dutchPriority - The priority from the sheet (e.g., 'niet zo dringend').
 * @return {string} The urgency level ('Normal', 'Important', 'Urgent').
 */
function mapPriorityToUrgency(dutchPriority) {
  switch (dutchPriority) {
    case 'niet zo dringend':
      return 'Normal';
    case 'dringend':
      return 'Important';
    case 'zeer dringend':
      return 'Urgent';
    default:
      return 'Normal'; // default
  }
}

/**
 * Maps the Dutch opvolging value to the PWA status.
 * @param {string} dutchOpvolging - The opvolging from the sheet.
 * @return {string} The status ('New', 'Planned', 'In progress', 'Completed').
 */
function mapOpvolgingToStatus(dutchOpvolging) {
  if (!dutchOpvolging) {
    return 'New';
  }
  const trimmed = dutchOpvolging.trim();
  switch (trimmed) {
    case 'In orde':
      return 'Completed';
    case 'overnemen op volgend lijstje':
      return 'Planned';
    case 'niet voldoende gebeurd':
      return 'In progress';
    case 'bezig of in pauze; met extern bedrijf of MAARTEN':
      return 'In progress';
    default:
      return 'New';
  }
}

/**
 * Maps the PWA urgency to the Dutch priority value for storage.
 * @param {string} urgency - The urgency level ('Normal', 'Important', 'Urgent').
 * @return {string} The Dutch priority value.
 */
function mapUrgencyToPriority(urgency) {
  switch (urgency) {
    case 'Normal':
      return 'niet zo dringend';
    case 'Important':
      return 'dringend';
    case 'Urgent':
      return 'zeer dringend';
    default:
      return 'niet zo dringend';
  }
}

/**
 * Maps the PWA status to the Dutch opvolging value for storage.
 * @param {string} status - The PWA status.
 * @return {string} The Dutch opvolging value.
 */
function mapStatusToOpvolging(status) {
  switch (status) {
    case 'Completed':
      return 'In orde';
    case 'Planned':
      return 'overnemen op volgend lijstje';
    case 'In progress':
      // We'll use 'niet voldoende gebeurd' for in progress.
      return 'niet voldoende gebeurd';
    case 'Waiting for materials':
      return 'wachten op materialen'; // custom Dutch string
    case 'New':
    default:
      return ''; // empty for new
  }
}

/**
 * Creates a new task in the spreadsheet.
 * @param {Object} taskData - The task data to create.
 * @return {string} The ID of the created task.
 */
function createTask(taskData) {
  const sheet = getActiveSheet();
  
  // Generate a unique ID for the task
  const taskId = Utilities.getUuid();
  
  // Prepare the row data according to the sheet columns
  const row = [
    taskData.description || '',                    // Omschrijving (0)
    taskData.requester_name || '',                 // naam aanvrager (1)
    taskData.location || '',                       // Welke klas? Welk lokaal? (2)
    taskData.required_materials || '',             // Benodigd materiaal (3)
    mapUrgencyToPriority(taskData.urgency) || 'niet zo dringend', // prioriteit (4)
    mapStatusToOpvolging(taskData.status) || '',   // opvolging (5)
    taskData.photo_urls || '', // photo_urls (6) - already a string
    taskData.maintenance_notes || '',              // Opmerkingen (7)
    taskData.created_at || new Date().toISOString(), // datum gemaakt (8)
    taskData.updated_at || new Date().toISOString(), // datum update (9)
    taskData.completed_at || '',                   // datum opgelost (10)
    taskId                                         // task_id (11)
  ];
  
  sheet.appendRow(row);
  return taskId;
}

/**
 * Updates an existing task in the spreadsheet.
 * @param {string} taskId - The ID of the task to update.
 * @param {Object} updates - The fields to update.
 * @return {boolean} True if task was found and updated, false otherwise.
 */
function updateTask(taskId, updates) {
  const sheet = getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Map header names to column indices
  const headerIndices = {};
  headers.forEach((header, index) => {
    headerIndices[header] = index;
  });
  
  // Find the task row with the matching ID
  const taskIdColIndex = headerIndices['task_id'] || -1;
  if (taskIdColIndex === -1) {
    // task_id column not found, can't update
    return false;
  }
  
  let taskRowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][taskIdColIndex] === taskId) {
      taskRowIndex = i;
      break;
    }
  }
  
  if (taskRowIndex === -1) {
    // Task not found
    return false;
  }
  
  // Prepare the row data
  const row = data[taskRowIndex];
  
  // Apply updates
  if (updates.description !== undefined) {
    row[headerIndices['Omschrijving'] || 0] = updates.description;
  }
  if (updates.requester_name !== undefined) {
    row[headerIndices['naam aanvrager'] || 1] = updates.requester_name;
  }
  if (updates.location !== undefined) {
    row[headerIndices['Welke klas? Welk lokaal?'] || 2] = updates.location;
  }
  if (updates.required_materials !== undefined) {
    row[headerIndices['Benodigd materiaal'] || 3] = updates.required_materials;
  }
  if (updates.urgency !== undefined) {
    row[headerIndices['prioriteit'] || 4] = mapUrgencyToPriority(updates.urgency);
  }
  if (updates.status !== undefined) {
    row[headerIndices['opvolging'] || 5] = mapStatusToOpvolging(updates.status);
  }
  if (updates.photo_urls !== undefined) {
    row[headerIndices['photo_urls'] || 6] = updates.photo_urls || '';
  }
  if (updates.maintenance_notes !== undefined) {
    row[headerIndices['Opmerkingen'] || 7] = updates.maintenance_notes;
  }
  if (updates.created_at !== undefined) {
    row[headerIndices['datum gemaakt'] || 8] = updates.created_at;
  }
  if (updates.updated_at !== undefined) {
    row[headerIndices['datum update'] || 9] = updates.updated_at || new Date().toISOString();
  }
  if (updates.completed_at !== undefined) {
    row[headerIndices['datum opgelost'] || 10] = updates.completed_at;
  }
  
  // Update the row in the sheet
  sheet.getRange(taskRowIndex + 1, 1, 1, row.length).setValues([row]);
  return true;
}

/**
 * Retrieves tasks from the sheet with optional filtering.
 * @param {Object} filters - The filters to apply (status, urgency, location, etc.).
 * @param {number} limit - The maximum number of tasks to return.
 * @param {number} offset - The offset for pagination.
 * @return {Array<Object>} The list of tasks.
 */
function getTasks(filters, limit, offset) {
  const sheet = getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Map header names to column indices for easy access.
  const headerIndices = {};
  headers.forEach((header, index) => {
    headerIndices[header] = index;
  });

  const tasks = [];

  // Iterate over rows (skip header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const task = {};

    // Map each header to its value
    for (const header in headerIndices) {
      task[header] = row[headerIndices[header]];
    }

    // Map Dutch values to PWA format BEFORE filtering
    const pwaTask = {
      id: task.task_id || '',
      description: task.Omschrijving || '',
      requester_name: task['naam aanvrager'] || '',
      location: task['Welke klas? Welk lokaal?'] || '',
      required_materials: task['Benodigd materiaal'] || '',
      urgency: mapPriorityToUrgency(task.prioriteit) || 'Normal',
      status: mapOpvolgingToStatus(task.opvolging) || 'New',
      photo_urls: task.photo_urls ? task.photo_urls.split(',').filter(url => url.trim() !== '') : [],
      maintenance_notes: task.Opmerkingen || '',
      created_at: task['datum gemaakt'] || '',
      updated_at: task['datum update'] || '',
      completed_at: task['datum opgelost'] || ''
    };

    // Apply filters on PWA format fields
    if (filters) {
      if (filters.status && pwaTask.status !== filters.status) {
        continue;
      }
      if (filters.urgency && pwaTask.urgency !== filters.urgency) {
        continue;
      }
      if (filters.location && !pwaTask.location.toLowerCase().includes(filters.location.toLowerCase())) {
        continue;
      }
      // Add more filters as needed
    }

    tasks.push(pwaTask);

    // Apply limit and offset
    if (offset && tasks.length <= offset) {
      // Skip until we reach the offset
      tasks.pop();
      continue;
    }
    if (limit && tasks.length >= limit + (offset || 0)) {
      break;
    }
  }

  return tasks;
}

/**
 * Initialization helper – run once to set the maintenance worker, login password, and frontend URL.
 * After running, the values will be stored in Script Properties.
 */
function initialize() {
  // Set the maintenance worker as requested
  setMaintenanceWorker('maartenderyck@sint-albertschool.be');
  // Set a default login password – change this to your desired password
  setLoginPassword('Welkom123!');
  // Set the frontend URL (GitHub Pages) – adjust if your repo/branch differs
  setFrontendUrl('https://mdr-be.github.io/school-maintenance-reporter-pwa/');
  Logger.log('Initialization complete.');
}