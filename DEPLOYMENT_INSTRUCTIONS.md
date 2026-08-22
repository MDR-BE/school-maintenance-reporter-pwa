# Deployment Instructions

## Prerequisites
- Google Workspace account (sint-albertschool.be domain)
- GitHub account (for GitHub Pages hosting)
- Access to the target Google Spreadsheet: `1HtYJqAWengq_wvEbt2SE_Rx4cPwSyal5YwHbp_Z0wVY`

---

## 1. Google Apps Script Deployment

### 1.1 Create Apps Script Project
1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Name it "Maintenance PWA Backend"
4. Delete any default code in `Code.gs`

### 1.2 Add Backend Files
Create the following files in the Apps Script editor (File > New > Script file):

1. **Config.gs** - Copy from `/home/appelflap/Documents/klusjes-app-pwa/code/Config.gs`
2. **Response.gs** - Copy from `/home/appelflap/Documents/klusjes-app-pwa/code/Response.gs`
3. **Validation.gs** - Copy from `/home/appelflap/Documents/klusjes-app-pwa/code/Validation.gs`
4. **Auth.gs** - Copy from `/home/appelflap/Documents/klusjes-app-pwa/code/Auth.gs`
5. **Photos.gs** - Copy from `/home/appelflap/Documents/klusjes-app-pwa/code/Photos.gs`
6. **Tasks.gs** - Copy from `/home/appelflap/Documents/klusjes-app-pwa/code/Tasks.gs`
7. **Code.gs** - Copy from `/home/appelflap/Documents/klusjes-app-pwa/code/Code.gs`

### 1.3 Initialize the Backend
1. In the Apps Script editor, select the `initialize` function from the dropdown
2. Click Run (▶️)
3. **IMPORTANT**: Check the logs (View > Execution log) - you'll see:
   ```
   Initialization complete. IMPORTANT: Change the default password!
   Run setLoginPassword("your-secure-password") to update.
   ```
4. Run `setLoginPassword("your-actual-secure-password")` with a strong password
5. Run `testSetup()` to verify everything works

### 1.4 Deploy as Web App
1. Click "Deploy" > "New deployment"
2. Click the gear icon ⚙️ and select "Web app"
3. Configuration:
   - **Description**: "Maintenance PWA API v1"
   - **Execute as**: Me (your account)
   - **Who has access**: Anyone within `sint-albertschool.be` domain
4. Click "Deploy"
5. **Copy the Web App URL** - it looks like:
   `https://script.google.com/macros/s/AKfycbxxx.../exec`
6. Save this URL - you'll need it for the frontend

### 1.5 Verify Deployment
1. Open the Web App URL in a browser
2. You should see the login page
3. Test with the password you set in step 1.3

---

## 2. Google Sheets Setup

### 2.1 Spreadsheet Structure
The spreadsheet `1HtYJqAWengq_wvEbt2SE_Rx4cPwSyal5YwHbp_Z0wVY` should have:
- Sheets named `klusjes DDMMYYYY` (e.g., `klusjes 22082026`)
- Columns (by index, 0-based):
  - 0: Omschrijving
  - 1: naam aanvrager
  - 2: Welke klas? Welk lokaal?
  - 3: Benodigd materiaal
  - 4: prioriteit
  - 5: opvolging
  - 6: photo_urls (JSON)
  - 7: Opmerkingen
  - 8: datum gemaakt
  - 9: datum update
  - 10: datum opgelost
  - 11: task_id (UUID)

The script will auto-create sheets and headers as needed.

### 2.2 Quarterly Sheet Rotation
Run `createNewQuarterSheet()` in Apps Script at the start of each quarter (Sep, Dec, Mar, Jun) to:
- Create new sheet with current date
- Copy unfinished tasks from previous sheet
- Preserve formatting

---

## 3. Google Drive Setup

The script automatically creates the folder structure:
```
Maintenance PWA/
├── 2026/
│   ├── task-UUID-1/
│   ├── task-UUID-2/
│   └── ...
└── 2027/
    └── ...
```

No manual setup needed - folders are created on first photo upload.

---

## 4. Frontend Deployment (GitHub Pages)

### 4.1 Repository Setup
1. Create GitHub repository: `school-maintenance-reporter-pwa`
2. Clone locally:
   ```bash
   git clone https://github.com/mdr-be/school-maintenance-reporter-pwa.git
   cd school-maintenance-reporter-pwa
   ```

### 4.2 Update API URL
Edit `/home/appelflap/Documents/klusjes-app-pwa/js/utils.js`:
```javascript
export function getApiBaseUrl() {
  return 'https://script.google.com/macros/s/YOUR_ACTUAL_SCRIPT_ID/exec';
}
```
Replace with your actual Web App URL from step 1.4.

### 4.3 Copy Files
Copy all files from `/home/appelflap/Documents/klusjes-app-pwa/` to the repo root:
```
school-maintenance-reporter-pwa/
├── index.html
├── staff.html
├── worker.html
├── manifest.json
├── css/
│   └── styles.css
├── js/
│   ├── main.js
│   ├── staff.js
│   ├── worker.js
│   ├── utils.js
│   ├── api.js
│   ├── auth.js
│   ├── photos.js
│   └── service-worker.js
└── assets/
    ├── icon-192.png
    └── icon-512.png
```

