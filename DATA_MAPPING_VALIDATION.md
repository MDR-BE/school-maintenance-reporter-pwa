# Data Mapping Validation: Frontend ↔ Backend

This document validates the data flow between the frontend (PWA) and backend (Google Apps Script) for the Maintenance Reporter PWA.

## Staff Interface → Task Creation

### Frontend Data Sent (staff.js)
When submitting a report, the staff interface sends:
```javascript
const taskData = {
  description: String,  // From textarea#description
  location: String,     // From input#location  
  urgency: String       // From select#urgency (Normal/Important/Urgent)
};
```

Photos are sent separately as processed File objects.

### API Layer Transformation (api.js createTask)
The taskData and photos are combined:
```javascript
const payload = {
  ...taskData,           // description, location, urgency
  photos: convertedPhotos // Array of {filename, mimeType, base64}
};
```

### Backend Reception (Tasks.gs createTask)
The backend receives the payload as `taskData` parameter and processes it:

| Frontend Field | Backend Usage | Column Mapping | Default if Missing | Notes |
|----------------|---------------|----------------|-------------------|-------|
| `description` | `taskData.description` | Column 0: Omschrijving | `''` | Direct mapping |
| `location` | `taskData.location` | Column 2: Welke klas? Welk lokaal? | `''` | Direct mapping |
| `urgency` | `taskData.urgency` → `URGENCY_TO_DUTCH[taskData.urgency]` | Column 4: prioriteit | `'niet zo dringend'` (Normal) | Maps Normal→'niet zo dringend', Important→'dringend', Urgent→'zeer dringend' |
| *(not sent)* | `taskData.requester_name` | Column 1: naam aanvrager | `''` | Left empty - staff doesn't enter name |
| *(not sent)* | `taskData.required_materials` | Column 3: Benodigd materiaal | `''` | Left empty - not in staff workflow |
| *(not sent)* | `taskData.status` | Column 5: opvolging | `''` → maps to 'New' | Defaults to New task |
| *(not sent)* | `taskData.maintenance_notes` | Column 7: Opmerkingen | `''` | Left empty |
| *(not sent)* | `taskData.photos` | Column 6: photo_urls (JSON) | Processed separately | Handled via `serializePhotos(photos)` |
| *(generated)* | `taskId` | Column 11: task_id | `Utilities.getUuid()` | Generated UUID |
| *(generated)* | `now` | Columns 8,9: datum gemaakt, datum update | `new Date().toISOString()` | Creation/update timestamps |
| *(not set)* | Column 10: datum opgelost | `''` | Empty until completed |

### Urgency Mapping Validation
**Frontend → Backend:**
- `'Normal'` → `'niet zo dringend'` ✓
- `'Important'` → `'dringend'` ✓  
- `'Urgent'` → `'zeer dringend'` ✓

**Backend → Frontend (reverse mapping in mapRowToTask):**
- `'niet zo dringend'` → `'Normal'` ✓
- `'dringend'` → `'Important'` ✓
- `'zeer dringend'` → `'Urgent'` ✓
- Any other/unmapped → `'Normal'` (fallback) ✓

### Status Mapping Validation
**Backend → Frontend (in mapRowToTask):**
- `''` (empty) → `'New'` ✓ (from DUTCH_TO_STATUS[''] = 'New')
- `'In orde'` → `'Completed'` ✓
- `'overnemen op volgend lijstje'` → `'Planned'` ✓  
- `'niet voldoende gebeurd'` → `'In progress'` ✓
- `'wachten op materialen'` → `'Waiting for materials'` ✓

### Photo Handling Validation
**Frontend → Backend:**
1. Staff selects/captures files → File objects
2. `photos.js processPhotosForUpload()` converts each File to:
   ```javascript
   {
     filename: file.name,
     mimeType: file.type, 
     base64: processedBase64String
   }
   ```
3. Sent to backend via API as `taskData.photos`

**Backend Processing (Photos.gs uploadPhotos):**
1. Receives array of `{base64, filename, mimeType}`  
2. Validates each photo
3. Stores in Google Drive under: `Maintenance PWA/[year]/task-[taskId]/`
4. Returns array of `{url, filename, id, mimeType, originalName}`

**Backend → Frontend (Storage & Retrieval):**
1. Backend stores photo metadata as JSON string in sheet column 6 (photo_urls)
2. Frontend retrieves via `parsePhotoData()` which handles:
   - New format: JSON array of objects
   - Old format: comma-separated URL string (for backward compatibility)

### Field Length & Validation
According to Config.gs limits:
- Description: max 2000 chars ✓ (textarea allows unlimited but backend validates)
- Location: max 200 chars ✓  
- Urgency: validated via dropdown ✓
- Photos: max 3 per task, max 5MB each ✓ (enforced in frontend and backend)

## Maintenance Worker Interface → Task Updates

### Status Updates
Worker interface sends: `{ status: String }`  
Backend validates against `VALID_TRANSITIONS` and updates column 5 (opvolging)  

### Notes Updates  
Worker interface sends: `{ maintenance_notes: String }`  
Backend updates column 7 (Opmerkingen)

### Photo Uploads  
Same flow as creation - worker can add additional photos to existing tasks

## Data Flow Summary

```
Staff PWA Submission:
  [Form Inputs] 
    → description, location, urgency 
    → API layer (adds photos metadata)
    → Google Apps Script 
    → Sheet row with Dutch column values
    → Drive storage for photos
    → Returns taskId

Maintenance Worker PWA:
  [GET requests to /action=list etc.]
    ← Sheet rows converted to English objects
    ← Drive photo URLs reconstructed
    → Display in task list/detail views
    → [PUT requests for status/notes/photos]
    ← Updated sheet and drive files
```

## Spec Compliance Check

✅ **Staff Interface Simplicity**: Only requires description, location, urgency, photo  
✅ **Photo Support**: Capture, upload, multiple photos (max 3)  
✅ **Urgency Clarity**: Normal/Important/Urgent with visual indicators  
✅ **Location Selection**: Manual text input (ready for QR code prefilling)  
✅ **Task Creation**: Properly maps to backend sheet columns  
✅ **Status Defaults**: New tasks correctly initialize as 'New'  
✅ **Photo Storage**: Uses Google Drive with organized folder structure  
✅ **Timestamp Handling**: Automatic creation/update timestamps  
✅ **Error Handling**: Graceful degradation for missing optional fields  

## Recommendations

1. **Consider adding requester_name**: While omitted for simplicity per spec, knowing who reported issues could be valuable for follow-up. Could be made optional or auto-filled from auth if extended.

2. **Validate required_materials**: Currently allowed to be empty, which is fine since staff may not know material needs.

3. **Ensure backend validation**: Confirm that Validation.gs (if it exists) or Tasks.gs has appropriate validation for required fields like description and location.

4. **Test round-trip integrity**: Create task via frontend → verify in sheet → retrieve via frontend → verify data matches.

The data mapping between frontend and backend appears to be correctly implemented and spec-compliant.