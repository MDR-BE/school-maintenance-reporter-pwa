// Staff interface logic for the Maintenance PWA

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('report-form');
  const formMessage = document.getElementById('form-message');
  const cancelBtn = document.getElementById('cancel-btn');

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
      const location = form.location.value.trim();
      const urgency = form.urgency.value;
      const photoInput = form.photo.files[0]; // File object

      // Validate
      if (!description || !location || !urgency) {
        showMessage('form-message', 'Please fill in all required fields.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Report Problem';
        return;
      }

      try {
        // Prepare form data for submission
        const formData = new FormData();
        formData.append('description', description);
        formData.append('location', location);
        formData.append('urgency', urgency);
        if (photoInput) {
          formData.append('file', photoInput);
        }

        // Send to backend
        const apiUrl = getApiBaseUrl(); // from utils.js
        const response = await fetch(apiUrl, {
          method: 'POST',
          credentials: 'include',
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
        submitBtn.textContent = 'Report Problem';
      }
    });
  }
});

// Helper function to hide message (defined in utils.js, but we can use it if loaded)
// We assume utils.js is loaded before this script.