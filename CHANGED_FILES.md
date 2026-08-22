# Changed Files Summary

This document lists all files that were created or modified during the refactoring, with descriptions of changes.

---

## Backend (Google Apps Script) - `/code/`

### Config.gs (NEW)
**Purpose**: Centralized configuration constants
**Changes**:
- Extracted all configuration from monolithic Code.gs
- Column indices (COL object) for sheet access by index
- Sheet headers, Drive folder names, property keys
- Validation constants (VALID_URGENCIES, VALID_STATUSES)
- Dutch ↔ English mappings for urgency/status
- State machine transitions (VALID_TRANSITIONS)
- Limits (photos, file sizes, field lengths)
- Error codes (ERROR_CODES)

### Response.gs (NEW)
**Purpose**: Standardized API response formatting
**Changes**:
- `successResponse(data)` - consistent success format
- `errorResponse(code, message, httpStatus)` - consistent error format
- `addCorsHeaders(output)` - CORS for ContentService
- `addCorsHeadersHtml(output)` - CORS for HtmlService
- `getFrontendOrigin()` - gets origin from Script Properties

### Validation.gs (NEW)
**Purpose**: Server-side input validation
**Changes**:
- `validateTaskCreate(input)` - validates all task creation fields
- `validateTaskUpdate(input, existingTask)` - validates updates with state machine
- `validatePhoto(photo)` - validates photo objects (type, size, base64)
- `sanitizeString(str)` - removes control characters
- `isValidTaskId(taskId)` - UUID v4 validation
- Max length enforcement on all text fields
- Explicit allowed values for urgency/status

### Auth.gs (NEW)
**Purpose**: Authentication and authorization
**Changes**:
- `hashPassword(password, salt)` - SHA-256 with 10000 iterations
- `verifyPassword(password, hash, salt)` - constant-time comparison
- `setLoginPassword(password)` - stores hash+salt (NOT plaintext)
- `validateLogin(password)` - returns token on success
- `createToken()` / `storeToken()` / `isValidToken()` / `removeToken()`
- `getAuthTokenFromRequest(e)` - extracts from query param or cookie
- `checkAuth(e)` - validates token
- `isWorker(e)` / `canCreateTask(e)` - role-based authorization
- Login page HTML with form-urlencoded POST (no CORS preflight)

### Photos.gs (NEW)
**Purpose**: Photo upload and Drive management
**Changes**:
- `getPhotoFolderForYear(year)` - year-based folder structure
- `getOrCreateRootFolder()` - root "Maintenance PWA" folder
- `uploadPhotos(photos, taskId)` - uploads to `Maintenance PWA/YYYY/task-UUID/`
- `deleteTaskPhotos(taskId, year)` - cleanup
- `getTaskPhotosFromDrive(taskId, year)` - reconstruct from Drive
- `parsePhotoUrls(str)` - handles both JSON array and comma-separated
- `serializePhotos(photos)` - JSON array for sheet storage

### Tasks.gs (NEW)
**Purpose**: Task CRUD, state machine, sheet management
**Changes**:
- `getActiveSheet()` - finds latest `klusjes DDMMYYYY` sheet
- `createNewQuarterSheet()` - quarterly rotation with unfinished task copy
- `copySheetFormatting()` - preserves column widths, frozen rows, validation, formatting
- `createTask(taskData, photos)` - with LockService, generates UUID, timestamps
- `getTaskById(taskId)` - efficient single-task lookup
- `getTasks(filters, limit, offset)` - filtered, paginated, newest-first
- `mapRowToTask(row, headerIndices)` - Dutch → English mapping
- `updateTask(taskId, updates)` - with LockService, state machine validation
- `addPhotosToTask(taskId, photos)` - append photos to existing task
- `getTaskCounts()` - dashboard counts by status

### Code.gs (REWRITTEN)
**Purpose**: Main router (doGet/doPost)
**Changes**:
- Reduced from 961 lines to ~250 lines (router only)
- `doGet(e)` - routes: login, list, get, counts (all with auth)
- `doPost(e)` - routes: validate, create, update, upload_photos
- `parseFormData(data)` - form-urlencoded parser
- `initialize()` - setup function (sets worker email, password, frontend URL)
- `changeLoginPassword(newPassword)` - helper to update password
- `testSetup()` - comprehensive test function
- All responses use standardized format from Response.gs
- All mutations use LockService
- All inputs validated via Validation.gs
- State machine enforced in updateTask

---

## Frontend - `/js/`

### utils.js (REWRITTEN as ES Module)
**Purpose**: Shared utilities
**Changes**:
- Converted to ES module (`export` functions)
- `getApiBaseUrl()` - placeholder for Apps Script URL
- `generateUuid()` - UUID generation
- `formatDateTime(isoString)` - localized formatting
- `debounce(func, wait)` - rate limiting
- `escapeHtml(str)` - XSS prevention
- `safeSetText(element, text)` - XSS-safe textContent
- `createSafeElement(tag, text, attributes)` - safe element creation
- `showMessage()` / `hideMessage()` - unified (removed duplicate from api.js)
- `validatePhotoFile(file)` - client-side validation
- `processImage(file, options)` - canvas resize/compress (1600px, 0.75 quality)
- `photoToBase64(file)` - async processed base64
- `parsePhotoData(photoData)` - handles both JSON array and comma-separated

### auth.js (REWRITTEN as ES Module)
**Purpose**: Authentication state management
**Changes**:
- Converted to ES module
- `TOKEN_EXPIRY_KEY` - stores expiry timestamp
- `hasValidAuthToken()` - checks existence AND expiry
- `getAuthToken()` / `setAuthToken()` / `clearAuthToken()`
- `validateTokenWithServer()` - optional server validation
- `requireAuth()` - returns Promise, shows login modal if needed
- `showLoginModal()` - Promise-based, form-urlencoded POST
- `logout()` - clears token, reloads
- `getTokenExpiry()` / `getTokenRemainingTime()` - token info

