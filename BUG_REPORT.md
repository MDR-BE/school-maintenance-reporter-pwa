# Bug Report - Maintenance PWA

## Summary
Found **47 bugs** across the codebase ranging from CRITICAL security vulnerabilities to MEDIUM architectural issues.

---

## CRITICAL Bugs (Security)

### BUG-001: Plaintext Password Storage in Script Properties
- **SEVERITY:** CRITICAL
- **FILE:** `code/Code.gs` (lines 113-119)
- **CAUSE:** `setLoginPassword()` stores password in plaintext in Script Properties
- **FIX:** Store salted hash using `Utilities.computeDigest()`; compare hashes server-side
- **STATUS:** OPEN

### BUG-002: Hardcoded Default Password in initialize()
- **SEVERITY:** CRITICAL
- **FILE:** `code/Code.gs` (line 958)
- **CAUSE:** `initialize()` sets default password `'Welkom123!'` in plaintext
- **FIX:** Remove default; require admin to set password via secure setup function
- **STATUS:** OPEN

### BUG-003: No Server-Side Token Validation on Protected Endpoints
- **SEVERITY:** CRITICAL
- **FILE:** `code/Code.gs` (lines 362, 456)
- **CAUSE:** `checkAuth()` only validates token exists and not expired; no role-based authorization
- **FIX:** Implement role-based authorization (staff vs worker) on all protected endpoints
- **STATUS:** OPEN

### BUG-004: XSS via innerHTML with User Data (Multiple Locations)
- **SEVERITY:** CRITICAL
- **FILE:** `js/worker.js` (lines 133, 138)
- **CAUSE:** `locationP.innerHTML = \`<strong>Location:</strong> \${task.location}\`;` and similar for requester_name
- **FIX:** Use `textContent` or `createTextNode()` for user-controlled data
- **STATUS:** OPEN

### BUG-005: XSS in Notes Modal - User Data in innerHTML
- **SEVERITY:** CRITICAL
- **FILE:** `js/worker.js` (line 373)
- **CAUSE:** `<textarea>\${task.maintenance_notes || ''}</textarea>` - user notes injected as HTML
- **FIX:** Use `textContent` or `.value` for textarea
- **STATUS:** OPEN

### BUG-006: No Input Validation on Backend (createTask/updateTask)
- **SEVERITY:** CRITICAL
- **FILE:** `code/Code.gs` (lines 519-591, 800-872)
- **CAUSE:** No validation of description, location, urgency, status, materials, notes lengths or allowed values
- **FIX:** Implement server-side validation with explicit allowed values and max lengths
- **STATUS:** OPEN

### BUG-007: No LockService for Concurrent Sheet Writes
- **SEVERITY:** CRITICAL
- **FILE:** `code/Code.gs` (lines 768-792, 800-872)
- **CAUSE:** `createTask()` and `updateTask()` modify sheets without locking
- **FIX:** Wrap all sheet writes with `LockService.getScriptLock()`
- **STATUS:** OPEN

### BUG-008: CORS Preflight Failure with JSON POST
- **SEVERITY:** CRITICAL
- **FILE:** `js/api.js` (lines 38-40, 146-152, 164-170)
- **CAUSE:** Frontend sends `application/json` POST triggering CORS preflight; Apps Script cannot properly handle OPTIONS
- **FIX:** Use `application/x-www-form-urlencoded` or FormData for all POST requests
- **STATUS:** OPEN

---

## HIGH Bugs (Functional)

### BUG-009: Worker JS Variables Out of Scope
- **SEVERITY:** HIGH
- **FILE:** `js/worker.js` (lines 7-16, 47-70)
- **CAUSE:** `filterStatus`, `filterUrgency`, `filterLocation`, `taskListLoading`, `taskList`, `taskDetailContainer` declared inside DOMContentLoaded but used in `loadTasks()` outside
- **FIX:** Move declarations to module scope (top level), initialize in DOMContentLoaded
- **STATUS:** OPEN

### BUG-010: Duplicate showMessage/hideMessage Functions
- **SEVERITY:** HIGH
- **FILE:** `js/utils.js` (lines 19-36) AND `js/api.js` (lines 186-203)
- **CAUSE:** Same functions defined in two files
- **FIX:** Keep in `utils.js`, remove from `api.js`, update imports
- **STATUS:** OPEN

