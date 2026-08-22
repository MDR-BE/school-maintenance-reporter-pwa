# Remaining Risks and Future Work

## Risks That Could Not Be Fully Resolved

### 1. Apps Script CORS Limitations (MEDIUM RISK)
**Status**: Mitigated but not eliminated
- **Issue**: Apps Script Web Apps have limited CORS support. Even with form-urlencoded, some browser/Apps Script combinations may still have issues.
- **Mitigation**: All requests use form-urlencoded (no preflight). CORS headers added via `addCorsHeaders()`.
- **Remaining Risk**: If user's domain has strict policies, or if Apps Script changes behavior.
- **Monitoring**: Test on target domain (sint-albertschool.be) after deployment.

### 2. Apps Script Execution Time Limits (LOW RISK)
**Status**: Accepted limitation
- **Issue**: 6-minute max execution time. Large photo uploads (3 × 5MB) with base64 processing could approach limit.
- **Mitigation**: Client-side compression reduces payload. Photos processed sequentially.
- **Remaining Risk**: Very slow connections may timeout during upload.
- **Fallback**: User sees error, can retry with smaller photos.

### 3. Google Drive Quota (LOW RISK)
**Status**: Monitored
- **Issue**: Google Workspace has Drive storage limits per domain.
- **Mitigation**: Photos compressed to ~100-300KB each. Max 3 per task.
- **Remaining Risk**: Long-term accumulation over years.
- **Future**: Implement cleanup policy (archive old photos, delete completed task photos after retention period).

### 4. Sheet Performance at Scale (MEDIUM RISK)
**Status**: Addressed with quarterly rotation
- **Issue**: Google Sheets slows down >10k rows. Large sheets impact `getDataRange()` performance.
- **Mitigation**: Quarterly sheet rotation (`createNewQuarterSheet()`) keeps active sheet small. Only unfinished tasks copied forward.
- **Remaining Risk**: If quarter has >10k tasks, or if archived sheets needed for queries.
- **Future**: Consider BigQuery export for historical analysis.

### 5. Token Storage in localStorage (MEDIUM RISK)
**Status**: Accepted trade-off for SPA
- **Issue**: localStorage vulnerable to XSS. HttpOnly cookies not possible with Apps Script cross-origin.
- **Mitigation**: 
  - All XSS vectors fixed (textContent, no innerHTML with user data)
  - Short token TTL (15 minutes)
  - Token auto-cleared on expiry
  - Server validates every request
- **Remaining Risk**: If new XSS vector discovered, token could be stolen.
- **Future**: Consider rotating tokens, device fingerprinting.

### 6. No Offline Queue for Submissions (LOW RISK)
**Status**: Deferred per requirements
- **Issue**: If user submits while offline, report fails.
- **Mitigation**: Clear error message, form data preserved, user can retry.
- **Remaining Risk**: User may lose work if they close browser before retry.
- **Future**: Implement IndexedDB queue with Background Sync API.

### 7. Single Maintenance Worker Email (LOW RISK)
**Status**: Current requirement
- **Issue**: Only one worker email configured (`maartenderyck@sint-albertschool.be`).
- **Mitigation**: Script Properties can store comma-separated list; `isWorker()` can be extended.
- **Remaining Risk**: If worker changes, need to update Script Properties.
- **Future**: Add admin UI for worker management.

### 8. No Automated Backup (LOW RISK)
**Status**: Relies on Google infrastructure
- **Issue**: No explicit backup of Sheets/Drive beyond Google's redundancy.
- **Mitigation**: Google Workspace has built-in redundancy and version history.
- **Remaining Risk**: Accidental deletion by admin not recoverable after 30 days.
- **Future**: Periodic export to secondary storage.

### 9. Mobile Browser Service Worker Quirks (LOW RISK)
**Status**: Tested on major browsers
- **Issue**: iOS Safari has aggressive SW cache eviction; Android Chrome may not update SW immediately.
- **Mitigation**: Version bump on deploy; network-first for code.
- **Remaining Risk**: Users may see stale UI after deploy until SW updates.
- **Monitoring**: Check "Update on reload" in SW registration.

