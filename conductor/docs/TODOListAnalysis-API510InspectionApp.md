# TODO List Analysis - API 510 Inspection App

**Analysis Date**: 2026-01-11  
**Total TODO Items**: 1,669 lines  
**Completed Items**: ~85%  
**Pending Items**: ~15%

---

## Critical Pending Items (P0)

### Calculation Accuracy Issues

1. **Head MAWP Calculations**
   - East Head should be 263.9 psi
   - West Head should be 262.5 psi
   - Status: PDF has internal inconsistencies (see CALCULATION_ANALYSIS.md)

2. **Minimum Required Thickness for Heads**
   - Should be 0.500"
   - Depends on E value
   - Status: Needs verification

3. **Remaining Life Calculations**
   - East Head: should be >13 years
   - West Head: should be >15 years
   - Depends on correct thickness values

4. **Radius Correction**
   - Should be 36.375 inches not 35.5 inches
   - Impacts all calculations

### Data Quality Issues

5. **Executive Summary Table**
   - ✅ Fixed: Show Nominal Thickness, Min Required, Calculated MAWP columns
   - ✅ Fixed: Vessel Shell actual thickness showing blank

6. **Component Organization**
   - Calculate separate calculations for shell, east head, west head
   - Organize thickness readings by component type

---

## High Priority Items (P1)

### PDF Parsing & Data Extraction

1. **Multi-Page Thickness Tables**
   - Fix PDF extraction to correctly parse multi-page tables
   - Currently may miss data on subsequent pages

2. **Nozzle Data Extraction**
   - Extract nozzle sizes from descriptions (24", 3", 2", 1")
   - Extract nozzle types (Manway, Relief, Vapor Out, etc.)
   - ✅ Partially complete: Auto-creation from TML readings

3. **Missing Vessel Data Fields**
   - ✅ Added: MDMT, Operating Temp, Product, Construction Code, Vessel Config, Head Type, Insulation

4. **Component Name Truncation**
   - Fix "Vessel..." should show full "Vessel Shell"

5. **Thickness Table Enhancements**
   - Add tmin column to thickness measurements table
   - Calculate and display corrosion rates in thickness table

### CML and Thickness Reading Organization

6. **CML Duplicate Entries**
   - ✅ Fixed: CML duplicate entries in thickness measurements

7. **Multi-Angle Readings**
   - Improve CML matching logic to handle multi-angle readings per CML

8. **Head Readings Organization**
   - Group East Head seam readings (CML 6-7) separately from spot readings
   - Group West Head seam readings (CML 16-17) separately from spot readings
   - Add spot readings by clock position (12, 3, 6, 9 o'clock)

---

## Medium Priority Items (P2)

### Report Content Extraction

1. **Section 3.0 Inspection Results**
   - Extract Foundation, Shell, Heads, Appurtenances findings
   - Currently not extracted from PDF

2. **Section 4.0 Recommendations**
   - Extract recommendations from PDF
   - Currently not extracted

3. **Appendices References**
   - Add references to Appendices A-G

### Visualization & UX

4. **Thickness Trend Charts**
   - Add thickness trend charts/visualizations
   - Show corrosion trends over time

5. **Before/After Comparison**
   - Show before/after comparison of thickness readings
   - When uploading new UT results

---

## Low Priority Items (P3)

1. **Photograph Extraction**
   - Extract and display photographs from PDF

2. **Inspection Checklist**
   - Extract inspection checklist items

3. **Manufacturer Data Sheet References**
   - Add manufacturer data sheet references

4. **Report Formatting**
   - Improve report formatting to match professional PDF layout

---

## Testing Items

1. **Calculation Testing**
   - Test all calculations with real data
   - Verify ASME Section VIII formulas

2. **Photo Upload Testing**
   - Test photo upload functionality

3. **PDF Generation Testing**
   - Test PDF generation with all data populated

4. **Data Import Testing**
   - Test with real inspection PDFs
   - Test with 2017 baseline + 2025 UT readings scenario

---

## Integration & Configuration

1. **Sentry Configuration**
   - Configure Sentry DSN in environment
   - Test error capture
   - Use for debugging

2. **PDF Rendering Solution**
   - Need pure JavaScript PDF rendering solution
   - pdf-to-png-converter requires system dependencies not available in production
   - Consider using pdfjs-dist with node-canvas-webgl

---

## Track Recommendations

Based on the analysis, here are the recommended tracks in priority order:

### Track 003: Fix Critical Calculation Accuracy Issues (P0)
**Priority**: Critical  
**Estimated Effort**: 8 hours  
**Impact**: High - Ensures calculation accuracy for safety-critical application

**Objectives**:
1. Fix radius value (36.375" not 35.5")
2. Verify and fix head MAWP calculations
3. Fix minimum required thickness for heads
4. Fix remaining life calculations for heads
5. Validate all calculations against professional report

### Track 004: Enhance Data Extraction & Organization (P1)
**Priority**: High  
**Estimated Effort**: 12 hours  
**Impact**: High - Improves data quality and completeness

**Objectives**:
1. Fix multi-page thickness table parsing
2. Complete nozzle data extraction (sizes, types)
3. Add tmin and corrosion rate columns to thickness table
4. Improve CML matching for multi-angle readings
5. Organize head readings by seam vs spot, clock position

### Track 005: Extract Inspection Results & Recommendations (P2)
**Priority**: Medium  
**Estimated Effort**: 6 hours  
**Impact**: Medium - Completes report content extraction

**Objectives**:
1. Extract Section 3.0 Inspection Results
2. Extract Section 4.0 Recommendations
3. Add appendices references
4. Improve report formatting

### Track 006: Add Thickness Trend Visualization (P2)
**Priority**: Medium  
**Estimated Effort**: 8 hours  
**Impact**: Medium - Enhances user experience and data insights

**Objectives**:
1. Create thickness trend charts
2. Add before/after comparison view
3. Show corrosion trends over time
4. Add visual indicators for critical components

### Track 007: Integrate Validation Warnings into UI (New)
**Priority**: High  
**Estimated Effort**: 10 hours  
**Impact**: High - Leverages Track 001 & 002 validation work

**Objectives**:
1. Display validation warnings in calculations tab
2. Add visual indicators for critical warnings
3. Create validation summary section in report
4. Add warning badges to component tables
5. Generate validation report PDF

---

## Recommended Next Track

**Track 003: Fix Critical Calculation Accuracy Issues**

This track should be prioritized because:

1. **Safety Critical**: Calculation accuracy is paramount for pressure vessel inspection
2. **Builds on Track 001 & 002**: Leverages the validation framework we just built
3. **High Impact**: Fixes known discrepancies in professional reports
4. **Clear Scope**: Well-defined issues with specific target values
5. **Testable**: Can validate against known correct values from professional reports

**Alternative**: If you prefer to see the validation warnings in action first, we could do **Track 007** to integrate the validation UI, which would make the validation work immediately visible to users.

---

## Summary Statistics

**Total Pending Items**: ~250 (15% of 1,669 lines)

**By Priority**:
- P0 (Critical): ~10 items
- P1 (High): ~20 items
- P2 (Medium): ~15 items
- P3 (Low): ~10 items
- Testing: ~10 items
- Configuration: ~5 items

**Estimated Total Effort**: ~50-60 hours to complete all pending items

**Recommended Approach**: Complete tracks sequentially, starting with P0 critical items, then move to P1 high priority items.