### BUG-011: No Token Expiration Check on Client Side
- **SEVERITY:** HIGH
- **FILE:** `js/auth.js` (lines 5-9)
- **CAUSE:** `hasValidAuthToken()` only checks existence, not expiration
- **FIX:** Store token with timestamp; validate client-side; auto-clear expired tokens
- **STATUS:** OPEN

### BUG-012: API Cache Not Invalidated After Mutations
- **SEVERITY:** HIGH
- **FILE:** `js/api.js` (lines 3, 176-178)
- **CAUSE:** `clearApiCache()` exists but never called after create/update/status change
- **FIX:** Call `clearApiCache()` after all mutating operations
- **STATUS:** OPEN

### BUG-013: Photo URLs Returned as Comma-Separated String
- **SEVERITY:** HIGH
- **FILE:** `code/Code.gs` (line 782, 913) and `js/worker.js` (lines 77-83)
- **CAUSE:** Backend stores/returns `photo_urls` as comma-separated; frontend parses with `split(',')`
- **FIX:** Return structured array `[{url, filename, id}]` consistently
- **STATUS:** OPEN

### BUG-014: Frontend Sends Token in Both URL and Body
- **SEVERITY:** HIGH
- **FILE:** `js/api.js` (lines 19-20)
- **CAUSE:** `url.searchParams.set('token', token)` AND token potentially in body
- **FIX:** Use only URL param for GET; for POST use form-urlencoded with token field
- **STATUS:** OPEN

### BUG-015: No Server-Side Task State Machine
- **SEVERITY:** HIGH
- **FILE:** `code/Code.gs` (lines 850-851)
- **CAUSE:** `updateTask()` allows any status transition (NEW → COMPLETED directly)
- **FIX:** Implement state machine with valid transitions only
- **STATUS:** OPEN

### BUG-016: No File Type/Size Validation for Photo Uploads
- **SEVERITY:** HIGH
- **FILE:** `js/api.js` (lines 101-124) and `code/Code.gs` (lines 531-555)
- **CAUSE:** No client or server validation of MIME type, file size, dimensions
- **FIX:** Add client-side validation (5MB, 1600px, JPEG/PNG) + server-side validation
- **STATUS:** OPEN

### BUG-017: No Image Resize/Compression Before Base64
- **SEVERITY:** HIGH
- **FILE:** `js/api.js` (lines 101-124)
- **CAUSE:** `photoToBase64()` converts full-resolution image to Base64 without processing
- **FIX:** Add canvas-based resize/compress before Base64 conversion
- **STATUS:** OPEN

### BUG-018: No Role-Based Access Control
- **SEVERITY:** HIGH
- **FILE:** `code/Code.gs` (throughout)
- **CAUSE:** No distinction between staff and worker permissions; all authenticated users can do everything
- **FIX:** Implement role check (staff can only create; workers can read/update)
- **STATUS:** OPEN

### BUG-019: Task ID Generation on Client Side
- **SEVERITY:** HIGH
- **FILE:** `code/Code.gs` (line 772)
- **CAUSE:** `createTask()` generates UUID server-side (good) but frontend could send its own
- **FIX:** Ensure server always generates ID; ignore any client-provided ID
- **STATUS:** OPEN

### BUG-020: Inconsistent Error Response Format
- **SEVERITY:** HIGH
- **FILE:** `code/Code.gs` (various)
- **CAUSE:** Some errors return `{error: "..."}`, others `{success: false, error: "..."}`
- **FIX:** Standardize to `{success: false, code: "ERROR_CODE", error: "Human message"}`
- **STATUS:** OPEN

### BUG-021: doGet action=get Fetches ALL Tasks Then Filters
- **SEVERITY:** HIGH
- **FILE:** `code/Code.gs` (lines 389-390)
- **CAUSE:** `getTasks({}, 1)` gets all tasks then `.find()` - inefficient
- **FIX:** Add direct ID lookup in `getTasks()` or separate function
- **STATUS:** OPEN

### BUG-022: Service Worker Caches API Responses Incorrectly
- **SEVERITY:** HIGH
- **FILE:** `js/service-worker.js` (lines 29-70)
- **CAUSE:** Network-first for HTML/JS but cache-first for "other assets" - API requests could be cached
- **FIX:** Explicitly exclude Apps Script URLs from caching; only cache static assets
- **STATUS:** OPEN

---

## MEDIUM Bugs (Architecture/Quality)

### BUG-023: No ES Modules - Implicit Globals
- **SEVERITY:** MEDIUM
- **FILE:** All JS files
- **CAUSE:** Scripts loaded via `<script src="">` creating implicit globals
- **FIX:** Convert to ES modules with `<script type="module">` and explicit imports/exports
- **STATUS:** OPEN

