# Track 003: Fix Critical Calculation Accuracy Issues

**Track ID**: 003  
**Priority**: P0 - Critical  
**Type**: Bug Fix  
**Status**: Pending  
**Created**: 2026-01-11

---

## Problem Statement

The API 510 Inspection Application currently has several critical calculation accuracy issues that cause discrepancies between calculated values and professional inspection reports. These issues affect the safety-critical calculations for pressure vessel integrity assessment.

### Known Discrepancies

1. **Radius Value**: Using 35.5 inches instead of correct 36.375 inches
2. **Head MAWP Calculations**: East Head and West Head MAWP values don't match professional report
3. **Minimum Required Thickness**: Head minimum thickness calculations may be incorrect
4. **Remaining Life**: East and West Head remaining life calculations are off

These discrepancies undermine user confidence in the application and could lead to incorrect safety assessments.

---

## Objectives

### Primary Objectives

1. **Fix Radius Value**
   - Correct radius from 35.5" to 36.375"
   - Verify radius calculation logic
   - Ensure radius is correctly extracted from PDF imports

2. **Verify and Fix Head MAWP Calculations**
   - East Head: Target 263.9 psi
   - West Head: Target 262.5 psi
   - Investigate PDF internal inconsistencies noted in CALCULATION_ANALYSIS.md

3. **Fix Minimum Required Thickness for Heads**
   - Target: 0.500" for heads
   - Verify E (joint efficiency) value is correct
   - Check if formula uses correct head type factors

4. **Fix Remaining Life Calculations**
   - East Head: Target >13 years
   - West Head: Target >15 years
   - Ensure corrosion rates are calculated correctly
   - Verify thickness values used in calculations

5. **Validate Against Professional Report**
   - Compare all calculated values with professional report
   - Document any remaining discrepancies
   - Identify root causes of differences

### Secondary Objectives

1. **Add Calculation Verification Tests**
   - Create tests using professional report values
   - Ensure calculations match within acceptable tolerance
   - Add regression tests to prevent future issues

2. **Document Calculation Logic**
   - Document all formulas used
   - Explain any assumptions or defaults
   - Reference ASME code sections

---

## Scope

### In Scope

- Fixing radius value throughout application
- Correcting head MAWP calculation formulas
- Fixing minimum thickness calculations for heads
- Correcting remaining life calculations
- Adding verification tests against professional report
- Documenting calculation logic

### Out of Scope

- Shell calculations (already validated in Track 001 & 002)
- Nozzle calculations (separate track)
- UI changes (separate track)
- PDF parsing improvements (separate track)

---

## Technical Details

### Current Issues

#### 1. Radius Value

**Current Behavior**:
- Radius = 35.5 inches

**Expected Behavior**:
- Radius = 36.375 inches

**Root Cause**:
- May be using inside diameter / 2 instead of mean radius
- Or incorrect diameter value being used

**Fix**:
- Verify diameter source (should be 72.75" OD or 72" ID)
- Calculate correct radius: R = (ID + CA) or R = (OD - 2*t_nom)/2
- Update all calculations using radius

#### 2. Head MAWP Calculations

**Current Behavior**:
- East Head MAWP: Unknown (needs verification)
- West Head MAWP: Unknown (needs verification)

**Expected Behavior**:
- East Head MAWP: 263.9 psi
- West Head MAWP: 262.5 psi

**Root Cause**:
- May be using incorrect formula
- May be using incorrect thickness values
- May be using incorrect head type factor

**Investigation Needed**:
- Check CALCULATION_ANALYSIS.md for PDF inconsistencies
- Verify which thickness values to use (nominal, actual, minimum)
- Verify head type (torispherical, ellipsoidal, hemispherical)

**Formula** (depends on head type):
- Torispherical: MAWP = 2SEt / (LM - 0.2t)
- Ellipsoidal: MAWP = 2SEt / (KD - 0.2t)
- Hemispherical: MAWP = 2SEt / (R - 0.2t)

#### 3. Minimum Required Thickness for Heads

**Current Behavior**:
- Unknown (needs verification)

**Expected Behavior**:
- t_min = 0.500" for heads

**Root Cause**:
- May be using incorrect E value
- May be using incorrect head type factor
- May be using incorrect pressure (with/without static head)

**Formula** (depends on head type):
- Torispherical: t_min = PLM / (2SE - 0.2P)
- Ellipsoidal: t_min = PKD / (2SE - 0.2P)
- Hemispherical: t_min = PR / (2SE - 0.2P)

