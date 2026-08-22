# Architecture Report - Maintenance PWA

## 1. Current Architecture

### 1.1 System Overview
```
┌─────────────────────────────────────────────────────────────────────┐
│                        GITHUB / GITHUB PAGES                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  index.html │  │ staff.html  │  │ worker.html │  │ manifest   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │
│         │                │                │                │         │
│         └────────────────┼────────────────┼────────────────┘         │
│                          ▼                ▼                          │
│                   ┌─────────────┐  ┌─────────────┐                   │
│                   │   /js/      │  │  /css/      │                   │
│                   │ main.js     │  │  styles.css │                   │
│                   │ auth.js     │  └─────────────┘                   │
│                   │ api.js      │                                    │
│                   │ staff.js    │                                    │
│                   │ worker.js   │                                    │
│                   │ utils.js    │                                    │
│                   │ sw.js       │                                    │
│                   └─────────────┘                                    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS (JSON POST)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     GOOGLE APPS SCRIPT (Web App)                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Code.gs (961 lines - monolithic)                            │    │
│  │  • doGet(e) - Router + Auth + Actions (list, get, login)    │    │
│  │  • doPost(e) - Router + Auth + Actions (validate, create,   │    │
│  │           update)                                            │    │
│  │  • Config & Constants                                        │    │
│  │  • Auth Helpers (token, password, CORS)                     │    │
│  │  • Sheet Helpers (getActiveSheet, createTask, updateTask,   │    │
│  │    getTasks, mapping functions)                              │    │
│  │  • Drive Helpers (getPhotoFolder)                            │    │
│  │  • Sheet Formatting Helpers (copySheetFormatting - unused)   │    │
│  │  • Initialization (initialize)                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
┌─────────────────────────────┐         ┌─────────────────────────────┐
│      GOOGLE SHEETS          │         │      GOOGLE DRIVE           │
│  Spreadsheet:               │         │  Folder: Klusjes_Photos/    │
│  1HtYJqAWengq_wvEbt2SE...   │         │  (flat, no year subfolders) │
│  Sheets: klusjes DDMMYYYY   │         │  Files stored directly      │
│  Columns: 0-11 (Dutch)      │         │                             │
└─────────────────────────────┘         └─────────────────────────────┘
```

### 1.2 Frontend Architecture
- **Entry Point**: `index.html` → role selection → `staff.html` or `worker.html`
- **Script Loading**: Traditional `<script src="">` (no modules)
- **Global Namespace Pollution**: All functions/variables leak to `window`
- **Shared State**: `apiCache` Map in `api.js`, `currentTasks` array in `worker.js`
- **Authentication**: `auth.js` runs `requireAuth()` on every page load
- **API Layer**: `api.js` provides `apiFetch()`, `fetchTasks()`, `fetchTask()`, `createTask()`, `updateTask()`, `photoToBase64()`

### 1.3 Backend Architecture (Google Apps Script)
- **Single File**: `Code.gs` (961 lines) - no separation of concerns
- **Router**: `doGet()` / `doPost()` with `action` parameter
- **Authentication**: Token-based with 15-min TTL stored in Script Properties
- **Password**: Plaintext in Script Properties (CRITICAL bug)
- **CORS**: Attempts to add headers but Apps Script limitations make this unreliable
- **Sheet Access**: Column-index based (resilient to header changes)
- **Photo Storage**: Base64 → Blob → Drive folder → URL stored in sheet
- **Data Mapping**: Dutch ↔ English conversion on read/write

### 1.4 Data Flow

#### Task Creation (Staff)
```
Staff Form → staff.js.createTask() → api.js.createTask() 
  → photoToBase64() → JSON POST → Apps Script doPost(action=create)
  → Base64 decode → Drive folder.createFile() → getUrl()
  → Sheet.appendRow() → return {success: true, taskId}
```

#### Task Listing (Worker)
```
worker.js.loadTasks() → api.js.fetchTasks() → GET ?action=list&filters
  → Apps Script doGet(action=list) → getTasks() → map Dutch→English
  → return tasks[] → worker.js.renderTaskList()
```

