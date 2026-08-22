// photos.js - Photo handling utilities for the Maintenance PWA (ES Module)

import { validatePhotoFile, processImage, photoToBase64 } from './utils.js';

const LIMITS = {
  MAX_PHOTOS_PER_TASK: 3,
  MAX_PHOTO_SIZE_MB: 5,
  MAX_PHOTO_DIMENSION: 1600,
  JPEG_QUALITY: 0.75
};

/**
 * Handles photo capture and selection for the staff interface.
 * @param {HTMLInputElement} fileInput - File input element
 * @param {HTMLElement} previewContainer - Container for preview images
 * @param {Function} onPhotosChange - Callback when photos change
 * @returns {Object} Controller with methods
 */
export function createPhotoHandler(fileInput, previewContainer, onPhotosChange) {
  let selectedFiles = [];
  
  function updatePreview() {
    if (!previewContainer) return;
    
    previewContainer.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;display:inline-block;margin:0.5rem;';
      
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.style.maxWidth = '100px';
      img.style.maxHeight = '100px';
      img.style.borderRadius = '4px';
      img.style.border = '1px solid #ddd';
      
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.style.cssText = `
        position:absolute;top:-8px;right:-8px;width:24px;height:24px;
        border-radius:50%;background:#dc3545;color:white;border:none;
        cursor:pointer;font-size:16px;line-height:24px;text-align:center;
      `;
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removePhoto(index);
      });
      
      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      previewContainer.appendChild(wrapper);
    });
    
    // Update file input to reflect current selection
    updateFileInput();
  }
  
  function updateFileInput() {
    if (!fileInput) return;
    // Create a new FileList-like object (DataTransfer)
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;
  }
  
  function addFiles(files) {
    const newFiles = Array.from(files);
    
    // Validate each file
    const validFiles = [];
    const errors = [];
    
    newFiles.forEach(file => {
      const validation = validatePhotoFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });
    
    // Check total count
    if (selectedFiles.length + validFiles.length > LIMITS.MAX_PHOTOS_PER_TASK) {
      errors.push(`Maximum ${LIMITS.MAX_PHOTOS_PER_TASK} photos allowed`);
      validFiles.splice(LIMITS.MAX_PHOTOS_PER_TASK - selectedFiles.length);
    }
    
    selectedFiles.push(...validFiles);
    updatePreview();
    
    if (onPhotosChange) onPhotosChange(selectedFiles);
    
    return { added: validFiles.length, errors };
  }
  
  function removePhoto(index) {
    selectedFiles.splice(index, 1);
    updatePreview();
    if (onPhotosChange) onPhotosChange(selectedFiles);
  }
  
  function clear() {
    selectedFiles = [];
    updatePreview();
    if (onPhotosChange) onPhotosChange(selectedFiles);
  }
  
  function getFiles() {
    return [...selectedFiles];
  }
  
  function getCount() {
    return selectedFiles.length;
  }
  
  // Set up file input handler
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        addFiles(e.target.files);
        // Reset input value to allow selecting same file again
        e.target.value = '';
      }
    });
  }
  
  // Support drag and drop
  if (previewContainer) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      previewContainer.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      previewContainer.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      previewContainer.addEventListener(eventName, unhighlight, false);
    });
    
    previewContainer.addEventListener('drop', handleDrop, false);
  }
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  function highlight() {
    previewContainer.style.border = '2px dashed #1976d2';
    previewContainer.style.backgroundColor = '#e3f2fd';
  }
  
  function unhighlight() {
    previewContainer.style.border = '';
    previewContainer.style.backgroundColor = '';
  }
  
  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      addFiles(files);
    }
  }
  
  return {
    addFiles,
    removePhoto,
    clear,
    getFiles,
    getCount,
    updatePreview
  };
}

/**
 * Processes multiple photos for upload.
 * @param {File[]} files - Array of photo files
 * @return {Promise<Array<Object>>} Array of processed photo objects
 */
export async function processPhotosForUpload(files) {
  const results = [];
  
  for (const file of files) {
    try {
      const processed = await photoToBase64(file);
      results.push(processed);
    } catch (error) {
      console.error(`Failed to process ${file.name}:`, error);
      throw new Error(`Failed to process ${file.name}: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Creates a camera capture handler for mobile devices.
 * @param {HTMLButtonElement} captureBtn - Button to trigger camera
 * @param {Function} onCapture - Callback with captured file
 */
export function createCameraCapture(captureBtn, onCapture) {
  if (!captureBtn) return;
  
  // Create hidden file input for camera capture
  const cameraInput = document.createElement('input');
  cameraInput.type = 'file';
  cameraInput.accept = 'image/*';
  cameraInput.capture = 'environment'; // Use back camera on mobile
  cameraInput.style.display = 'none';
  document.body.appendChild(cameraInput);
  
  captureBtn.addEventListener('click', () => {
    cameraInput.click();
  });
  
  cameraInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const validation = validatePhotoFile(file);
      if (validation.valid) {
        onCapture(file);
      } else {
        alert(validation.error);
      }
      // Reset for next capture
      cameraInput.value = '';
    }
  });
}

/**
 * Validates an array of files for upload.
 * @param {File[]} files - Files to validate
 * @return {Object} {valid: boolean, errors: string[], validFiles: File[]}
 */
export function validatePhotos(files) {
  const errors = [];
  const validFiles = [];
  
  if (!files || files.length === 0) {
    return { valid: true, errors: [], validFiles: [] };
  }
  
  if (files.length > LIMITS.MAX_PHOTOS_PER_TASK) {
    errors.push(`Too many photos: ${files.length} (max ${LIMITS.MAX_PHOTOS_PER_TASK})`);
    // Still validate the first N files
    files = files.slice(0, LIMITS.MAX_PHOTOS_PER_TASK);
  }
  
  files.forEach((file, index) => {
    const validation = validatePhotoFile(file);
    if (validation.valid) {
      validFiles.push(file);
    } else {
      errors.push(`Photo ${index + 1} (${file.name}): ${validation.error}`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    validFiles
  };
}

export { LIMITS };