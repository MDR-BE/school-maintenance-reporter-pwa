// Tasks.gs - Task CRUD operations, state machine, and sheet management

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
