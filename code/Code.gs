// Configuration
const SHEET_NAME_PATTERN = /^klusjes \d{8}$/; // Matches klusjes DDMMYYYY
const PHOTO_FOLDER_NAME = 'Klusjes/Photos';
// List of maintenance worker emails (for access control)
// In a real deployment, this would be stored in Script Properties or a separate sheet.
// For MVP, we can hardcode or read from a sheet. We'll use Script Properties for flexibility.
const MAINTENANCE_WORKER_PROPERTY = 'maintenance_workers';
// Default urgency levels and statuses (for validation)
const VALID_URGENCIES = ['Normal', 'Important', 'Urgent'];
const VALID_STATUSES = ['New', 'Planned', 'In progress', 'Waiting for materials', 'Completed'];

/**
 * Returns the active sheet (most recent sheet matching the pattern).
 * If no sheet matches, creates a new one with today's date.
 * @return {GoogleAppsScript.Spreadsheet.Sheet} The active sheet.
 */
function getActiveSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let activeSheet = null;
  let latestDate = null;

  for (const sheet of sheets) {
    const name = sheet.getName();
    if (SHEET_NAME_PATTERN.test(name)) {
      // Extract date from sheet name: klusjes DDMMYYYY
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
    // No matching sheet found, create a new one with today's date
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const sheetName = `klusjes ${day}${month}${year}`;
    activeSheet = ss.insertSheet(sheetName);
    // Set up headers
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
      'datum opgelost'          // 10 (existing)
    ];
    activeSheet.appendRow(headers);
  }

  return activeSheet;
}

/**
 * Returns the Google Drive folder for storing photos.
 * Creates it if it doesn't exist.
 * @return {GoogleAppsScript.Drive.Folder} The photo folder.
 */
function getPhotoFolder() {
  const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  // Folder doesn't exist, create it
  return DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

/**
 * Checks if the current user is a maintenance worker.
 * @return {boolean} True if the user is a maintenance worker.
 */
function isMaintenanceWorker() {
  const email = Session.getActiveUser().getEmail();
  const workers = PropertiesService.getScriptProperties().getProperty(MAINTENANCE_WORKER_PROPERTY);
  if (!workers) {
    // If no workers are set, we allow everyone (for initial setup)
    // In production, you should set this property.
    return false;
  }
  const workerList = workers.split(',').map(w => w.trim());
  return workerList.includes(email);
}

/**
 * Returns the current user's email.
 * @return {string} The user's email.
 */
function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
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
      // We'll use 'niet voldoende gebeurd' for in progress, but note that the existing
      // 'bezig of in pauze; met extern bedrijf of MAARTEN' also maps to in progress.
      // For simplicity, we'll use 'niet voldoende gebeurd' when setting to in progress.
      return 'niet voldoende gebeurd';
    case 'Waiting for materials':
      // There's no direct mapping, we'll use a custom value or leave as is? 
      // Since the existing opvolging doesn't have this, we'll store a custom string.
      // We'll use 'wachten op materialen' (Dutch for waiting for materials).
      return 'wachten op materialen';
    case 'New':
    default:
      return ''; // empty for new
  }
}

/**
 * Creates a new task in the sheet.
 * @param {Object} taskData - The task data (description, requester_name, location, required_materials, urgency, status, photo_urls, maintenance_notes).
 * @return {string} The task ID of the created task.
 */
function createTask(taskData) {
  const sheet = getActiveSheet();
  const taskId = Utilities.getUuid(); // Generate a UUID

  // Prepare the row data according to the column indices
  const rowData = [
    taskData.description || '',                           // 0: Omschrijving
    taskData.requester_name || '',                        // 1: naam aanvrager
    taskData.location || '',                              // 2: Welke klas? Welk lokaal?
    taskData.required_materials || '',                    // 3: Benodigd materiaal
    mapUrgencyToPriority(taskData.urgency) || '',         // 4: prioriteit
    mapStatusToOpvolging(taskData.status) || '',          // 5: opvolging
    taskData.photo_urls || '',                            // 6: photo_urls (new)
    taskData.maintenance_notes || '',                     // 7: Opmerkingen
    taskData.created_at || new Date().toISOString(),      // 8: datum gemaakt
    taskData.updated_at || new Date().toISOString(),      // 9: datum update
    taskData.completed_at || ''                           // 10: datum opgelost
  ];

  // Append the task ID as an additional column (column 11)
  rowData.push(taskId); // column 11: task_id

  sheet.appendRow(rowData);

  return taskId;
}

/**
 * Updates a task in the sheet by its task ID.
 * @param {string} taskId - The task ID to update.
 * @param {Object} updates - The fields to update.
 * @return {boolean} True if the task was found and updated.
 */
