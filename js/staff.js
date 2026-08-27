// staff.js - Staff interface logic for the Maintenance PWA (ES Module)

import { createTask } from './api.js';
import { showMessage, hideMessage, escapeHtml } from './utils.js';
import { requireAuth, logout } from './auth.js';
import { createPhotoHandler, validatePhotos, processPhotosForUpload } from './photos.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Require authentication
  await requireAuth();
  
  // Check for URL parameters (for future QR code compatibility)
  const urlParams = new URLSearchParams(window.location.search);
  const locationParam = urlParams.get('location');
  if (locationParam) {
    // Pre-fill location if provided via URL (for QR code scanning)
    const locationInput = document.getElementById('location');
    if (locationInput) {
      locationInput.value = decodeURIComponent(locationParam);
      // Optionally highlight or show that it's pre-filled
      locationInput.style.border = '2px solid #0066cc';
    }
  }
  
  const form = document.getElementById('issueForm');
  const formMessage = document.getElementById('form-message');
  const cancelBtn = document.getElementById('cancelButton');
  const photoInput = document.getElementById('photo');
  const photoPreview = document.getElementById('photo-preview');
  const capturePhotoBtn = document.getElementById('capturePhoto');

  // Add logout button to header
  const header = document.querySelector('h1');
  if (header) {
    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Logout';
    logoutBtn.className = 'cancel-btn';
    logoutBtn.style.marginLeft = '1rem';
    logoutBtn.style.padding = '0.5rem 1rem';
    logoutBtn.style.fontSize = '0.9rem';
    logoutBtn.addEventListener('click', logout);
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.appendChild(logoutBtn);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      form.reset();
      hideMessage('form-message');
      // Reset photo handler
      if (window.photoHandler) window.photoHandler.clear();
      window.location.href = './index.html';
    });
  }

  // Initialize photo handler
  const photoHandler = createPhotoHandler(photoInput, photoPreview, (files) => {
    // Update photo count display or other UI if needed
  });
  window.photoHandler = photoHandler; // Make accessible globally for cleanup

  // Setup camera capture
  if (capturePhotoBtn) {
    // Import and use camera capture from photos.js
    import('./photos.js').then(({ createCameraCapture }) => {
      createCameraCapture(capturePhotoBtn, (file) => {
        photoHandler.addFiles([file]);
      });
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Show loading state
      const submitBtn = form.querySelector('.submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Versturen...';
      
      // Collect form data
      const description = form.description.value.trim();
      const location = form.location.value.trim();
      const requester_name = form.requester_name.value.trim();
      const urgency = form.urgency.value;
      
      // Validate required fields
      if (!description || !location || !requester_name || !urgency) {
        showMessage('form-message', 'Gelieve alle verplichte velden in te vullen.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Issue melden';
        // Reset photo handler on validation error
        if (window.photoHandler) window.photoHandler.clear();
        return;
      }
      
      // Get selected photos
      const selectedFiles = photoHandler.getFiles();
      
      // Validate photos
      const photoValidation = validatePhotos(selectedFiles);
      if (!photoValidation.valid) {
        showMessage('form-message', photoValidation.errors.join('\n'), 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Issue melden';
        return;
      }
      
      try {
        // Process photos for upload
        const processedPhotos = await processPhotosForUpload(selectedFiles);
        
        // Prepare task data for API
        const taskData = {
          description: description,
          location: location,
          requester_name: requester_name,
          urgency: urgency
        };
        
        // Use shared API layer
        const result = await createTask(taskData, processedPhotos);
        
        if (result && result.taskId) {
          showMessage('form-message', 'Uw rapport is ontvangen en toegevoegd aan de onderhoudslijst.', 'success');
          form.reset();
          // Clear photo handler
          if (window.photoHandler) window.photoHandler.clear();
          
          // Optionally, show the task ID
          const taskIdEl = document.createElement('p');
          taskIdEl.textContent = `Task ID: ${result.taskId}`;
          taskIdEl.style.marginTop = '1rem';
          taskIdEl.style.fontFamily = 'monospace';
          taskIdEl.style.fontSize = '0.85rem';
          formMessage.appendChild(taskIdEl);
        } else {
          throw new Error('Failed to submit report');
        }
      } catch (error) {
        console.error('Error submitting report:', error);
        
        let message = 'Uw rapport kon niet worden verzonden. Controleer uw internetverbinding en probeer het opnieuw.';
        if (error.message === 'AUTH_EXPIRED') {
          message = 'Uw sessie is verlopen. Gelieve opnieuw in te loggen.';
          // Redirect will be handled by auth module
          setTimeout(() => location.reload(), 2000);
        } else if (error.code) {
          message = `Fout: ${error.message}`;
        }
        
        showMessage('form-message', message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Issue melden';
      }
    });
  }
});