### api.js (REWRITTEN as ES Module)
**Purpose**: API client (form-urlencoded, no CORS preflight)
**Changes**:
- Converted to ES module
- `apiFetch()` - uses form-urlencoded for ALL requests
- Token in query param only (not in body)
- Cache with 30s TTL for GET requests
- `clearApiCache()` - exported for cache invalidation
- `fetchTasks()` / `fetchTask()` / `fetchTaskCounts()` - GET with caching
- `createTask()` - POST form-urlencoded with processed photos
- `updateTask()` - POST form-urlencoded
- `uploadPhotos()` - POST form-urlencoded
- Standardized error handling with error codes

### staff.js (REWRITTEN as ES Module)
**Purpose**: Staff reporting interface
**Changes**:
- Converted to ES module
- `await requireAuth()` - enforces auth on load
- Logout button added to header
- Photo preview with validation
- Form validation (required fields, photo type/size)
- Uses `createTask()` from api.js
- Processes photos client-side (resize/compress)
- Error handling with user-friendly messages
- Auth expiry handling (auto-reload)

### worker.js (REWRITTEN as ES Module)
**Purpose**: Worker dashboard interface
**Changes**:
- Converted to ES module
- **FIXED**: Module-level variables (filterStatus, filterUrgency, etc.) - no more scope bugs
- `await requireAuth()` - enforces auth on load
- Logout button handler
- Click handler on task cards (opens detail) - buttons don't trigger
- `loadTasks()` / `renderTaskList()` - uses safe element creation
- `openTaskDetail(taskId)` - uses cached tasks when possible
- `showTaskDetail(task)` - XSS-safe (textContent, no innerHTML)
- `showStatusUpdateModal()` / `showNotesModal()` / `showPhotosModal()` - safe DOM creation
- `updateTaskStatus()` / `updateTaskNotes()` - calls clearApiCache() after mutations
- State machine respected (reopen → "In progress")
- Debounced filter inputs (via utils.debounce)

### main.js (UPDATED as ES Module)
**Purpose**: App entry point
**Changes**:
- Converted to ES module
- Service worker registration
- Role selection only (no auth required on index.html)

### photos.js (NEW ES Module)
**Purpose**: Photo handling utilities
**Changes**:
- `createPhotoHandler()` - drag/drop, preview, remove, camera capture
- `processPhotosForUpload()` - batch process multiple files
- `createCameraCapture()` - mobile camera integration
- `validatePhotos()` - array validation
- `LIMITS` - shared constants

### service-worker.js (UPDATED)
**Purpose**: PWA offline caching
**Changes**:
- Version bumped to `v3`
- `API_URL_PATTERN` - excludes Apps Script URLs from caching
- Network-only for API requests
- Network-first for HTML/JS/CSS
- Cache-first for images/fonts
- Old cache cleanup on activate

---

## HTML Files (UPDATED)

### index.html
- Changed `<script src="">` to `<script type="module" src="js/main.js">`

### staff.html
- Changed to `<script type="module" src="js/staff.js">`
- Added photo preview container
- Updated photo accept attribute: `image/jpeg,image/png,image/webp`

### worker.html
- Changed to `<script type="module" src="js/worker.js">`
- Added logout button in header
- Improved task detail header layout

---

## Documentation (NEW)

### BUG_REPORT.md
- 47 bugs documented with severity, file, cause, fix, status
- 8 CRITICAL, 14 HIGH, 15 MEDIUM, 10 LOW

### ARCHITECTURE_REPORT.md
- Current architecture analysis
- Problems identified
- Final target architecture
- Responsibility split
- Authentication flow
- API flow (CORS-safe)
- Data flow (task lifecycle)
- Photo flow
- API contract (endpoints, error codes)
- Deployment configuration
- Migration path
- Remaining risks
- Success criteria

### DEPLOYMENT_INSTRUCTIONS.md
- Step-by-step deployment guide
- Google Apps Script setup
- Google Sheets/Drive setup
- GitHub Pages deployment
- Testing checklist
- Maintenance procedures
- Troubleshooting table
- Security notes

### CHANGED_FILES.md (this file)

---

## Summary Statistics

| Category | Files Created | Files Modified | Files Deleted |
|----------|--------------|----------------|---------------|
| Backend (.gs) | 6 (Config, Response, Validation, Auth, Photos, Tasks) | 1 (Code.gs) | 0 |
| Frontend (.js) | 1 (photos.js) | 6 (utils, auth, api, staff, worker, main, sw) | 0 |
| HTML | 0 | 3 (index, staff, worker) | 0 |
| Documentation | 4 | 0 | 0 |
| **Total** | **11** | **10** | **0** |

---

## Key Improvements

1. **Security**: Password hashing, server-side validation, XSS prevention, LockService
2. **CORS**: Form-urlencoded eliminates preflight issues
3. **Architecture**: Modular backend (7 files), ES modules frontend (8 files)
4. **Scope Bugs**: Fixed all worker.js variable scope issues
5. **Duplicates**: Removed duplicate showMessage/hideMessage
6. **State Machine**: Enforced valid status transitions
7. **Photo Handling**: Client-side resize/compress, structured JSON format
8. **Drive Structure**: Year-based folders `Maintenance PWA/YYYY/task-UUID/`
9. **Cache Invalidation**: Automatic after all mutations
10. **Auth**: Token expiry client-side, server-enforced, logout UI
11. **PWA**: Service worker v3, API excluded from cache, proper versioning