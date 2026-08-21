# School Maintenance Reporter PWA

This is a Progressive Web App (PWA) for reporting and tracking maintenance issues in a school environment. It uses Google Workspace as the backend (Google Sheets for data, Google Drive for photo storage) and Google Apps Script for the backend logic.

## Features

- **Staff Interface**: Simple form to report a problem with photo upload, description, location, and urgency.
- **Maintenance Worker Interface**: Dashboard to view tasks, filter by status/urgency/location, update task status, add notes, and view photos.
- **PWA Features**: Installable, offline caching of static assets, responsive design.
- **Google Workspace Integration**: 
  - Data stored in Google Sheets.
  - Photos stored in Google Drive.
  - Backend logic in Google Apps Script.
- **Role-Based Access**: Staff can only submit reports; maintenance workers can view and update tasks.
- **Quarterly Sheet Rotation**: Automatic creation of a new sheet at the start of each school quarter (September, December, March, June) with transfer of unfinished tasks.

## Project Structure

```
./Documents/klusjes-app-pwa/
├── index.html          # Role selection page
├── staff.html          # Staff reporting interface
├── worker.html         # Maintenance worker interface
├── manifest.json       # PWA manifest
├── service-worker.js   # Service worker for offline caching
├── /css
│   └── styles.css      # Common styles
├── /js
│   ├── main.js         # Role selection logic
│   ├── utils.js        # Utility functions
│   ├── staff.js        # Staff interface logic
│   └── worker.js       # Maintenance worker interface logic
├── /code
│   └── Code.gs         # Google Apps Script backend
└── README.md           # This file
```

## Setup Instructions

### 1. Prepare Google Workspace

#### Create a Google Sheet for Tasks
1. Create a new Google Sheet.
2. Set the column headers exactly as follows (in row 1):
   - A1: `Omschrijving`
   - B1: `naam aanvrager`
   - C1: `Welke klas? Welk lokaal?`
   - D1: `Benodigd materiaal`
   - E1: `prioriteit`
   - F1: `opvolging`
   - G1: `photo_urls`
   - H1: `Opmerkingen`
   - I1: `datum gemaakt`
   - J1: `datum update`
   - K1: `datum opgelost`
   - L1: `task_id` (this column is used internally by the script; you can hide it if desired)
3. You can start with an empty sheet (only headers) or import your existing maintenance data. If importing, ensure the data matches the column order.

#### Create a Google Drive Folder for Photos
1. Create a folder in Google Drive named `Klusjes/Photos` (or let the script create it).
2. Note the folder ID (optional, the script will find or create it by name).

#### Deploy the Google Apps Script Backend
1. Go to [script.google.com](https://script.google.com) and create a new project.
2. Copy the contents of `./code/Code.gs` into the script editor.
3. Replace the placeholder in `getApiBaseUrl()` in `./js/utils.js` with the actual web app URL (you'll get this after deployment).
4. In the Apps Script project, deploy as a web app:
   - Click "Deploy" > "New deployment".
   - Select "Web app".
   - Set "Execute as": Me (your account).
   - Set "Who has access": Anyone within your domain (or "Anyone" if you want to allow external users, but note that this may pose security risks; for a school, restrict to your domain).
   - Click "Deploy".
   - Copy the web app URL (it will look like `https://script.google.com/macros/s/AKfycbx.../exec`).
5. Update `./js/utils.js`:
   - Replace the return value of `getApiBaseUrl()` with the web app URL you just copied.
   - Example: `return 'https://script.google.com/macros/s/AKfycbx.../exec';`
6. (Optional) Set the list of maintenance worker emails:
   - In the Apps Script editor, you can run the function `setMaintenanceWorkers` with a comma-separated list of emails (e.g., `"worker1@school.edu,worker2@school.edu"`). This stores the list in Script Properties.
   - Alternatively, you can edit the script to read from a hidden sheet or hardcode the list.

### 2. Deploy the PWA Frontend

The frontend consists of static files (HTML, CSS, JS) that can be hosted on any static web host (e.g., GitHub Pages, Netlify, Firebase Hosting, or even a Google Site). For simplicity, you can host them in Google Drive as a web view or use a service like GitHub Pages.

#### Option A: Hosting on GitHub Pages (recommended for development)
1. Create a GitHub repository.
2. Copy the entire `./Documents/klusjes-app-pwa` folder (excluding this README if you wish) into the repository.
3. Ensure the files are at the root of the repository (not in a subfolder).
4. Enable GitHub Pages in the repository settings, pointing to the `main` branch (or `master`) and the `/` (root) folder.
5. Your PWA will be available at `https://<username>.github.io/<repository>/`.

#### Option B: Hosting on Google Drive
1. Upload the folder `./Documents/klusjes-app-pwa` to Google Drive.
2. Right-click the folder, select "Share", then "Get link", set to "Anyone with the link can view".
3. Copy the folder ID from the share link.
4. Use a tool like [drive-to-web](https://www.drive2web.com/) or simply open `index.html` via the URL: `https://drive.google.com/uc?export=download&id=<FOLDER_ID>` (note: this may not work for all files; better to use a proper static host).

### 3. Install and Use the PWA

1. Open the PWA URL in a browser on a smartphone or computer.
2. You should see an option to "Add to Home screen" (in Chrome's menu) or the browser will prompt you to install the app.
3. Once installed, you can launch the app from your home screen.
4. On first use, select your role (Staff or Maintenance Worker).
   - Staff: Use the form to report issues.
   - Maintenance Worker: View tasks, update status, add notes, etc.

## Configuration

### Maintenance Worker List
The script checks the logged-in user's email against a list of maintenance worker emails stored in Script Properties. To set this list:

In the Apps Script editor, run:
```javascript
function setMaintenanceWorkers() {
  PropertiesService.getScriptProperties().setProperty('maintenance_workers', 'worker1@school.edu,worker2@school.edu');
}
```
Replace the emails with actual maintenance worker emails.

### Quarterly Sheet Rotation
The script automatically creates a new sheet at the start of each school quarter (September, December, March, June) with the name format `klusjes DDMMYYYY`. Unfinished tasks from the previous sheet are copied to the new sheet.

You can manually trigger the creation of a new quarter sheet by running the function `createNewQuarterSheet` in the Apps Script editor.

## Notes

- The PWA is designed to be simple and lightweight. It uses vanilla JavaScript and no external frameworks.
- The service worker caches static assets for offline use. The app will not allow form submission when offline (to prevent data loss), but you can still view the interface.
- Photo uploads are handled via multipart/form-data in the POST request to the web app.
- The script uses column indices to access data, making it resilient to minor header changes (as long as the column order remains the same).
- Task IDs are stored in column L (task_id) and are UUID v4 values.

## Troubleshooting

- If the web app returns errors, check the execution transcript in the Apps Script editor (View > Executions).
- Ensure that the web app is deployed with the correct access settings (within your domain).
- If photo uploads fail, check that the `Klusjes/Photos` folder exists and that the script has permission to create files in it.
- If the sheet headers are not exactly as expected, the script may not work correctly. Verify the headers match the Dutch names specified.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built as a solution for a school maintenance reporting system.
- Uses Google Workspace services for backend storage and logic.