**Parameters to Verify**:
- P = Design pressure + static head
- S = Allowable stress (20,000 psi)
- E = Joint efficiency (0.85 or 1.0?)
- L, M, K = Head factors (depends on head geometry)
- R = Radius (36.375")

#### 4. Remaining Life Calculations

**Current Behavior**:
- East Head RL: Unknown
- West Head RL: Unknown

**Expected Behavior**:
- East Head RL: >13 years
- West Head RL: >15 years

**Root Cause**:
- May be using incorrect thickness values
- May be using incorrect corrosion rates
- May be using incorrect t_min in Ca calculation

**Formula**:
- Ca = t_act - t_min (corrosion allowance remaining)
- Cr = (t_prev - t_act) / Years (corrosion rate)
- RL = Ca / Cr (remaining life)

**Verification Needed**:
- Check which thickness values are being used
- Verify corrosion rates are calculated correctly
- Ensure t_min is correct (see issue #3)

---

## Acceptance Criteria

### Must Have

1. ✅ Radius corrected to 36.375 inches throughout application
2. ✅ East Head MAWP calculation matches 263.9 psi (or documented reason for difference)
3. ✅ West Head MAWP calculation matches 262.5 psi (or documented reason for difference)
4. ✅ Head minimum thickness calculations produce 0.500" (or documented reason for difference)
5. ✅ East Head remaining life >13 years
6. ✅ West Head remaining life >15 years
7. ✅ All calculations validated against professional report
8. ✅ Verification tests added using professional report values
9. ✅ Zero regressions in existing tests (203 tests still passing)

### Should Have

1. ✅ Calculation logic fully documented
2. ✅ ASME code references added to formulas
3. ✅ Assumptions and defaults documented
4. ✅ Tolerance ranges defined for acceptable differences

### Nice to Have

1. ✅ Comparison report showing old vs new calculations
2. ✅ Visual indicators for calculations that match professional report
3. ✅ Calculation audit trail

---

## Success Metrics

1. **Accuracy**: All calculations match professional report within ±1% or documented reason
2. **Test Coverage**: 100% of critical calculations have verification tests
3. **Regression**: Zero test failures in existing 203 tests
4. **Documentation**: All formulas documented with ASME references

---

## Dependencies

- Track 001 & 002 (Validation framework) - Complete ✅
- Professional inspection report with correct values
- CALCULATION_ANALYSIS.md document
- Access to ASME Section VIII code for reference

---

## Risks & Mitigation

### Risk 1: PDF Internal Inconsistencies

**Risk**: Professional report may have internal inconsistencies  
**Impact**: High - May not have "correct" values to target  
**Mitigation**: 
- Review CALCULATION_ANALYSIS.md
- Calculate values independently using ASME formulas
- Document any discrepancies found in professional report

### Risk 2: Unknown Head Type

**Risk**: May not know exact head type (torispherical vs ellipsoidal)  
**Impact**: High - Different formulas for different head types  
**Mitigation**:
- Check PDF for head type specification
- Check vessel drawings if available
- Use typical head type for vessel size (likely torispherical)

### Risk 3: Unknown E Value

**Risk**: Joint efficiency (E) may not be specified  
**Impact**: Medium - Affects all thickness calculations  
**Mitigation**:
- Check PDF for E value
- Use typical E=0.85 for spot-examined vessels
- Document assumption

### Risk 4: Breaking Existing Calculations

**Risk**: Fixing calculations may break existing functionality  
**Impact**: High - Could introduce new bugs  
**Mitigation**:
- Use TDD approach (write tests first)
- Run full test suite after each change
- Leverage validation framework from Track 001 & 002

---

## Timeline Estimate

**Total Effort**: 8 hours

### Phase 1: Investigation (2 hours)
- Review CALCULATION_ANALYSIS.md
- Verify current calculation logic
- Identify root causes of discrepancies

### Phase 2: Fix Radius (1 hour)
- Correct radius value
- Update all calculations using radius
- Test and verify

### Phase 3: Fix Head Calculations (3 hours)
- Fix MAWP calculations for heads
- Fix minimum thickness calculations
- Fix remaining life calculations
- Add verification tests

### Phase 4: Validation & Documentation (2 hours)
- Validate all calculations against professional report
- Document all formulas and assumptions
- Create comparison report
- Update tests

---

## Related Tracks

- **Track 001**: Fix ASME Calculation Edge Cases for Torispherical Heads (Complete)
- **Track 002**: Extend Edge Case Validation to All Head Types (Complete)
- **Track 004**: Enhance Data Extraction & Organization (Pending)
- **Track 007**: Integrate Validation Warnings into UI (Pending)

---

## References

- ASME Section VIII Division 1: Pressure Vessels
  - UG-27: Thickness of Shells Under Internal Pressure
  - UG-32: Formed Heads, Pressure on Concave Side
- API 510: Pressure Vessel Inspection Code
- Professional Inspection Report (reference document)
- CALCULATION_ANALYSIS.md (internal analysis)

---

**Created By**: Manus AI Development Team  
**Date**: 2026-01-11  
**Status**: Ready for Implementation
