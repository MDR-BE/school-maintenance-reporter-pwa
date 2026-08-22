// Staff interface logic for the Maintenance PWA

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('issueForm');
  const formMessage = document.getElementById('form-message');
  const cancelBtn = document.getElementById('cancelButton');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      form.reset();
      hideMessage('form-message');
      window.location.href = './index.html';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Show loading state
      const submitBtn = form.querySelector('.submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

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
        showMessage('form-message', 'Please fill in all required fields.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Issue melden';
        return;
      }

      try {
        // Prepare form data for submission (multipart/form-data for file upload)
        const formData = new FormData();
        formData.append('description', description);
        formData.append('requester_name', requester_name);
        formData.append('location', location);
        formData.append('required_materials', required_materials);
        formData.append('urgency', urgency);
        formData.append('status', status);
        if (photoInput) {
          formData.append('file', photoInput);
        }

        // Send to backend with auth token
        const apiUrl = getApiBaseUrl(); // from utils.js
        const token = getAuthToken(); // from auth.js
        
        const url = new URL(apiUrl);
        if (token) {
          url.searchParams.set('token', token);
        }
        
        const response = await fetch(url.toString(), {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (response.ok && result.success) {
          showMessage('form-message', 'Your report has been received and added to the maintenance list.', 'success');
          form.reset();
          // Optionally, show the task ID
          if (result.taskId) {
            const taskIdEl = document.createElement('p');
            taskIdEl.textContent = `Task ID: ${result.taskId}`;
            taskIdEl.style.marginTop = '1rem';
            formMessage.appendChild(taskIdEl);
          }
        } else {
          throw new Error(result.error || 'Failed to submit report');
        }
      } catch (error) {
        console.error('Error submitting report:', error);
        showMessage('form-message', 'Your report could not be sent. Please check your internet connection and try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Issue melden';
      }
    });
  }
});