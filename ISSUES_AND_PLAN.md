# School Maintenance Reporter PWA - Issues and Improvement Plan

## Current Status Analysis

Based on review of the codebase against the specification in `starting-prompt`, here are the key areas that need attention:

### 1. API URL Configuration (Priority: High)
- **Issue**: The API URL in `js/utils.js` has a TODO comment and uses a hardcoded placeholder
- **Current**: `return 'https://script.google.com/macros/s/AKfycbzsGdvD4ATywZzchjfozluOgtlw6mR2vZKUZuTpmcd1qyPNmH_0rzjUEaahQCQkxVLJ/exec';`
- **Needed**: Implement proper configuration mechanism that allows setting the URL after deployment
- **Progress**: Already started - added localStorage fallback in git diff

### 2. Staff Interface Enhancement (Priority: High)
- **Issues identified**:
  - Missing photo capture functionality (only file upload)
  - Missing multiple photo support
  - Form includes fields not in original spec (requester_name, required_materials, status)
  - Missing urgency visual styling
  - Missing confirmation with task ID display
- **Spec requirements**:
  - Photo: Take photo directly, upload existing, optionally multiple photos
  - Problem description: Simple text field
  - Location: Manual selection (from existing list)
  - Urgency: Normal/Important/Urgent with visual clarity
  - Submit: Show confirmation, task ID, prevent duplicates

### 3. Maintenance Worker Dashboard (Priority: High)
- **Issues identified**:
  - Current worker.js shows task list but lacks dashboard summary
  - Missing task counts by status/urgency (urgent open, important open, normal open, in progress, waiting)
  - Missing filtering capabilities beyond basic status/urgency/location
- **Spec requirements**:
  - Dashboard showing counts of tasks by status and urgency
  - Filter and sort capabilities
  - Quick overview of work priorities

### 4. Photo Handling Improvements (Priority: Medium)
- **Issues identified**:
  - Staff.js uses basic file input without camera integration
  - No photo preview in staff interface (only in worker)
  - Limited to single photo in staff form
- **Spec requirements**:
  - Take photo directly using phone camera
  - Upload existing photo
  - Optionally multiple photos
  - Preview functionality

### 5. UUID Generation (Priority: Low)
- **Issue**: Simplified UUID generation in utils.js that may not be truly unique
- **Current**: `return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {...})`
- **Better**: Use crypto.randomUUID() or more robust fallback

### 6. Offline Queueing Preparation (Priority: Medium)
- **Spec**: "Do not over-engineer offline functionality in version 1. However, prepare the architecture for future offline queueing"
- **Current**: No evidence of offline preparation
- **Needed**: Architecture that could support queuing requests when offline

### 7. Future QR Code Compatibility (Priority: Low)
- **Spec**: "Only make the architecture compatible with it."
- **Current**: No URL parameter handling for pre-filling location
- **Needed**: Staff interface should check for location parameter in URL

### 8. Authentication Flow (Priority: Medium)
- **Issues to verify**:
  - Token expiration handling
  - Login redirect flow
  - Proper error handling for auth failures

### 9. Service Worker Best Practices (Priority: Low)
- **Current**: Network-first for HTML/JS/CSS, cache-first for others
- **Review**: Ensure this follows PWA best practices

### 10. Data Mapping Validation (Priority: Medium)
- **Need**: Verify that frontend field names match backend column mapping
- **Examples**: 
  - Frontend `requester_name` → Backend `naam aanvrager`
  - Frontend `required_materials` → Backend `Benodigd materiaal`
  - etc.

## Detailed Action Plan

### Phase 1: Critical Fixes (Immediate)
1. [ ] Complete API URL configuration improvement
2. [ ] Fix staff interface to match spec (remove extra fields, add photo capture, multiple photos)
3. [ ] Implement maintenance worker dashboard with task counts

### Phase 2: Enhancements (Short-term)
4. [ ] Improve photo handling (camera integration, multiple photo support)
5. [ ] Add URL parameter handling for future QR code compatibility
6. [ ] Enhance UUID generation
7. [ ] Prepare offline queueing architecture

### Phase 3: Polish and Verification (Ongoing)
8. [ ] Verify authentication flow
9. [ ] Review service worker implementation
10. [ ] Validate data mapping between frontend and backend
11. [ ] Test end-to-end workflow

## Implementation Details

### Task 1: API URL Configuration
**File**: `js/utils.js`
**Changes**:
- Already implemented localStorage fallback
- Need to add mechanism to set URL after deployment (could be via setup page or manual localStorage setting)
- Consider adding a setup/storage utility

### Task 2: Staff Interface Enhancement
**Files**: `staff.html`, `staff.js`, `photos.js`
**Changes**:
- Remove non-spec fields: requester_name, required_materials, status (staff shouldn't set status)
- Add camera capture functionality
- Implement multiple photo support (up to 3 as per constants)
- Add visual urgency indicators
- Improve confirmation message with task ID
- Add duplicate submission prevention

### Task 3: Maintenance Worker Dashboard
**Files**: `worker.html`, `worker.js`
**Changes**:
- Add dashboard section showing task counts by status and urgency
- Implement proper filtering (status, urgency, location, date)
- Ensure task list shows relevant information
- Add sorting capabilities

### Task 4: Photo Handling Improvements
**Files**: `staff.js`, `photos.js`, `utils.js`
**Changes**:
- Integrate camera capture in staff interface
- Improve photo preview (show thumbnails)
- Support multiple photo uploads
- Ensure proper image processing (resize/compress)

### Task 5: UUID Generation
**File**: `js/utils.js`
**Changes**:
- Replace custom UUID generation with standard approach:
  ```javascript
  export function generateUuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  ```

### Task 6: Offline Queueing Preparation
**Files**: `js/api.js`, `js/utils.js`
**Changes**:
- Add request queuing mechanism
- Detect online/offline status
- Store failed requests in IndexedDB or localStorage
- Retry when connection restored
- **Note**: Don't implement full offline sync, just prepare hooks

### Task 7: QR Code Compatibility
**Files**: `staff.html`, `staff.js`
**Changes**:
- On page load, check URL parameters for location
- If location parameter exists, pre-fill location field
- Show pre-filled location clearly
- Allow normal workflow to continue

### Task 8: Authentication Flow
**Files**: `js/auth.js`, `js/utils.js`
**Changes**:
- Verify token expiration handling
- Improve login UX (remember last attempt, etc.)
- Ensure proper redirect after login
- Handle auth errors gracefully

### Task 9: Service Worker Review
**File**: `js/service-worker.js`
**Changes**:
- Review caching strategy
- Ensure proper cache versioning
- Check for any missing assets
- Verify API requests are not cached

### Task 10: Data Mapping Validation
**Files**: Various (frontend-backend interface)
**Changes**:
- Create mapping document verifying all field translations
- Ensure consistency between:
  - Frontend field names
  - Backend column indices (in the task section of Code.gs)
  - Dutch-to-English mappings
  - Sheet headers

## Estimated Effort
- Phase 1: 2-3 days
- Phase 2: 2-3 days  
- Phase 3: 1-2 days (ongoing)

## Success Criteria
- Staff can report issue in <30 seconds as specified
- Maintenance worker sees clear dashboard with prioritized tasks
- All data flows correctly between frontend and backend
- PWA installs and works offline (basic fallback)
- Architecture ready for future enhancements (QR codes, offline queue)

## Next Steps
Begin with Phase 1 tasks, starting with API configuration and staff interface improvements.