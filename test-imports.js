// test-imports.js - Test that all modules can be imported without syntax errors
try {
  console.log('Testing imports...');
  
  // Test utils
  const { getApiBaseUrl, validatePhotoFile, photoToBase64 } = require('./js/utils.js');
  console.log('✓ Utils imported successfully');
  
  // Test auth
  const { hasValidAuthToken, requireAuth } = require('./js/auth.js');
  console.log('✓ Auth imported successfully');
  
  // Test api
  const { fetchTasks, createTask, updateTask } = require('./js/api.js');
  console.log('✓ API imported successfully');
  
  // Test constants
  const { TASK_STATUSES, URGENCY_LEVELS } = require('./js/constants.js');
  console.log('✓ Constants imported successfully');
  
  // Test worker
  const worker = require('./js/worker.js');
  console.log('✓ Worker imported successfully');
  
  // Test staff
  const staff = require('./js/staff.js');
  console.log('✓ Staff imported successfully');
  
  console.log('All imports successful!');
} catch (error) {
  console.error('Import test failed:', error.message);
  process.exit(1);
}