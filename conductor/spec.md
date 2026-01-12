# Track 002: Extend Edge Case Validation to All Head Types

## Status: [~] In Progress

## Overview

**Type**: Enhancement  
**Priority**: High  
**Created**: 2026-01-11  
**Dependencies**: Track 001 (Complete)

## Problem Statement

Track 001 successfully implemented comprehensive edge case validation for torispherical heads, achieving 100% test coverage and adding 8 categories of validation. However, the application also calculates minimum thickness and MAWP for other head types and shell components that currently lack this same level of validation:

- **Ellipsoidal Heads** (2:1 ellipsoidal)
- **Hemispherical Heads**
- **Flat Heads**
- **Conical Sections**
- **Cylindrical Shells**

Without comprehensive validation, these calculation types are vulnerable to the same edge cases that Track 001 addressed for torispherical heads.

## Objectives

### Primary Objectives

1. **Extend validation to ellipsoidal heads**
   - K factor validation
   - Pressure ratio validation
   - Denominator safety
   - Thickness and corrosion edge cases
   - MAWP validation

2. **Extend validation to hemispherical heads**
   - Simplified validation (simpler geometry)
   - Pressure ratio validation
   - Denominator safety
   - Thickness and corrosion edge cases
   - MAWP validation

3. **Extend validation to flat heads**
   - C factor validation (attachment factor)
   - d/D ratio validation
   - Pressure ratio validation
   - Denominator safety
   - Thickness and corrosion edge cases
   - MAWP validation

4. **Extend validation to conical sections**
   - Alpha (half apex angle) validation
   - Pressure ratio validation
   - Denominator safety
   - Thickness and corrosion edge cases
   - MAWP validation

5. **Extend validation to cylindrical shells**
   - Circumferential vs longitudinal stress validation
   - Pressure ratio validation
   - Denominator safety
   - Thickness and corrosion edge cases
   - MAWP validation

### Secondary Objectives

1. **Reuse existing validation helpers** from Track 001
2. **Maintain 100% test coverage** for all calculation types
3. **Ensure zero regressions** in existing tests
4. **Maintain performance** (< 1ms overhead per calculation)
5. **Provide comprehensive documentation**

## Scope

### In Scope

✅ Validation for all 5 head/shell types:
- Ellipsoidal heads
- Hemispherical heads
- Flat heads
- Conical sections
- Cylindrical shells

✅ All validation categories applicable to each type:
- Geometry-specific validations (K, C, alpha, etc.)
- Pressure to stress ratio validation
- Denominator safety validation
- Default parameter tracking
- Actual thickness edge cases
- Corrosion rate edge cases
- MAWP validation

✅ Comprehensive test coverage (target >95%)

✅ Documentation updates

### Out of Scope

❌ UI integration (separate track)
❌ Validation history tracking (future enhancement)
❌ User-configurable thresholds (future enhancement)
❌ Nozzle calculations (separate component)

## Technical Approach

### 1. Ellipsoidal Heads

**Formula**: `t = PD*K / (2SE - 0.2P)`  
**K Factor**: `K = 1/6 * (2 + (D/(2h))^2)` where h = head height

**Validations**:
- K factor bounds (typically 0.9 to 1.2 for 2:1 ellipsoidal)
- D/(2h) ratio validation
- Pressure ratio validation
- Denominator safety
- Thickness, corrosion, MAWP edge cases

### 2. Hemispherical Heads

**Formula**: `t = PR / (2SE - 0.2P)`

**Validations** (simpler due to simple geometry):
- R = D/2 validation
- Pressure ratio validation
- Denominator safety
- Thickness, corrosion, MAWP edge cases

### 3. Flat Heads

**Formula**: `t = d * sqrt(CP / SE)`

**Validations**:
- C factor bounds (0.10 to 0.33)
- d/D ratio validation
- Pressure validation (flat heads have pressure limits)
- Thickness, corrosion, MAWP edge cases

### 4. Conical Sections

**Formula**: `t = PD / (2*cos(alpha)*(SE - 0.6P))`

**Validations**:
- Alpha (half apex angle) bounds (typically 0° to 60°)
- cos(alpha) validation
- Pressure ratio validation
- Denominator safety
- Thickness, corrosion, MAWP edge cases

### 5. Cylindrical Shells

**Formulas**:
- Circumferential: `t = PR / (SE - 0.6P)`
- Longitudinal: `t = PR / (2SE + 0.4P)`