### BUG-024: Inconsistent API Request Format (GET vs POST)
- **SEVERITY:** MEDIUM
- **FILE:** `js/api.js` (lines 75-83, 91-93, 132-153, 161-171)
- **CAUSE:** GET uses URLSearchParams; POST uses JSON body; no consistent pattern
- **FIX:** Use form-urlencoded for all requests; consistent parameter passing
- **STATUS:** OPEN

### BUG-025: Hardcoded API URL in utils.js
- **SEVERITY:** MEDIUM
- **FILE:** `js/utils.js` (line 11)
- **CAUSE:** `getApiBaseUrl()` returns hardcoded placeholder URL
- **FIX:** Use environment variable or config; document deployment steps
- **STATUS:** OPEN

### BUG-026: Login Modal Created on Every Page Load Without Auth
- **SEVERITY:** MEDIUM
- **FILE:** `js/auth.js` (lines 27-93)
- **CAUSE:** `requireAuth()` creates DOM modal every time; no singleton pattern
- **FIX:** Create modal once; show/hide; or redirect to login page
- **STATUS:** OPEN

### BUG-027: No Logout Functionality
- **SEVERITY:** MEDIUM
- **FILE:** `js/auth.js` (line 22-24)
- **CAUSE:** `clearAuthToken()` exists but no UI to call it
- **FIX:** Add logout button in worker/staff interfaces
- **STATUS:** OPEN

### BUG-028: updateTaskStatus Reopens Completed as 'New'
- **SEVERITY:** MEDIUM
- **FILE:** `js/worker.js` (line 279)
- **CAUSE:** Reopening completed task sets status to 'New' instead of 'In progress'
- **FIX:** Reopen to 'In progress' per state machine
- **STATUS:** OPEN

### BUG-029: Photo Folder Structure Not Year-Based
- **SEVERITY:** MEDIUM
- **FILE:** `code/Code.gs` (lines 77-90)
- **CAUSE:** `getPhotoFolder()` creates single folder `Klusjes_Photos` without year subfolders
- **FIX:** Implement `Maintenance PWA/YYYY/task-UUID/` structure
- **STATUS:** OPEN

### BUG-030: Sheet Headers Created Only Once (No Migration)
- **SEVERITY:** MEDIUM
- **FILE:** `code/Code.gs` (lines 52-67)
- **CAUSE:** New sheets get headers but existing sheets with old schema not migrated
- **FIX:** Add schema migration logic or version check
- **STATUS:** OPEN

### BUG-031: Task List Pagination Offset Logic Bug
- **SEVERITY:** MEDIUM
- **FILE:** `code/Code.gs` (lines 937-944)
- **CAUSE:** `if (offset && tasks.length <= offset)` logic is wrong - pops after adding
- **FIX:** Fix offset/limit logic to properly skip and limit
- **STATUS:** OPEN

### BUG-032: No Maximum Photo Count Enforcement
- **SEVERITY:** MEDIUM
- **FILE:** `js/staff.js` (line 32) and `code/Code.gs` (lines 531-555)
- **CAUSE:** Staff can select multiple files but no limit enforced
- **FIX:** Limit to 3 photos per task (client + server)
- **STATUS:** OPEN

### BUG-033: Missing Content Security Policy
- **SEVERITY:** MEDIUM
- **FILE:** All HTML files
- **CAUSE:** No CSP headers; inline scripts/styles used
- **FIX:** Add CSP meta tag; move inline scripts to external files
- **STATUS:** OPEN

### BUG-034: No HTTPS Enforcement Check
- **SEVERITY:** MEDIUM
- **FILE:** `js/utils.js` (line 11)
- **CAUSE:** API URL could be HTTP in development
- **FIX:** Enforce HTTPS in production; document requirement
- **STATUS:** OPEN

### BUG-035: Inconsistent Status/Urgency Values (Dutch vs English)
- **SEVERITY:** MEDIUM
- **FILE:** Multiple
- **CAUSE:** Frontend uses English (New/Normal), backend maps to/from Dutch
- **FIX:** Define canonical values in one place; use consistently
- **STATUS:** OPEN

### BUG-036: Debug Logging in Production Code
- **SEVERITY:** MEDIUM
- **FILE:** `code/Code.gs` (lines 541, 542, etc.)
- **CAUSE:** `console.error()` calls in Apps Script (goes to Stackdriver)
- **FIX:** Use proper logging levels; remove debug statements
- **STATUS:** OPEN