#### Task Update (Worker)
```
worker.js.updateTaskStatus() → api.js.updateTask() → POST ?action=update&id
  → Apps Script doPost(action=update) → updateTask() → Sheet.setValues()
  → return {success: true}
```

---

## 2. Problems with Current Architecture

### 2.1 Critical Security Flaws
| Problem | Impact |
|---------|--------|
| Plaintext password in Script Properties | Full system compromise if Script Properties accessed |
| No server-side validation | Injection, data corruption, logic bypass |
| No LockService | Race conditions on concurrent writes |
| XSS via innerHTML | User data executed as code |
| No role-based auth | Staff can access worker functions |
| CORS preflight failures | API unreliable cross-origin |

### 2.2 Architectural Issues
| Problem | Impact |
|---------|--------|
| Monolithic Code.gs (961 lines) | Unmaintainable, hard to test, no separation |
| No ES modules | Global namespace pollution, implicit dependencies |
| Inconsistent API format | JSON POST triggers CORS; GET uses URL params |
| Client-side token validation only | Expired tokens accepted until server rejects |
| No cache invalidation | Stale data after mutations |
| Comma-separated photo URLs | Fragile parsing, no metadata |

### 2.3 Functional Gaps
| Missing Feature | Required By |
|-----------------|-------------|
| Task state machine | Phase 11 |
| Photo validation/compression | Phase 12 |
| Year-based Drive folders | Phase 14 |
| Quarterly sheet rotation | Phase 15 |
| Proper error codes | Phase 19 |
| Offline fallback | Phase 20 |
| Logout functionality | Phase 3 |

### 2.4 Google Apps Script Limitations Hit
1. **CORS Preflight**: Apps Script Web Apps don't properly handle OPTIONS requests
2. **Execution Time**: 6 min limit - large photo uploads may timeout
3. **Payload Size**: ~50MB limit for POST - Base64 increases size 33%
4. **Concurrent Executions**: 30 concurrent limit - LockService essential
5. **Properties Service**: 9MB total, 9KB per property - token storage OK but limited

---

## 3. Final Architecture (Target)

