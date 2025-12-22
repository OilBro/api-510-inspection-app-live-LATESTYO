# Data Issue Findings - Dec 21, 2025

## Inspection 54-11-005 (ID: 31Szaxnol2E9ueSa-k4Tm)

### Current State
- Vessel Data tab shows basic vessel info (design pressure 150 psi, SA-240 Type 316, etc.)
- The Vessel Data tab only shows vessel specifications, not TML readings
- TML readings are stored in the database but not visible on this page

### Database Query Results
- Only 2 distinct component/componentType combinations exist in TML readings
- Only 2 component calculations exist: Shell and East Head
- West Head calculation is missing
- No nozzle evaluations exist

### Root Causes Identified

1. **West Head Not Created**: The PDF import logic filters TML readings by component name patterns. If the PDF doesn't explicitly label readings as "West Head", "South Head", "Head 2", etc., the West Head calculation won't be created.

2. **Nozzles Empty**: Nozzle evaluations are a separate table (nozzleEvaluations) that must be populated either:
   - Manually via "Add Nozzle" button
   - Via Excel import
   - The PDF import does NOT auto-create nozzle evaluations

3. **Checklist Not Populated**: The checklist is designed to be filled out manually by inspectors during their inspection. It's not extracted from PDFs.

### Solutions Needed

1. **For West Head**: Need to either:
   - Improve PDF parsing to detect second head from location patterns
   - Add a "Recalculate" button that creates both heads even if only generic "Head" data exists
   - Allow manual addition of West Head component

2. **For Nozzles**: Need to either:
   - Extract nozzle data from PDF and auto-create nozzle evaluations
   - Provide clear instructions that nozzles must be imported separately

3. **For Checklist**: This is working as designed - it's a manual checklist
