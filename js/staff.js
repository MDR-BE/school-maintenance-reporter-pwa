// staff.js - Staff interface logic for the Maintenance PWA (ES Module)

import { createTask, validatePhotoFile, processImage } from './api.js';
import { showMessage, hideMessage, escapeHtml } from './utils.js';
import { requireAuth, logout } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Require authentication
  await requireAuth();
  
  const form = document.getElementById('issueForm');
  const formMessage = document.getElementById('form-message');
  const cancelBtn = document.getElementById('cancelButton');
  const photoInput = document.getElementById('photo');
  const photoPreview = document.getElementById('photo-preview');

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
      if (photoPreview) photoPreview.innerHTML = '';
      window.location.href = './index.html';
    });
  }

  // Photo preview
  if (photoInput && photoPreview) {
    photoInput.addEventListener('change', (e) => {
      photoPreview.innerHTML = '';
      const file = e.target.files[0];
      if (file) {
        const validation = validatePhotoFile(file);
        if (!validation.valid) {
          showMessage('form-message', validation.error, 'error');
          photoInput.value = '';
          return;
        }
        
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.maxWidth = '100%';
        img.style.maxHeight = '200px';
        img.style.borderRadius = '4px';
        img.style.border = '1px solid #ddd';
        photoPreview.appendChild(img);
      }
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
      const requester_name = form.requester_name.value.trim();
      const location = form.location.value.trim();
      const required_materials = form.required_materials.value.trim();
      const urgency = form.urgency.value;
      const status = form.status.value;
      const photoInput = form.photo.files[0]; // File object

      // Validate required fields
      if (!description || !requester_name || !location || !urgency) {
        showMessage('form-message', 'Gelieve alle verplichte velden in te vullen.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Issue melden';
        return;
      }

      // Validate photo if provided
      let photos = [];
      if (photoInput) {
        const validation = validatePhotoFile(photoInput);
        if (!validation.valid) {
          showMessage('form-message', validation.error, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Issue melden';
          return;
        }
        photos = [photoInput];
      }

      try {
        // Prepare task data for API
        const taskData = {
          description: description,
          requester_name: requester_name,
          location: location,
          required_materials: required_materials,
          urgency: urgency,
          status: status
        };

        // Use shared API layer
        const result = await createTask(taskData, photos);

        if (result && result.taskId) {
          showMessage('form-message', 'Uw rapport is ontvangen en toegevoegd aan de onderhoudslijst.', 'success');
          form.reset();
          if (photoPreview) photoPreview.innerHTML = '';
          
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