### 4.4 Create PWA Icons
Create two PNG icons:
- `assets/icon-192.png` - 192×192 px
- `assets/icon-512.png` - 512×512 px

You can use any icon generator or create simple ones with the school logo.

### 4.5 Commit and Push
```bash
git add .
git commit -m "Deploy Maintenance PWA v1"
git push origin main
```

### 4.6 Enable GitHub Pages
1. Go to repository Settings > Pages
2. Source: "Deploy from a branch"
3. Branch: `main` / `root`
4. Save
5. Your PWA will be available at:
   `https://mdr-be.github.io/school-maintenance-reporter-pwa/`

---

## 5. Update Backend Frontend URL

After GitHub Pages is live (may take a few minutes), update the Apps Script:

1. In Apps Script editor, run:
   ```javascript
   function updateFrontendUrl() {
     PropertiesService.getScriptProperties()
       .setProperty('frontend_url', 'https://mdr-be.github.io/school-maintenance-reporter-pwa/');
   }
   ```

2. Run `testSetup()` again to verify CORS works.

---

## 6. Testing Checklist

### Authentication
- [ ] Open PWA URL → shows login page
- [ ] Enter correct password → redirects to role selection
- [ ] Enter wrong password → shows error
- [ ] Token expires after 15 min → requires re-login
- [ ] Logout button works on staff/worker pages

### Staff Interface
- [ ] Can access staff.html after login
- [ ] Form validation works (required fields)
- [ ] Photo preview works
- [ ] Photo validation (type, size)
- [ ] Submit creates task in Sheets
- [ ] Task ID shown on success
- [ ] Multiple photos (up to 3) work
- [ ] Large photos auto-resize/compress

### Worker Interface
- [ ] Can access worker.html after login
- [ ] Task list loads with filters
- [ ] Filters work (status, urgency, location)
- [ ] Click task card opens detail view
- [ ] Status update modal works
- [ ] State machine enforced (no invalid transitions)
- [ ] Notes modal works
- [ ] Photos display in detail and modal
- [ ] Reopen completed task → "In progress"
- [ ] Cache invalidated after updates

### API & Backend
- [ ] No CORS errors in browser console
- [ ] All requests use form-urlencoded
- [ ] LockService prevents race conditions
- [ ] Server-side validation rejects bad input
- [ ] Password stored as hash (not plaintext)
- [ ] Drive folder structure: `Maintenance PWA/YYYY/task-UUID/`
- [ ] Photo URLs returned as structured array

### PWA Features
- [ ] Installable on mobile (Add to Home Screen)
- [ ] Service worker registers (check DevTools > Application)
- [ ] Static assets cached (offline works for UI)
- [ ] API requests NOT cached (network-only)
- [ ] Cache version v3+ updates on deploy

---

## 7. Maintenance

### Regular Tasks
| Task | Frequency | Command |
|------|-----------|---------|
| New quarter sheet | Quarterly (Sep/Dec/Mar/Jun) | Run `createNewQuarterSheet()` |
| Change password | As needed | Run `changeLoginPassword("new-pass")` |
| View logs | Ongoing | Apps Script > Executions |
| Clear old tokens | Automatic | Expired tokens auto-deleted |

### Monitoring
- **Apps Script Executions**: View > Executions (check for errors)
- **Drive Storage**: Monitor `Maintenance PWA/` folder size
- **Sheet Size**: Keep sheets under 10k rows for performance

### Updates
1. Modify frontend files in `/home/appelflap/Documents/klusjes-app-pwa/`
2. Copy to GitHub repo
3. Commit and push
4. GitHub Pages auto-deploys
5. Bump service worker version in `service-worker.js` (CACHE_NAME)

---

## 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Verify frontend URL in Script Properties matches GitHub Pages URL exactly |
| Login fails | Check password hash/salt in Script Properties; re-run `setLoginPassword()` |
| Photos don't upload | Check Drive quota; verify folder permissions |
| Tasks not appearing | Check sheet name matches `klusjes DDMMYYYY`; run `testSetup()` |
| Service worker not updating | Bump `CACHE_NAME` version; clear browser cache |
| "Script function not found" | Ensure all .gs files are in the Apps Script project |

---

## 9. Security Notes

- **Never commit passwords** to GitHub
- **Never put API keys** in frontend code
- **Script Properties** stores: password hash, salt, tokens, folder IDs
- **Token TTL**: 15 minutes (configurable in Config.gs)
- **CORS**: Restricted to frontend origin
- **Drive sharing**: Photos set to "Anyone with link can view"

---

## 10. Support Contacts

- **Maintenance Worker**: maartenderyck@sint-albertschool.be
- **Apps Script Owner**: [Your Google Account]
- **GitHub Repo**: https://github.com/mdr-be/school-maintenance-reporter-pwa
- **PWA URL**: https://mdr-be.github.io/school-maintenance-reporter-pwa/