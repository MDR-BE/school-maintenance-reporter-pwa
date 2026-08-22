// Main JavaScript for the Maintenance PWA
// Handles role selection and routing between staff and worker interfaces.

document.addEventListener('DOMContentLoaded', () => {
  const staffBtn = document.getElementById('staff-btn');
  const workerBtn = document.getElementById('worker-btn');

  if (staffBtn) {
    staffBtn.addEventListener('click', () => {
      window.location.href = './staff.html';
    });
  }

  if (workerBtn) {
    workerBtn.addEventListener('click', () => {
      window.location.href = './worker.html';
    });
  }

  // Check if the app is installed in standalone mode (PWA)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    // App is running as a standalone PWA
    document.documentElement.classList.add('standalone');
  }
});