### 10. No Rate Limiting on API (LOW RISK)
**Status**: Accepted for internal use
- **Issue**: No rate limiting on login or API endpoints.
- **Mitigation**: Internal domain only; Apps Script has built-in quotas.
- **Remaining Risk**: Brute-force login attempts possible.
- **Future**: Add login attempt tracking with exponential backoff.

---

## Future Enhancements (Priority Order)

### Phase 1: Immediate (Post-Launch)
1. **QR Code Integration**
   - Add `?location=ROOM-204` URL parameter handling in staff.html
   - Pre-fill location field from query string
   - Generate QR codes for rooms/assets

2. **Dashboard Improvements**
   - Add task counts by status to worker.html header
   - Visual indicators for urgent tasks (pulse animation)
   - Sort options (date, urgency, status)

3. **Photo Enhancements**
   - Thumbnail generation in Drive (Apps Script Advanced Drive Service)
   - Completion photo upload (separate field)
   - Photo annotations/drawing

### Phase 2: Short-term (1-3 months)
4. **Multi-worker Support**
   - Admin UI to manage worker emails
   - Role field in token (staff vs worker)
   - Staff can only see their own submissions

5. **Notifications**
   - Email on new urgent task (Apps Script trigger)
   - Email on task assignment/status change
   - In-app notification badge

6. **Reporting/Export**
   - Export tasks to CSV/PDF
   - Monthly maintenance summary
   - Time-to-resolution metrics

7. **Advanced Search**
   - Full-text search on description/notes
   - Date range filters
   - Combined filters with AND/OR

### Phase 3: Medium-term (3-6 months)
8. **Offline Support**
   - IndexedDB queue for offline submissions
   - Background Sync API for auto-retry
   - Optimistic UI updates

9. **Asset/Location Management**
   - Hierarchical locations (Building > Floor > Room)
   - Asset registry (equipment with QR codes)
   - Location-based task grouping

10. **Mobile App Wrapper**
    - Capacitor/Cordova wrapper for app stores
    - Push notifications via FCM
    - Native camera integration

### Phase 4: Long-term (6+ months)
11. **Analytics Dashboard**
    - Trends, bottlenecks, workload distribution
    - Predictive maintenance scheduling
    - Cost tracking (materials, time)

12. **Integration APIs**
    - REST API for external systems
    - Webhook on task events
    - CMMS integration

---

## Technical Debt to Address

| Item | Location | Effort | Priority |
|------|----------|--------|----------|
| TypeScript migration | Frontend JS | Medium | Low |
| Unit tests (Jest) | Frontend & Apps Script | High | Medium |
| E2E tests (Playwright) | Full stack | High | Medium |
| CI/CD pipeline | GitHub Actions | Medium | Low |
| Error tracking (Sentry) | Frontend | Low | Low |
| Performance monitoring | Apps Script | Medium | Low |
| Accessibility audit | HTML/CSS | Medium | Medium |
| i18n (Dutch/English) | All user strings | Medium | Low |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-22 | Form-urlencoded over JSON | Eliminates CORS preflight; Apps Script compatible |
| 2026-08-22 | SHA-256 with 10k iterations | Apps Script lacks PBKDF2; acceptable for internal use |
| 2026-08-22 | 15-min token TTL | Balance security vs usability; short enough for safety |
| 2026-08-22 | Year-based Drive folders | Scalability; avoids single-folder limits |
| 2026-08-22 | Quarterly sheet rotation | Performance; matches school calendar |
| 2026-08-22 | State machine on backend | Data integrity; frontend can't be trusted |
| 2026-08-22 | LockService on all writes | Race condition prevention; required for Sheets |
| 2026-08-22 | ES modules (type=module) | Modern standard; explicit dependencies; no globals |
| 2026-08-22 | No framework (vanilla JS) | Zero dependencies; simple maintenance; fast load |
| 2026-08-22 | GitHub Pages hosting | Free, reliable, integrates with workflow |

---

## Sign-off

This risk assessment should be reviewed:
- **Before launch**: Verify all mitigations tested
- **1 month post-launch**: Check for new issues
- **Quarterly**: Review with maintenance worker feedback
- **Annually**: Full architecture review

**Prepared by**: AI Assistant (Nemotron 3 Ultra)
**Date**: 2026-08-22
**Project**: School Maintenance Reporter PWA