function updateTask(taskId, updates) {
  const sheet = getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Find the column index for task ID (we added it as column 11, index 11 in 0-based array)
  const taskIdColIndex = headers.indexOf('task_id');
  if (taskIdColIndex === -1) {
    // If we don't have a task_id column, we cannot update by task ID.
    // For MVP, we might need to add it. But let's assume we have it.
    // We'll add it in the header if missing.
    // Alternatively, we can use the row number as a temporary ID, but we said not to.
    // Let's add the task_id header if it doesn't exist.
    if (taskIdColIndex === -1) {
      sheet.getRange(1, headers.length + 1).setValue('task_id');
      headers.push('task_id');
      taskIdColIndex = headers.length - 1;
    }
  }

  // Find the row with the matching task ID
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) { // start from 1 to skip header
    if (data[i][taskIdColIndex] === taskId) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    return false; // Task not found
  }

  // Prepare the row update
  const rowData = data[rowIndex];
  // Update the fields that are present in updates
  if (updates.description !== undefined) {
    rowData[0] = updates.description; // Omschrijving
  }
  if (updates.requester_name !== undefined) {
    rowData[1] = updates.requester_name; // naam aanvrager
  }
  if (updates.location !== undefined) {
    rowData[2] = updates.location; // Welke klas? Welk lokaal?
  }
  if (updates.required_materials !== undefined) {
    rowData[3] = updates.required_materials; // Benodigd materiaal
  }
  if (updates.urgency !== undefined) {
    rowData[4] = mapUrgencyToPriority(updates.urgency); // prioriteit
  }
  if (updates.status !== undefined) {
    rowData[5] = mapStatusToOpvolging(updates.status); // opvolging
  }
  if (updates.photo_urls !== undefined) {
    rowData[6] = updates.photo_urls; // photo_urls
  }
  if (updates.maintenance_notes !== undefined) {
    rowData[7] = updates.maintenance_notes; // Opmerkingen
  }
  if (updates.created_at !== undefined) {
    rowData[8] = updates.created_at; // datum gemaakt
  }
  if (updates.updated_at !== undefined) {
    rowData[9] = updates.updated_at; // datum update
  } else {
    // Always update the updated_at timestamp when any update occurs
    rowData[9] = new Date().toISOString();
  }
  if (updates.completed_at !== undefined) {
    rowData[10] = updates.completed_at; // datum opgelost
  }
  // The task ID should not change, so we leave column 11 as is.

  // Update the row in the sheet
  sheet.getRange(rowIndex + 1, 1, 1, rowData.length).setValues([rowData]);

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

  // We expect the headers to be as we set them, including 'task_id' at the end.
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

    // Apply filters
    if (filters) {
      if (filters.status && task.status !== filters.status) {
        continue;
      }
      if (filters.urgency && task.urgency !== filters.urgency) {
        continue;
      }
      if (filters.location && !task.location.toLowerCase().includes(filters.location.toLowerCase())) {
        continue;
      }
      // Add more filters as needed
    }

    tasks.push(task);

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

  // Now we need to map the Dutch values back to PWA values for urgency and status.
  // Also, we need to split the photo_urls string into an array if needed.
  return tasks.map(task => {
    return {
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
  });
}

/**
 * Handles GET requests.
 * Supported actions:
 *   ?action=list&status=...&urgency=...&location=...&limit=...&offset=...
 *   ?action=get&id=...
 * If no action is provided, defaults to list.
 * @param {Object} e The event parameter.
 * @return {string} JSON response.
 */