**Validations**:
- Pressure ratio validation (different for circ vs long)
- Denominator safety (both formulas)
- Thickness, corrosion, MAWP edge cases
- Governing condition validation

## Validation Categories by Type

| Category | Ellipsoidal | Hemispherical | Flat | Conical | Shell |
|----------|-------------|---------------|------|---------|-------|
| Geometry-specific | K factor | R=D/2 | C factor, d/D | alpha | - |
| P/(SE) Ratio | ✅ | ✅ | ✅ | ✅ | ✅ |
| Denominator Safety | ✅ | ✅ | N/A | ✅ | ✅ |
| Default Tracking | h | R | C, d | - | - |
| Thickness Edge Cases | ✅ | ✅ | ✅ | ✅ | ✅ |
| Corrosion Edge Cases | ✅ | ✅ | ✅ | ✅ | ✅ |
| MAWP Validation | ✅ | ✅ | ✅ | ✅ | ✅ |

## Success Criteria

### Functional Requirements

✅ All 5 calculation types have comprehensive validation  
✅ All applicable validation categories implemented  
✅ Reuse existing helper functions from Track 001  
✅ Clear, actionable error messages  
✅ Warnings array populated with edge case details

### Quality Requirements

✅ **Test Coverage**: >95% for all calculation types  
✅ **No Regressions**: All existing tests pass  
✅ **Performance**: < 1ms overhead per calculation  
✅ **Code Quality**: TypeScript-compliant, formatted, documented

### Documentation Requirements

✅ Update EDGE_CASE_VALIDATION.md with new validations  
✅ Add validation examples for each head type  
✅ Update JSDoc comments  
✅ Create Track 002 completion summary

## Test Plan

### Test Coverage Goals

- **Ellipsoidal**: 30+ tests
- **Hemispherical**: 20+ tests
- **Flat**: 30+ tests
- **Conical**: 25+ tests
- **Shell**: 35+ tests

**Total New Tests**: ~140 tests

### Test Categories

For each head/shell type:

1. **Geometry-specific validation tests** (5-10 tests)
2. **Pressure ratio validation tests** (3-5 tests)
3. **Denominator safety tests** (3-5 tests)
4. **Thickness edge case tests** (5 tests)
5. **Corrosion edge case tests** (4 tests)
6. **MAWP validation tests** (5 tests)

### Integration Tests

- Verify no regressions in existing tests
- Cross-validation between head types
- Performance benchmarks

## Deliverables

### Code

1. **Enhanced calculation functions**:
   - `calculateEllipsoidalHead()` with validation
   - `calculateHemisphericalHead()` with validation
   - `calculateFlatHead()` with validation
   - `calculateConicalSection()` with validation
   - `calculateShell()` with validation

2. **Test files**:
   - `asmeCalculations.ellipsoidal.validation.test.ts`
   - `asmeCalculations.hemispherical.validation.test.ts`
   - `asmeCalculations.flat.validation.test.ts`
   - `asmeCalculations.conical.validation.test.ts`
   - `asmeCalculations.shell.validation.test.ts`

### Documentation

1. **EDGE_CASE_VALIDATION.md** (updated)
   - Add sections for each head type
   - Validation rules and examples
   - ASME code references

2. **Track 002 Completion Summary**
   - Implementation details
   - Test results
   - Success metrics

3. **Updated tracks.md**

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Different formulas require different validations | Medium | Analyze each formula carefully, reuse patterns |
| Test count is high (~140 tests) | Low | Use TDD, implement incrementally |
| Performance impact from many validations | Low | Reuse efficient helper functions |
| Flat head formula is different (no denominator) | Medium | Adapt validation approach for sqrt formula |

## Timeline Estimate

- **Ellipsoidal validation**: 4 hours
- **Hemispherical validation**: 2 hours
- **Flat validation**: 4 hours
- **Conical validation**: 3 hours
- **Shell validation**: 5 hours
- **Integration & documentation**: 3 hours

**Total Estimated Effort**: ~21 hours

## Dependencies

- ✅ Track 001 complete (validation infrastructure exists)
- ✅ Helper functions available (`validateRatio`, `validateDenominator`, etc.)
- ✅ Test infrastructure in place

## References

- ASME Section VIII Division 1, UG-32 (Heads)
- ASME Section VIII Division 1, UG-27 (Shells)
- ASME Section VIII Division 1, UG-34 (Flat Heads)
- Track 001 implementation and documentation
- Existing calculation functions in `asmeCalculations.ts`

---

**Created**: 2026-01-11  
**Author**: Manus AI Agent  
**Track**: 002
