// Code.gs - Main entry point and request router for the Maintenance PWA

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
  
  // Set a default login password - CHANGE THIS TO YOUR DESIRED PASSWORD
  // This will be hashed and stored securely
  setLoginPassword('108061'); // <-- CHANGE THIS!
  
  // Set the frontend URL (GitHub Pages) - adjust if your repo/branch differs
  PropertiesService.getScriptProperties()
    .setProperty(PROP.FRONTEND_URL, 'https://mdr-be.github.io/school-maintenance-reporter-pwa/');
  
  Logger.log('Initialization complete. IMPORTANT: Change the default password!');
  Logger.log('Run setLoginPassword("your-secure-password") to update.');
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
