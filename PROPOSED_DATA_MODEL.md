# Proposed Data Model for School Maintenance Reporting PWA

## Overview

This document proposes a data model based on the existing maintenance list (Excel file with multiple sheets). The goal is to preserve compatibility with the existing data while extending it to support the PWA features (photo uploads, maintenance notes, timestamps, etc.).

## Existing Structure Analysis

All sheets in the Excel file share a consistent column structure for the first six columns:

| Column Index | Column Name (varies)         | Meaning                          |
|--------------|------------------------------|----------------------------------|
| 0            | (e.g., `Unnamed: 0`, `Wat moet er hersteld worden?`) | Task description |
| 1            | `naam aanvrager`             | Requester name (person reporting) |
| 2            | `Welke klas? Welk lokaal?`   | Location (classroom, area, etc.) |
| 3            | `Benodigd materiaal`         | Required materials / notes       |
| 4            | `prioriteit`                 | Urgency / priority               |
| 5            | `opvolging`                  | Status / follow-up notes         |
| 6+           | `Unnamed: 6`, `Unnamed: 7`, ... | Additional notes (inconsistent) |

### Data Quality Issues Observed
- Missing values in various columns (especially requester name, location, required materials, priority).
- Inconsistent location strings (free-form, some include building/room, some are vague).
- Priority values are consistent across sheets: `niet zo dringend`, `zeer dringend`, `dringend`.
- Status/follow-up values vary: `In orde`, `overnemen op volgend lijstje`, `niet voldoende gebeurd`, `bezig of in pauze; met extern bedrijf of MAARTEN`, and empty.
- Some sheets have extra columns (6, 7, 8) containing notes about external contractors, materials needed, etc.

## Proposed Data Model (Google Sheets)

We propose to keep the existing six columns as-is (to preserve compatibility) and add new columns for PWA-specific fields. The sheet will be used as a single table (we can consolidate all rows from all sheets into one sheet named `Tasks`, or keep each sheet as a separate batch; for simplicity, we propose a single `Tasks` sheet).

### Column Mapping

| Column (Existing)         | PWA Field                | Description / Mapping                                                                 |
|---------------------------|--------------------------|---------------------------------------------------------------------------------------|
| Column 0 (Description)    | `description`            | The problem description (text).                                                       |
| Column 1 (Requester)      | `requester_name`         | Name of the person who reported the issue (optional for display).                     |
| Column 2 (Location)       | `location`               | Location where the issue occurred (free-text; future QR code can pre-fill this).      |
| Column 3 (Materials)      | `required_materials`     | Materials needed (as reported by requester).                                          |
| Column 4 (Priority)       | `urgency`                | Mapped from existing values: <br>• `niet zo dringend` → `Normal` <br>• `dringend` → `Important` <br>• `zeer dringend` → `Urgent` |
| Column 5 (Follow-up)      | `status`                 | Mapped to predefined workflow statuses: <br>• `In orde` → `Completed` <br>• `overnemen op volgend lijstje` → `Planned` <br>• `niet voldoende gebeurd` → `In progress` <br>• `bezig of in pauze; met extern bedrijf of MAARTEN` → `In progress` <br>• Empty or unrecognized → `New` |
| **New Columns**           |                          |                                                                                       |
| Column 6                  | `photo_urls`             | Comma-separated list of Google Drive file URLs (or IDs) for photos attached to the task. |
| Column 7                  | `maintenance_notes`      | Notes added by maintenance workers (work performed, updates, etc.).                   |
| Column 8                  | `created_at`             | Timestamp when the task was created (ISO 8601 format).                                |
| Column 9                  | `updated_at`             | Timestamp when the task was last updated (ISO 8601 format).                           |
| Column 10                 | `completed_at`           | Timestamp when the task was marked Completed (ISO 8601 format, empty otherwise).      |
| Column 11                 | `task_id`                | Stable unique identifier (UUID v4). **Never** use row number as permanent ID.         |

### Notes on Mapping
- The `description` column is always the first column, despite varying headers.
- The `requester_name` column is always the second column.
- The `location` column is always the third column.
- The `required_materials` column is always the fourth column.
- The `urgency` column (mapped from priority) is always the fifth column.
- The `status` column (mapped from opvolging) is always the sixth column.
- New columns are appended after the existing six to avoid disrupting existing data (if any processes rely on column order).

### Status Workflow
The maintenance worker can update the status through the following values:
- `New` (default for newly submitted reports)
- `Planned` (task approved/scheduled but not started)
- `In progress` (work underway)
- `Waiting for materials` (stalled due to missing materials; can be set manually)
- `Completed` (work finished)

The mapping from existing `opvolging` values to these statuses is a best-effort interpretation; maintenance workers can override the status as needed.

### Photo Storage
Photos uploaded via the staff interface will be stored in a dedicated Google Drive folder (e.g., `Maintenance/Photos/`). The `photo_urls` column will contain comma-separated URLs (or file IDs) referencing these photos.

### Maintenance Notes
The `maintenance_notes` field is for workers to add updates, work performed, or comments. It can be initialized from the existing extra columns (6, 7, 8) if they contain relevant notes, or left empty.

### Timestamps
- `created_at`: Set when a new task is inserted (staff submission).
- `updated_at`: Updated whenever any field changes (status, notes, etc.).
- `completed_at`: Set when status transitions to `Completed`.

## Compatibility with Existing Data
- Existing rows will retain their original values in columns 0-5.
- New columns (6-11) will be empty for existing rows and can be filled gradually as the PWA is used.
- The mapping logic (urgency, status) will be applied when reading existing data for display in the PWA.
- When updating existing rows via the PWA, we will write to the appropriate columns (0-5 for mapped fields, 6-11 for new fields).

## Future Extensions
- Hierarchical location (building/floor/room) can be introduced by parsing the `location` string or adding separate columns, without changing the core model.
- QR code compatibility: The reporting interface can accept a `location` query parameter to pre-fill the location field.
- Additional optional fields (completion photo, time spent) can be added as new columns if needed.

## Implementation Notes
- The backend (Google Apps Script) will read/write the sheet using column indices (not letters) to be resilient to column reordering.
- The Apps Script will expose endpoints for:
  - Creating a new task (staff submission)
  - Reading tasks (with filters)
  - Updating a task (status, notes, etc.)
  - Uploading photos to Drive and storing URLs
- Authentication will rely on Google Workspace (users must be logged into their school Google account).

## Example Row (after mapping)
| description                          | requester_name | location               | required_materials | urgency    | status       | photo_urls                     | maintenance_notes          | created_at          | updated_at          | completed_at        | task_id               |
|--------------------------------------|----------------|------------------------|--------------------|------------|--------------|--------------------------------|----------------------------|---------------------|---------------------|---------------------|-----------------------|
| Lek dakgoot Sint-Albert (ter hoogte van L4 & K1) | Maarten        | Gang L4 (tussen L4 en L3) | ladder             | Important  | In progress  | https://drive.google.com/...   | Ladder geplaatst, lek blijft | 2026-08-21T10:30:00Z | 2026-08-21T14:15:00Z |                     | 550e8400-e29b-41d4-a716-446655440000 |