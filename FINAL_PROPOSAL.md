# Final Proposal for School Maintenance Reporting PWA

## Overview
This document incorporates all feedback and specifies the exact data model, sheet format, and architecture for the MVP.

## Sheet Format and Naming
- **Sheet Name Pattern**: `<klusjes DDMMYYYY>` (e.g., `klusjes 21082026` for 21 August 2026). Day-month-year, two digits each, four-digit year.
- **Quarterly Rotation**: At the start of each school quarter (September, December, March, June), a new sheet will be created with the current date in DDMMYYYY format. Unfinished tasks from the previous sheet will be copied to the new sheet; completed tasks remain archived.
- **Column Headers (Dutch)**: The sheet will have the following exact headers in the specified columns (0-indexed):

| Column Index | Dutch Header          | English Meaning          |
|--------------|-----------------------|--------------------------|
| 0            | Omschrijving          | Description              |
| 1            | naam aanvrager        | Requester name           |
| 2            | Welke klas? Welk lokaal? | Location             |
| 3            | Benodigd materiaal    | Required materials       |
| 4            | prioriteit            | Priority / Urgency       |
| 5            | opvolging             | Follow-up / Status       |
| 6            | (unspecified, free)   | (to be used for photos?) |
| 7            | Opmerkingen           | Remarks / Comments       |
| 8            | datum gemaakt         | Date created             |
| 9            | datum update          | Date updated             |
| 10           | datum opgelost        | Date resolved            |
| 11+          | (additional)          | (available for extensions) |

Note: The user specified columns 7,8,9,10 as above. Column 6 is not specified; we will use it for PWA-specific fields (photo URLs) and shift the specified columns accordingly? Wait, the user said column 7 is 'Opmerkingen', column 8 is 'datum gemaakt', etc. That implies columns 0-6 are as previously described (0-5 as before, column 6 unspecified). We will assign:

- Column 6: `photo_urls` (new)
- Column 7: `Opmerkingen` (existing, we will use for maintenance notes? But the user says column 7 is 'Opmerkingen' which is remarks/comments. That can be used for maintenance worker notes.)
- Column 8: `datum gemaakt` (date created) -> we will use for `created_at`
- Column 9: `datum update` (date updated) -> we will use for `updated_at`
- Column 10: `datum opgelost` (date resolved) -> we will use for `completed_at`

Thus we need to adjust: the existing columns 0-5 remain as before. Column 6 is new for photo URLs. Columns 7-10 are existing Dutch headers that we will map to PWA fields as described.

But note: column 5 is 'opvolging' (follow-up) which we currently map to status. However, the user did not mention column 5 in their list of changes; they only mentioned columns 7,8,9,10. So column 5 remains as before.

Thus the mapping becomes:

| Column Index | Dutch Header          | PWA Field (English)       | Notes                                                                 |
|--------------|-----------------------|---------------------------|-----------------------------------------------------------------------|
| 0            | Omschrijving          | `description`             | Problem description.                                                  |
| 1            | naam aanvrager        | `requester_name`          | Name of person reporting.                                             |
| 2            | Welke klas? Welk lokaal? | `location`                | Location where issue observed.                                        |
| 3            | Benodigd materiaal    | `required_materials`      | Materials needed (as reported).                                       |
| 4            | prioriteit            | `urgency`                 | Mapped: `niet zo dringend` → `Normal`, `dringend` → `Important`, `zeer dringend` → `Urgent`. |
| 5            | opvolging             | `status`                  | Mapped to workflow statuses (see below).                              |
| 6            | (new)                 | `photo_urls`              | Comma-separated Google Drive file URLs/IDs for photos.                |
| 7            | Opmerkingen           | `maintenance_notes`       | Remarks / comments (used by maintenance worker).                      |
| 8            | datum gemaakt         | `created_at`              | Date when task was created (we will store as ISO string).             |
| 9            | datum update          | `updated_at`              | Date when task was last updated (ISO string).                         |
| 10           | datum opgelost        | `completed_at`            | Date when task was resolved (ISO string), empty if not resolved.      |
| 11+          | (free)                | (reserved for future)     |                                                                       |

### Status Mapping (from Dutch `opvolging` to PWA status)
We will map existing `opvolging` values to the PWA status as follows (maintenance workers can override):
- `In orde` → `Completed`
- `overnemen op volgend lijstje` → `Planned`
- `niet voldoende gebeurd` → `In progress`
- `bezig of in pauze; met extern bedrijf of MAARTEN` → `In progress`
- Empty or unrecognized → `New`

The maintenance worker interface will allow setting status to one of:
- `New`
- `Planned`
- `In progress`
- `Waiting for materials`
- `Completed`

### Photo Storage
- Photos uploaded via the PWA will be stored in a dedicated Google Drive folder:
  ```
  Klusjes/Photos/
  ```
- Inside this folder, we may organize by task ID (e.g., `Klusjes/Photos/<task_id>/`) or by date.

### Backend (Google Apps Script)
- Will access columns by index (to be resilient to minor header changes, but we expect the exact headers).
- Will determine the active sheet: the sheet with the most recent date in the name matching `klusjes DDMMYYYY` (or we can store the active sheet name in Script Properties).
- Will provide endpoints for:
  - Creating a new task (staff) - includes photo upload handling.
  - Reading tasks (maintenance worker) with filtering.
  - Updating a task (maintenance worker) - updates columns 6-10 as needed, and updates `updated_at`.
- Will implement a function to create a new quarter sheet and copy unfinished tasks.

### Frontend (PWA)
- Two interfaces: staff reporting and maintenance worker.
- Staff interface: form to submit report (photo, description, location, urgency). Location is a dropdown populated from known locations (we can extract unique locations from the sheet or allow free text).
- Maintenance worker interface: list of tasks with filters (status, urgency, location, date). Task detail view to update status, add maintenance notes, etc.
- Both interfaces are installable PWAs with manifest and service worker.

### Access Control
- Maintenance workers identified by a list of emails (stored in Script Properties or a hidden sheet).
- Staff can only create tasks.
- Maintenance workers can read and update tasks.

### Next Steps
Please review this final proposal. If approved, we will proceed to develop the MVP as outlined in the starting prompt (Step 3: Build a minimum viable product).

We will then create the basic folder structure, sample HTML/JS, and the Apps Script code.

Please confirm or request any further changes.