### 3.1 Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────────┐
│                         GITHUB / GITHUB PAGES                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  / (root)                                                    │   │
│  │  ├── index.html         # Role selection                     │   │
│  │  ├── staff.html         # Staff reporting interface          │   │
│  │  ├── worker.html        # Worker dashboard                   │   │
│  │  ├── manifest.json      # PWA manifest                       │   │
│  │  ├── service-worker.js  # Offline caching (v3+)              │   │
│  │  ├── /css/                                                         │   │
│  │  │   └── styles.css                                              │   │
│  │  ├── /js/ (ES Modules)                                          │   │
│  │  │   ├── main.js        # Bootstrapping, routing              │   │
│  │  │   ├── auth.js        # Auth state, login, token mgmt       │   │
│  │  │   ├── api.js         # API client (form-urlencoded)        │   │
│  │  │   ├── staff.js       # Staff form logic                    │   │
│  │  │   ├── worker.js      # Worker dashboard logic              │   │
│  │  │   ├── photos.js      # Photo capture, resize, compress     │   │
│  │  │   └── utils.js       # Shared utilities (formatDate, UUID) │   │
│  │  └── /assets/                                                    │   │
│  │      ├── icon-192.png                                          │   │
│  │      └── icon-512.png                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS (form-urlencoded)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GOOGLE APPS SCRIPT (Web App)                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  /code/                                                    │   │
│  │  ├── Code.gs          # Router only (doGet/doPost)         │   │
│  │  ├── Auth.gs          # Authentication & authorization      │   │
│  │  ├── Tasks.gs         # Task CRUD, state machine            │   │
│  │  ├── Photos.gs        # Photo upload, Drive management      │   │
│  │  ├── Validation.gs    # Input validation, sanitization      │   │
│  │  ├── Response.gs      # Standardized response format        │   │
│  │  └── Config.gs        # Constants, sheet/Drive config       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
┌─────────────────────────────┐         ┌─────────────────────────────┐
│      GOOGLE SHEETS          │         │      GOOGLE DRIVE           │
│  Spreadsheet:               │         │  Folder:                    │
│  1HtYJqAWengq_wvEbt2SE...   │         │  Maintenance PWA/           │
│  Sheets: klusjes DDMMYYYY   │         │  ├── 2026/                  │
│  Columns (by index):        │         │  │   ├── task-UUID-1/       │
│  0: description             │         │  │   ├── task-UUID-2/       │
│  1: requester_name          │         │  │   └── ...                │
│  2: location                │         │  └── 2027/                  │
│  3: required_materials      │         │      └── ...                │
│  4: urgency (Dutch)         │         │                             │
│  5: status (Dutch)          │         │  Files: {taskId}-{n}.jpg    │
│  6: photo_urls (JSON)       │         │                             │
│  7: maintenance_notes       │         │  Metadata in sheet          │
│  8: created_at (ISO)        │         │                             │
│  9: updated_at (ISO)        │         │                             │
│  10: completed_at (ISO)     │         │                             │
│  11: task_id (UUID)         │         │                             │
└─────────────────────────────┘         └─────────────────────────────┘
```

### 3.2 Frontend Responsibilities
| Module | Responsibility |
|--------|----------------|
| `main.js` | App bootstrap, PWA install prompt, role routing |
| `auth.js` | Token storage, expiration check, login modal, logout |
| `api.js` | All API communication (form-urlencoded), caching, errors |
| `staff.js` | Form handling, validation, photo capture, submission |
| `worker.js` | Task list, filters, detail view, status/notes/photo modals |
| `photos.js` | Camera/file input, resize (1600px), compress (0.75), Base64 |
| `utils.js` | Date formatting, UUID, debounce, DOM helpers, sanitize |

### 3.3 Backend Responsibilities (Apps Script)

| Module | Responsibility |
|--------|----------------|
| `Code.gs` | `doGet`/`doPost` routing, CORS headers |
| `Auth.gs` | Token create/validate/expire, password hash, role check |
| `Tasks.gs` | `createTask`, `getTask`, `getTasks`, `updateTask`, state machine |
| `Photos.gs` | `uploadPhotos`, `getPhotoFolder(year)`, Drive structure |
| `Validation.gs` | `validateTaskInput`, `validatePhoto`, `sanitizeInput` |
| `Response.gs` | `success(data)`, `error(code, message)`, `cors(output)` |
| `Config.gs` | Sheet ID, column indices, allowed values, limits |

### 3.4 Authentication Flow
```
User opens PWA
       │
       ▼
┌──────────────────┐
│ Check localStorage│
│ for token + expiry│
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
   YES        NO
    │         │
    ▼         ▼
┌─────────┐  Show login modal
│ Validate │  (POST ?action=validate)
│ token   │       │
│ server  │       ▼
└────┬────┘  Apps Script validates
     │      password hash
  ┌──┴──┐
  │     │
VALID  INVALID
  │     │
  ▼     ▼
 App   Clear token
       Show error
```

### 3.5 API Flow (CORS-Safe)
```
┌─────────────┐     form-urlencoded      ┌──────────────┐
│  Browser    │ ──────────────────────▶ │ Apps Script  │
│  (Client)   │  action=xxx&token=yyy    │ (Web App)    │
└─────────────┘   (no CORS preflight)   └──────┬───────┘
                                                │
                                                ▼
                                         ┌──────────────┐
                                         │ Validate     │
                                         │ token + role │
                                         └──────┬───────┘
                                                │
                                         ┌──────┴───────┐
                                         │ Route to     │
                                         │ handler      │
                                         └──────┬───────┘
                                                │
                                         ┌──────┴───────┐
                                         │ Sheet/Drive  │
                                         │ operations   │
                                         │ (with Lock)  │
                                         └──────┬───────┘
                                                │
                                         ┌──────┴───────┐
                                         │ Return JSON  │
                                         │ {success,    │
                                         │  data} or    │
                                         │ {success:    │
                                         │  false, code,│
                                         │  error}      │
                                         └──────────────┘
