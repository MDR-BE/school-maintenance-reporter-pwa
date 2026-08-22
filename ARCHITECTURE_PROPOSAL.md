# Architecture Proposal for School Maintenance Reporting PWA

## Overview
This document proposes the technical architecture for the PWA based on the starting prompt and the analyzed existing maintenance list. The architecture follows the constraints: Google Workspace backend, simplicity, mobile-first, and future extensibility.

## Proposed Architecture

### 1. Frontend (PWA)
- **Technology**: HTML5, CSS3, Vanilla JavaScript (or Preact for minimal reactivity if needed). No heavy frameworks.
- **Responsiveness**: Mobile-first design, responsive layout.
- **PWA Features**:
  - Web App Manifest (`manifest.json`) for installability.
  - Service Worker (`service-worker.js`) for basic offline caching (static assets) and fallback.
  - Application icons in various sizes.
- **Structure**:
  - `/index.html` - Entry point, redirects to appropriate interface based on user role (or lets user choose).
  - `/staff.html` - Staff reporting interface.
  - `/worker.html` - Maintenance worker interface.
  - `/css/` - Stylesheets.
  - `/js/` - JavaScript modules (UI, API communication, helpers).
  - `/assets/` - Icons, images.
  - `/manifest.json` - PWA manifest.
  - `/service-worker.js` - Service worker script.

### 2. Backend (Google Apps Script)
- **Technology**: Google Apps Script (JavaScript-based) deployed as a Web App.
- **Responsibilities**:
  - Expose REST-like endpoints for:
    - Creating a new maintenance task (staff submission).
    - Reading tasks (with filtering, sorting, pagination).
    - Updating a task (status, notes, etc.).
    - Handling photo uploads (proxy to Google Drive).
  - Interact with Google Sheets (read/write) according to the data model.
  - Interact with Google Drive for photo storage.
  - Perform role-based access control (staff vs maintenance worker).
  - Log errors and administrative info (to Sheets or Stackdriver via simple logging).
- **Execution**: The web app will execute as the user accessing it (or as a service account? For simplicity, we can have it run as the user making the request, but note that staff should not see all tasks. We'll use the user's Google identity to determine role and restrict data accordingly. Alternatively, we can run the web app as a service account and use frontend tokens for identity, but that complicates. Given the constraint of avoiding external auth, we'll use Google Workspace and check the user's email against a list of maintenance workers (stored in a separate sheet or properties).)
- **Endpoint Structure** (all under the web app URL):
  - `GET /tasks?status=...&urgency=...&location=...&limit=...&offset=...` - List tasks (maintenance worker only).
  - `POST /tasks` - Create a new task (staff). Requires multipart/form-data for photo uploads.
  - `PUT /tasks/:id` - Update a task (maintenance worker). JSON body.
  - `GET /tasks/:id` - Get a single task (maintenance worker).
  - `GET /photos/:fileId` - Proxy to serve photos (optional, or we can redirect to Drive with appropriate permissions).
  - `GET /config` - Get configuration (locations, urgency levels, etc.) for the frontend.

### 3. Data Storage
- **Primary**: Google Sheets (one sheet named `Tasks` with columns as per the data model).
- **Secondary**: Google Drive for photo storage (folder: `Maintenance/Photos/`).
- **Configuration**: Another sheet (or Properties Service) for:
  - List of maintenance worker emails (for access control).
  - List of allowed locations (optional, for validation).
  - Urgency levels and status workflow.

### 4. Authentication and Access Control
- **Mechanism**: Google Workspace authentication via the web app. When a user accesses the web app, we can get their email via `Session.getActiveUser().getEmail()` (if the web app is deployed to execute as the user accessing it, and the domain allows). However, note that for a web app deployed within a domain, this returns the user's email if the user is in the same domain and the app is deployed with "Execute the app as: Me" and "Who has access to the app: Anyone within domain".
- **Role Check**: Compare the user's email against a list of maintenance worker emails (stored in a sheet or script properties). If in the list, they are a maintenance worker; otherwise, they are staff.
- **Access Rules**:
  - Staff: Can only create new tasks (via POST /tasks) and cannot read/update tasks.
  - Maintenance Worker: Can read tasks (GET /tasks, GET /tasks/:id), update tasks (PUT /tasks/:id), and create tasks? (Optional: maintenance workers can also create tasks if they notice an issue. We'll allow both roles to create tasks, but staff cannot view/update.)

### 5. Photo Upload Flow
1. Staff selects/takes photo in the frontend.
2. Frontend sends a multipart request to `POST /tasks` (which includes the photo file(s) and other form data).
3. Backend (Apps Script) receives the upload, saves the photo(s) to a dedicated folder in Google Drive (e.g., `Maintenance/Photos/<task_id>/`).
4. Backend stores the file URL(s) (or file ID) in the `photo_urls` column (comma-separated).
5. Backend creates the task row in Google Sheets.

### 6. Offline Considerations (Version 1)
- The PWA will attempt to send reports when online.
- If offline, the frontend will display an error and prevent submission (to avoid data loss). We can later implement a queue (IndexedDB) for offline submission, but not in V1.
- The service worker will cache static assets (HTML, CSS, JS) for offline loading of the app.

### 7. Project File Structure (Local Development)
```
./Documents/klusjes-app-pwa/
├── index.html
├── staff.html
├── worker.html
├── manifest.json
├── service-worker.js
├── /css
│   ├── styles.css
│   └── responsive.css
├── /js
│   ├── main.js
│   ├── staff.js
│   ├── worker.js
│   ├── api.js
│   └── utils.js
├── /assets
│   ├── icon-192.png
│   ├── icon-512.png
│   └── ...
├── /code
│   └── Code.gs          (Google Apps Script code)
└── README.md
```

### 8. Deployment Procedure
1. Create a Google Sheet for the tasks (with header row matching the data model columns).
2. Create a folder in Google Drive for photos (e.g., `Maintenance/Photos`).
3. Create a Google Apps Script project, paste the backend code, and deploy as a web app:
   - Execute the app as: Me (the account deploying it).
   - Who has access: Anyone within the domain (your school Google Workspace domain).
4. Note the web app URL.
5. Update the frontend `api.js` with the web app URL.
6. Optionally, store the list of maintenance worker emails in the script properties or a hidden sheet.
7. Share the PWA URL with staff and maintenance workers; they can install it via browser (Add to Home screen).

### 9. Future Extensions (Prepared For)
- **QR Code Compatibility**: The staff interface can read a `location` query parameter and pre-fill the location field.
- **Location Hierarchy**: If needed, we can extend the location field to support building/floor/room by parsing or adding separate columns without changing the core model.
- **Additional Fields**: Completion photo, time spent, etc., can be added as new columns.
- **Offline Queue**: Implement a background sync using Service Worker and IndexedDB.
- **Email Notifications**: Use Apps Script to send emails on status changes.

## Summary
This architecture leverages Google Workspace as requested, avoids external dependencies, and provides a clear separation between staff and maintenance worker interfaces. It is designed to be simple to understand and maintain by a school administrator with basic knowledge of Google Apps Script.

---
*Next Step: Await approval before proceeding to MVP development.*