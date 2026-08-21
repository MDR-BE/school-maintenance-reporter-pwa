# Updated Proposal for School Maintenance Reporting PWA

## Adjustments Based on Feedback

### 1. Language and Sheet Column Headers
- The application code (HTML, JS, Apps Script) will be written in English.
- The Google Sheet will retain Dutch column headers as they currently exist in the provided file.
- Since the exact header text varies slightly between sheets (e.g., column 0 header may be `Unnamed: 0` or `Wat moet er hersteld worden?`), we will **access columns by index** rather than by header name to ensure robustness.
- The column meanings (by index) are consistent across all sheets:
  - Index 0: Task description (problem description)
  - Index 1: Requester name (`naam aanvrager`)
  - Index 2: Location (`Welke klas? Welk lokaal?`)
  - Index 3: Required materials / notes (`Benodigd materiaal`)
  - Index 4: Priority / urgency (`prioriteit`)
  - Index 5: Status / follow-up (`opvolging`)
- Additional columns (index 6+) vary and are not used consistently; we will ignore them for core data and use newly appended columns for PWA-specific fields.

### 2. Google Drive Photo Storage
- Photos uploaded via the PWA will be stored in a dedicated Google Drive folder:
  ```
  Klusjes/Photos/
  ```
- Inside this folder, we may organize by task ID or date for scalability (e.g., `Klusjes/Photos/<task_id>/`).

### 3. Sheet Naming and Quarterly Rotation
- Existing sheets follow the naming pattern: `klusjes <number>` (e.g., `klusjes 304`, `klusjes 263`). These represent historical data.
- Going forward, a **new sheet will be created at the start of each school quarter** (starting in September, ending end of June). The sheet name will reflect the quarter and year, e.g., `klusjes Q3 2026` or `klusjes 2026-2027 Q1`. The exact naming convention can be discussed; for now we propose using `klusjes <year> Q<quarter>`.
- At the creation of a new quarter sheet, **all tasks from the previous sheet that are not yet completed** (status not `Completed`) will be copied over to the new sheet. Completed tasks will remain in the previous sheet for archival purposes.
- This ensures that the active sheet only contains open and recently completed tasks, keeping the sheet size manageable.
- The Apps Script backend will need to know which sheet is the current active sheet (could be determined by the most recent sheet with a name matching the pattern, or we can store the active sheet name in Script Properties).

### 4. Updated Data Model (Column Mapping)
We keep the same data model as before, but note that we will write to columns by index. New PWA-specific columns will be appended after the existing six columns.

| Column Index | Existing Meaning (Dutch)            | PWA Field (English)       | Notes                                                                 |
|--------------|-------------------------------------|---------------------------|-----------------------------------------------------------------------|
| 0            | Task description (varies)           | `description`             | Text description of the problem.                                      |
| 1            | `naam aanvrager`                    | `requester_name`          | Name of person reporting.                                             |
| 2            | `Welke klas? Welk lokaal?`          | `location`                | Location where issue observed.                                        |
| 3            | `Benodigd materiaal`                | `required_materials`      | Materials needed (as reported).                                       |
| 4            | `prioriteit`                        | `urgency`                 | Mapped: `niet zo dringend` → `Normal`, `dringend` → `Important`, `zeer dringend` → `Urgent`. |
| 5            | `opvolging`                         | `status`                  | Mapped to workflow statuses (see below).                              |
| **6**        | (new)                               | `photo_urls`              | Comma-separated Google Drive file URLs/IDs for photos.                |
| **7**        | (new)                               | `maintenance_notes`       | Notes added by maintenance worker.                                    |
| **8**        | (new)                               | `created_at`              | Timestamp when task created (ISO 8601).                               |
| **9**        | (new)                               | `updated_at`              | Timestamp when task last updated (ISO 8601).                          |
| **10**       | (new)                               | `completed_at`            | Timestamp when task completed (ISO 8601), empty otherwise.            |
| **11**       | (new)                               | `task_id`                 | Stable unique identifier (UUID v4).                                   |

#### Status Mapping (from Dutch `opvolging` to PWA status)
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

### 5. Updated Architecture Notes
- **Backend (Google Apps Script)** will:
  - Determine the active sheet (most recent quarter sheet, or property-based).
  - Read/write columns by index.
  - Create new quarter sheet at the start of each quarter (could be triggered manually via a menu item or automatically on first access after a date threshold).
  - Implement a function to copy unfinished tasks from previous sheet to new sheet (to be run when creating a new quarter sheet).
  - Store photos in `Klusjes/Photos/` folder.
- **Frontend** remains unchanged; it will interact with the backend via the same endpoints.
- **Access Control**: Same as before; maintainer workers identified by email list.

### 6. Next Steps
Please review the above adjustments, particularly:
- The Dutch column indices (we rely on index, not header).
- The photo folder name `Klusjes/Photos/`.
- The quarterly sheet creation and task transfer process.

If these are acceptable, we will proceed to develop the MVP (minimum viable product) as outlined in the starting prompt.

Please confirm or request further changes.