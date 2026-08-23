// Response.gs - Standardized API response formatting

/**
 * Creates a successful response with CORS headers
 * @param {Object} data - Response data
 * @return {ContentService.TextOutput} JSON response
 */
function successResponse(data) {
  return addCorsHeaders(
    ContentService
      .createTextOutput(JSON.stringify({ success: true, data: data }))
      .setMimeType(ContentService.MimeType.JSON)
  );
}

/**
 * Creates an error response with CORS headers
 * @param {string} code - Error code from ERROR_CODES
 * @param {string} message - Human-readable error message
 * @param {number} httpStatus - HTTP status code (default 400)
 * @return {ContentService.TextOutput} JSON response
 */
function errorResponse(code, message, httpStatus = 400) {
  const output = ContentService
    .createTextOutput(JSON.stringify({ 
      success: false, 
      code: code, 
      error: message 
    }))
    .setMimeType(ContentService.MimeType.JSON);
  
  // Note: Apps Script Web Apps don't support setting HTTP status codes directly
  // The status will always be 200, but we include the code in the response body
  return addCorsHeaders(output);
}

/**
 * Adds CORS headers to a ContentService output
 * @param {ContentService.TextOutput} output
 * @return {ContentService.TextOutput}
 */
function addCorsHeaders(output) {
  try {
    if (output && typeof output.setHeader === 'function') {
      const origin = getFrontendOrigin();
      output.setHeader('Access-Control-Allow-Origin', origin);
      output.setHeader('Access-Control-Allow-Credentials', 'true');
      output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
  } catch (e) {
    // Silently fail - CORS headers are best effort
  }
  return output;
}

/**
 * Adds CORS headers to an HtmlService output (for login page)
 * @param {HtmlService.HtmlOutput} output
 * @return {HtmlService.HtmlOutput}
 */
function addCorsHeadersHtml(output) {
  try {
    if (output && typeof output.setHeader === 'function') {
      const origin = getFrontendOrigin();
      output.setHeader('Access-Control-Allow-Origin', origin);
      output.setHeader('Access-Control-Allow-Credentials', 'true');
      output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  } catch (e) {
    // Silently fail
  }
  return output;
}

/**
 * Gets the frontend origin for CORS
 * @return {string} Origin or * as fallback
 */
function getFrontendOrigin() {
  const frontendUrl = PropertiesService.getScriptProperties().getProperty(PROP.FRONTEND_URL) || '';
  try {
    const url = new URL(frontendUrl);
    return url.origin;
  } catch (_) {
    return '*'; // Fallback - less secure but functional
  }
}