### BUG-037: HTML Files Reference Non-Existent Assets
- **SEVERITY:** MEDIUM
- **FILE:** `manifest.json` (lines 11, 16)
- **CAUSE:** Icons referenced at `./assets/icon-192.png` but assets folder doesn't exist
- **FIX:** Create assets folder with icons or update manifest
- **STATUS:** OPEN

---

## LOW Bugs (Polish/Maintainability)

### BUG-038: Unused Multipart Parser Code
- **SEVERITY:** LOW
- **FILE:** `code/Code.gs` (lines 596-600)
- **CAUSE:** Commented placeholder for multipart parsing that's never used
- **FIX:** Remove or implement
- **STATUS:** OPEN

### BUG-039: copySheetFormatting Unused
- **SEVERITY:** LOW
- **FILE:** `code/Code.gs` (lines 609-679)
- **CAUSE:** Function defined but never called
- **FIX:** Call when creating new quarter sheets or remove
- **STATUS:** OPEN

### BUG-040: createNewQuarterSheet Not Implemented
- **SEVERITY:** LOW
- **FILE:** `code/Code.gs` (not found)
- **CAUSE:** Referenced in docs but function doesn't exist
- **FIX:** Implement quarterly sheet rotation logic
- **STATUS:** OPEN

### BUG-041: No Client-Side Form Validation for Photo
- **SEVERITY:** LOW
- **FILE:** `js/staff.js` (line 32)
- **CAUSE:** Photo input accepts any file type/size
- **FIX:** Add accept attribute validation + JS check
- **STATUS:** OPEN

### BUG-042: Worker Interface Missing "Open Task" Click Handler
- **SEVERITY:** LOW
- **FILE:** `js/worker.js` (lines 100-178)
- **CAUSE:** Task items have action buttons but clicking the card doesn't open detail
- **FIX:** Add click handler on task item (not buttons) to open detail
- **STATUS:** OPEN

### BUG-043: Inconsistent Date Formatting
- **SEVERITY:** LOW
- **FILE:** `js/utils.js` (lines 55-59) and `js/worker.js` (line 212)
- **CAUSE:** `formatDateTime()` uses `toLocaleString()` - inconsistent across locales
- **FIX:** Use explicit format (ISO or configured locale)
- **STATUS:** OPEN

### BUG-044: No Loading State for Photo Uploads
- **SEVERITY:** LOW
- **FILE:** `js/staff.js` (lines 21-23, 54)
- **CAUSE:** Submit button shows loading but no progress for photo conversion
- **FIX:** Add progress indicator for photo processing
- **STATUS:** OPEN

### BUG-045: Service Worker Version Hardcoded
- **SEVERITY:** LOW
- **FILE:** `js/service-worker.js` (line 2)
- **CAUSE:** `CACHE_NAME = 'maintenance-pwa-cache-v2'` - manual version bump needed
- **FIX:** Automate version from package.json or build process
- **STATUS:** OPEN

### BUG-046: No Offline Fallback Page
- **SEVERITY:** LOW
- **FILE:** `js/service-worker.js`
- **CAUSE:** No offline.html cached for when network fails
- **FIX:** Add offline fallback page to cache
- **STATUS:** OPEN

### BUG-047: Mixed Language in Code (Dutch/English)
- **SEVERITY:** LOW
- **FILE:** Multiple
- **CAUSE:** Comments, variable names, error messages mixed Dutch/English
- **FIX:** Standardize to English for code; Dutch only for user-facing strings
- **STATUS:** OPEN

---

## Summary by Severity
| Severity | Count |
|----------|-------|
| CRITICAL | 8     |
| HIGH     | 14    |
| MEDIUM   | 15    |
| LOW      | 10    |
| **Total** | **47** |

---

## Root Cause Categories
1. **Security (8)**: Auth, validation, XSS, CORS
2. **Scope/Architecture (6)**: JS scope, modules, globals
3. **Data Integrity (5)**: Race conditions, ID generation, state machine
4. **API Design (5)**: Inconsistent formats, caching, errors
5. **Photo Handling (4)**: Validation, compression, format, storage
6. **UI/UX (5)**: Missing features, inconsistent behavior
7. **Code Quality (8)**: Duplication, dead code, logging, mixed language
8. **PWA/Offline (4)**: Caching, versioning, offline support
9. **Deployment/Config (2)**: Hardcoded URLs, missing assets