```

### 3.6 Data Flow (Task Lifecycle)
```
CREATE (Staff)                          UPDATE (Worker)
─────────────────                       ──────────────
1. Form data + photos                   1. User action
2. Client: validate, resize, compress   2. Client: validate
3. POST form-urlencoded                 3. POST form-urlencoded
   action=create                         action=update&id=xxx
   description=...                       status=In progress
   requester_name=...                    maintenance_notes=...
   location=...                          photos=[...]
   urgency=Normal                        (optional)
   photos=[b64...]
4. Server: validate all fields          4. Server: validate
5. Server: check auth + role (staff)    5. Server: check auth + role (worker)
6. Server: LockService                  6. Server: LockService
7. Server: upload photos → Drive        7. Server: state machine check
   /2026/task-UUID/                          (valid transition?)
8. Server: createTask → Sheet           8. Server: updateTask → Sheet
   (generates UUID,                      (updates updated_at,
    timestamps,                           completed_at if done)
    status=New)
9. Server: return {success, taskId,     9. Server: return {success, task}
   photos: [{url, filename, id}]}
10. Client: clear cache, show success   10. Client: clear cache, refresh UI
```

### 3.7 Photo Flow
```
Camera/File Input
       │
       ▼
┌──────────────────┐
│ Validate:        │
│ - Type: JPEG/PNG │
│ - Size: ≤5MB     │
│ - Count: ≤3      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Canvas resize:   │
│ - Max 1600px     │
│ - Quality 0.75   │
│ - Maintain ratio │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ To Base64        │
│ (data URL →      │
│  strip prefix)   │
└────────┬─────────┘
         │
         ▼
POST form-urlencoded
photos[0][base64]=...
photos[0][filename]=...
photos[0][mimeType]=...
         │
         ▼
Apps Script:
- base64Decode
- newBlob
- Drive folder (by year)
- createFile
- getUrl()
- return structured array
```

---

## 4. Responsibility Split

| Layer | Responsibilities | NOT Responsibilities |
|-------|-----------------|---------------------|
| **GitHub Pages** | Static hosting, HTML/CSS/JS delivery, PWA manifest, SW registration | No server logic, no secrets, no data processing |
| **Frontend JS** | UI, user interaction, client validation, photo processing, API calls, cache mgmt | No auth enforcement, no data authority, no direct Sheet/Drive access |
| **Apps Script** | Auth, authorization, validation, business logic, Sheet CRUD, Drive ops, state machine | No UI rendering, no client-side state |
| **Google Sheets** | Task data storage (row per task) | No logic, no file storage, no auth |
| **Google Drive** | Photo/file blob storage | No metadata, no task data |

---

## 5. API Contract

### Request Format (All POST)
```
Content-Type: application/x-www-form-urlencoded
Body: action=xxx&token=yyy&param1=value1&param2=value2...
```

### Response Format (All)
```javascript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, code: "ERROR_CODE", error: "Human-readable message" }
```

### Endpoints

| Method | Action | Auth | Role | Description |
|--------|--------|------|------|-------------|
| POST | validate | No | Any | Password login → returns token |
| GET | list | Yes | Worker | List tasks with filters |
| GET | get | Yes | Worker | Get single task by ID |
| POST | create | Yes | Staff | Create task + photos |
| POST | update | Yes | Worker | Update task fields |
| POST | upload_photos | Yes | Worker | Add photos to existing task |

### Error Codes
```
AUTH_REQUIRED      - No token provided
AUTH_EXPIRED       - Token expired
AUTH_INVALID       - Token not found/revoked
FORBIDDEN          - Role not allowed for action
VALIDATION_ERROR   - Input validation failed
TASK_NOT_FOUND     - Task ID doesn't exist
PHOTO_TOO_LARGE    - File > 5MB
PHOTO_INVALID      - Invalid type/corrupt
STORAGE_ERROR      - Drive write failed
DATABASE_ERROR     - Sheet read/write failed
INTERNAL_ERROR     - Unexpected server error
```

---

## 6. Deployment Configuration

### GitHub Pages
- Repository: `mdr-be/school-maintenance-reporter-pwa`
- Branch: `main` (or `master`)
- Folder: `/` (root)
- URL: `https://mdr-be.github.io/school-maintenance-reporter-pwa/`

