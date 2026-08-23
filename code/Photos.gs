// Photos.gs - Photo upload and Google Drive management

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
