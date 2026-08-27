# Deployment Guide - School Maintenance PWA

This document explains how to deploy the two main components of the application: the **Google Apps Script Backend** and the **Frontend PWA (GitHub Pages)**.

## 1. Google Apps Script (Backend)

The backend handles the connection to Google Sheets and Google Drive.

### Which file goes to Google Script?
Create a new Google Apps Script project (script.google.com) and copy `code/Code.gs` from this repo into the script editor. It is the consolidated backend and contains the configuration, authentication, response, validation, photo, task, and request-routing sections.

### Configuration
1.  **Spreadsheet ID**: Open `Code.gs` and update `TARGET_SPREADSHEET_ID` in the configuration section with the ID of your Google Sheet.
2.  **Password**: 
    *   Open `Code.gs`.
    *   Find the `DEFAULT_PASSWORD` constant in the configuration section.
    *   Change `'CHANGE_THIS_PASSWORD'` to your desired password (e.g., `'MySchool123'`).
    *   The app will automatically hash and store this password securely the first time you log in.
    *   *Note: If you ever want to change it, simply update it in `Code.gs` and re-deploy.*

### Deployment
1.  Click **Deploy** > **New Deployment**.
2.  Select **Type**: Web App.
3.  **Description**: MVP v1.
4.  **Execute as**: Me.
5.  **Who has access**: Anyone.
6.  Click **Deploy** and **copy the Web App URL**.

---

## 2. GitHub (Frontend PWA)

The frontend is a static site that can be hosted on GitHub Pages.

### Which files go to GitHub?
Everything in the root and the `js/`, `css/`, and `assets/` folders:
*   `index.html`, `staff.html`, `worker.html`
*   `manifest.json`
*   `js/` folder (all `.js` files)
*   `css/` folder
*   `assets/` folder

### Connecting to the Backend
1.  Open `js/utils.js`.
2.  Find the `getApiBaseUrl` function or the `API_URL` constant.
3.  Paste your **Google Apps Script Web App URL** there.
4.  Commit and push these changes to your GitHub repository.

### Hosting
1.  In your GitHub repository, go to **Settings** > **Pages**.
2.  Select the **main** branch as the source.
3.  GitHub will provide a URL (e.g., `https://yourname.github.io/repo-name/`).
4.  Open that URL on your phone to install the PWA.

---

## 3. Google Drive Setup
The app will automatically create a folder named **"Maintenance PWA"** in your Google Drive the first time a photo is uploaded. You don't need to do anything manually here as long as the Script has permissions to access Drive.