function doGet(e) {
  try {
    const action = e.parameter.action || 'list';
    let result;

    if (action === 'list') {
      const filters = {};
      if (e.parameter.status) filters.status = e.parameter.status;
      if (e.parameter.urgency) filters.urgency = e.parameter.urgency;
      if (e.parameter.location) filters.location = e.parameter.location;
      const limit = e.parameter.limit ? parseInt(e.parameter.limit, 10) : undefined;
      const offset = e.parameter.offset ? parseInt(e.parameter.offset, 10) : undefined;
      result = getTasks(filters, limit, offset);
    } else if (action === 'get') {
      const taskId = e.parameter.id;
      if (!taskId) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: 'Task ID is required' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const tasks = getTasks({}, 1); // We'll get all and then filter by ID? Not efficient but okay for MVP.
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: 'Task not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      result = task;
    } else {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Unknown action' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles POST requests.
 * Supported actions:
 *   (no action) - create a new task (expects multipart/form-data with fields and optional files)
 *   ?action=update&id=... - update a task (expects JSON body with the fields to update)
 * @param {Object} e The event parameter.
 * @return {string} JSON response.
 */
function doPost(e) {
  try {
    const action = e.parameter.action;
    if (action === 'update') {
      // Update an existing task
      const taskId = e.parameter.id;
      if (!taskId) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: 'Task ID is required for update' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Parse the JSON body
      const postData = e.postData.contents;
      let updates;
      try {
        updates = JSON.parse(postData);
      } catch (parseError) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: 'Invalid JSON in request body' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const success = updateTask(taskId, updates);
      if (!success) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: 'Task not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      return ContentService
        .createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // Create a new task
      // Expect multipart/form-data
      const description = e.parameter.description || '';
      const requester_name = e.parameter.requester_name || '';
      const location = e.parameter.location || '';
      const required_materials = e.parameter.required_materials || '';
      const urgency = e.parameter.urgency || 'Normal';
      const status = e.parameter.status || 'New';

      // Handle file uploads
      let photoUrls = [];
      // The number of uploaded files is in e.parameter.filecount or we can iterate over e.parameter
      // But note: when there are file uploads, the files are in e.parameter as blobs with keys like 'file1', 'file2', etc.
      // Alternatively, we can use e.parameter.fileName and e.file.getBlob() but it's tricky.
      // Let's assume we have a single file upload for simplicity (the staff interface only allows one photo for now).
      // We'll look for a parameter that starts with 'file' or check if e.parameter has a fileName.
      // Actually, the easiest way is to check if e.parameter has a key that is not one of the known fields.
      // We'll do a simple approach: if there is a parameter named 'file', we treat it as a blob.
      // But the HTML form uses <input type="file" name="file">? We'll set the name to 'file' in the form.

      // Let's check for a parameter named 'file'
      if (e.parameter.file) {
        // This is a blob
        const blob = e.parameter.file;
        // For MVP, we'll upload all photos to the main folder and store the URL.
        // We'll generate a unique filename to avoid conflicts.
        const photoFolder = getPhotoFolder();
        const file = photoFolder.createFile(blob);
        const fileUrl = file.getUrl();
        photoUrls.push(fileUrl);
        
        // Now create the task with the photo URL
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
        
        return ContentService
          .createTextOutput(JSON.stringify({ success: true, taskId: createTask(taskData) }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        // No file uploaded
        const taskData = {
          description: description,
          requester_name: requester_name,
          location: location,
          required_materials: required_materials,
          urgency: urgency,
          status: status,
          photo_urls: '',
          maintenance_notes: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: ''
        };
        
        return ContentService
          .createTextOutput(JSON.stringify({ success: true, taskId: createTask(taskData) }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Function to set up maintenance workers (for initial setup).
 * @param {string} emails - Comma-separated list of emails.
 */
function setMaintenanceWorkers(emails) {
  PropertiesService.getScriptProperties().setProperty(MAINTENANCE_WORKER_PROPERTY, emails);
}

/**
 * Function to create a new quarter sheet and copy unfinished tasks.
 * This would be called manually or via a trigger.
 */
function createNewQuarterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const sheetName = `klusjes ${day}${month}${year}`;

  // Check if a sheet with this name already exists
  const existingSheet = ss.getSheetByName(sheetName);
  if (existingSheet) {
    return; // Sheet already exists for today
  }

  // Create new sheet
  const newSheet = ss.insertSheet(sheetName);
  // Set up headers (same as before)
  const headers = [
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
  newSheet.appendRow(headers);

  // Get the most recent previous sheet (excluding the new one we just created)
  const sheets = ss.getSheets();
  let previousSheet = null;
  let latestDate = null;

  for (const sheet of sheets) {
    const name = sheet.getName();
    if (name === sheetName) {
      continue; // skip the new sheet
    }
    if (SHEET_NAME_PATTERN.test(name)) {
      const dateStr = name.substring(8);
      const day = parseInt(dateStr.substring(0, 2), 10);
      const month = parseInt(dateStr.substring(2, 4), 10);
      const year = parseInt(dateStr.substring(4, 8), 10);
      const date = new Date(year, month - 1, day);
      if (!latestDate || date > latestDate) {
        latestDate = date;
        previousSheet = sheet;
      }
    }
  }

  if (previousSheet) {
    // Copy unfinished tasks from previous sheet to new sheet
    const previousData = previousSheet.getDataRange().getValues();
    const previousHeaders = previousData[0];
    // We need to map the previous sheet's columns to the new sheet's columns.
    // Since the headers are the same, we can copy the rows directly.
    // But we need to skip the header and only copy rows where status is not 'Completed'
    // We'll determine the status by looking at the 'opvolging' column (index 5) and mapping.
    const opvolgingColIndex = previousHeaders.indexOf('opvolging');
    if (opvolgingColIndex === -1) {
      // If we can't find opvolging, we'll copy all rows (skip header)
      for (let i = 1; i < previousData.length; i++) {
        newSheet.appendRow(previousData[i]);
      }
    } else {
      for (let i = 1; i < previousData.length; i++) {
        const row = previousData[i];
        const opvolging = row[opvolgingColIndex];
        const status = mapOpvolgingToStatus(opvolging);
        if (status !== 'Completed') {
          // We need to reset the timestamps? Or keep them as is?
          // We'll keep the original created_at, but update the updated_at to now? 
          // For simplicity, we'll keep the existing values and let the maintenance worker update them.
          newSheet.appendRow(row);
        }
      }
    }
  }
}