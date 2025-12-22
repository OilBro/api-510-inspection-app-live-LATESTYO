# Critical Issues to Fix (Dec 21, 2025)

## User Reported Issues

1. **Settings page showing 404** - ✅ FIXED - Created LocationMappingSettings component and added route

2. **Nozzles not showing imported data** - Need to investigate nozzle auto-creation from PDF import

3. **Only one head showing in calculations** - Need to fix head detection for North/South naming
   - User says PDF has North Head and South Head
   - Current detection only finds East Head
   - Need to update detection logic to map North→East, South→West

4. **Checklist items not populating** - Checklist is manual (by design), not extracted from PDF

## Root Cause Analysis

### Head Detection Issue
The TML readings in the database have:
- `component`: "East Head" or "Vessel Shell"
- No "North Head" or "South Head" component names

The PDF may have North/South naming but the extraction mapped it to East Head only.

### Solution
1. Check the PDF extraction logic to see how heads are named
2. Update the detection patterns to include North/South
3. Ensure both heads are created during recalculate

## Files to Modify

1. `server/professionalReportRouters.ts` - recalculate function head detection
2. `server/professionalReportDb.ts` - generateDefaultCalculationsForInspection head detection
3. `server/routers.ts` - PDF import head detection
4. `server/routers/pdfImportRouter.ts` - PDF extraction head naming