### Google Apps Script
- Project: New or existing
- Deploy: Web App
- Execute as: Me (deployer account)
- Access: Anyone within domain `sint-albertschool.be`
- URL: `https://script.google.com/macros/s/{SCRIPT_ID}/exec`

### Script Properties (Set After Deploy)
```javascript
// Run once in Apps Script console:
setLoginPassword('secure-random-password');  // Hashed automatically
setFrontendUrl('https://mdr-be.github.io/school-maintenance-reporter-pwa/');
setMaintenanceWorker('maartenderyck@sint-albertschool.be');
```

### Google Sheets
- Spreadsheet ID: `1HtYJqAWengq_wvEbt2SE_Rx4cPwSyal5YwHbp_Z0wVY`
- Sheet naming: `klusjes DDMMYYYY` (e.g., `klusjes 22082026`)
- Columns by index (0-11) as defined in Config.gs

### Google Drive
- Root folder: `Maintenance PWA/` (created by script)
- Year subfolders: `2026/`, `2027/`, etc.
- Task folders: `task-{UUID}/`
- Files: `{taskId}-1.jpg`, `{taskId}-2.jpg`, etc.

---

## 7. Migration Path from Current to Target

### Phase 1: Backend Restructure (Code.gs → Modules)
1. Split `Code.gs` into 7 files
2. Add LockService to all writes
3. Add server-side validation
4. Add password hashing
5. Add role-based authorization
6. Add task state machine
7. Fix photo URL format (JSON array)
8. Fix Drive folder structure (year-based)

### Phase 2: Frontend Modernization
1. Convert to ES modules (`type="module"`)
2. Fix scope bugs in `worker.js`
3. Remove duplicate functions
4. Fix XSS (innerHTML → textContent)
5. Add photo resize/compress
6. Add cache invalidation
7. Add logout UI
8. Add click-to-open task detail

### Phase 3: API/CORS Fix
1. Change all POST to form-urlencoded
2. Remove JSON Content-Type from frontend
3. Update Apps Script to parse form data
4. Test CORS preflight elimination

### Phase 4: Authentication Hardening
1. Client-side token expiration check
2. Auto-clear expired tokens
3. Consistent 401 handling
4. Server-enforced auth on all protected endpoints

### Phase 5: Testing & Polish
1. Complete test matrix (Phase 24)
2. Security audit (Phase 25)
3. Documentation update
4. Deploy and verify

---

## 8. Remaining Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Apps Script CORS still fails | Medium | High | Form-urlencoded eliminates preflight; test thoroughly |
| Sheet concurrent writes | High | High | LockService mandatory on all writes |
| Photo upload timeout | Medium | Medium | Compress client-side; warn on large files |
| Drive quota exceeded | Low | Medium | Monitor; implement cleanup policy |
| Token theft via XSS | Medium | High | Fix all XSS; HttpOnly not possible (SPA) |
| Quarterly sheet migration | Medium | Medium | Implement `createNewQuarterSheet()` with copy logic |
| Mobile browser compatibility | Low | Medium | Test on iOS Safari, Chrome Android |
| Service worker cache issues | Medium | Low | Version bump on deploy; exclude API from cache |

---

## 9. Success Criteria

The refactored system is **production-ready** when:

- [ ] All 47 bugs resolved (CRITICAL=0, HIGH=0)
- [ ] No CORS errors in browser console
- [ ] Authentication works: login → token → validated → expiry → re-login
- [ ] Staff can create tasks with photos (≤3, ≤5MB, ≤1600px)
- [ ] Worker can list, filter, view, update status, add notes, view photos
- [ ] State machine enforces valid transitions
- [ ] LockService prevents race conditions (tested concurrent)
- [ ] XSS vectors eliminated (all user data via textContent)
- [ ] Password never in plaintext (hashed in Script Properties)
- [ ] No secrets in GitHub repo
- [ ] PWA installs and works offline (static assets)
- [ ] Service worker v3+ caches correctly, no API caching
- [ ] Cache invalidated after every mutation
- [ ] Error codes returned and displayed appropriately
- [ ] Deployment documented and reproducible

---

*Generated from comprehensive audit of `/home/appelflap/Documents/klusjes-app-pwa/`*