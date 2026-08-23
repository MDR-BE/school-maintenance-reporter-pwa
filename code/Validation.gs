// Validation.gs - Server-side input validation and sanitization

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
