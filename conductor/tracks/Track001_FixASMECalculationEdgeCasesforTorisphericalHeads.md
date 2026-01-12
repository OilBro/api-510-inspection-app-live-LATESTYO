# Track 001: Fix ASME Calculation Edge Cases for Torispherical Heads

## Overview

This track addresses critical edge cases and validation issues in the ASME Section VIII Division 1 torispherical head calculations. The current implementation has basic validation but lacks comprehensive edge case handling that could lead to incorrect calculations or runtime errors in production.

## Problem Statement

The torispherical head calculation engine (`asmeCalculations.ts`) implements the ASME UG-32(e) formula correctly for typical cases, but several edge cases are not properly handled:

1. **Extreme L/r Ratios**: When the crown radius (L) to knuckle radius (r) ratio is outside ASME-acceptable ranges, the M factor calculation may produce unrealistic results
2. **Missing or Zero Parameters**: While basic validation exists, edge cases like very small positive values (near-zero) are not handled
3. **Pressure Limits**: No validation that design pressure doesn't exceed material stress limits
4. **M Factor Bounds**: No validation that calculated M factor falls within physically reasonable bounds (typically 1.0 to 2.5)
5. **Denominator Safety**: While zero denominators are checked, values very close to zero that could cause numerical instability are not
6. **Default Value Assumptions**: When L and r are not provided, defaults are used (L=D, r=0.06D) without warning the user
7. **MAWP Calculation Edge Cases**: The MAWP formula may produce unrealistic values for edge case inputs
8. **Corrosion Rate Edge Cases**: When actual thickness approaches or falls below minimum thickness, remaining life calculations may produce negative or infinite values

## Current Implementation

### Formula (ASME UG-32(e))
```
Minimum Thickness: t = PLM / (2SE - 0.2P)
MAWP: P = 2SEt / (LM + 0.2t)
M Factor: M = 0.25 * (3 + sqrt(L/r))
```

### Current Validation
```typescript
if (P <= 0 || S <= 0 || E <= 0 || E > 1 || D <= 0 || L <= 0 || r <= 0) {
  throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, D=${D}, L=${L}, r=${r}`);
}

const denom = 2 * S * E - 0.2 * P;
if (denom <= 0) {
  throw new Error(`Invalid calculation: (2SE - 0.2P) = ${denom.toFixed(4)} <= 0`);
}
```

## Identified Edge Cases

### 1. L/r Ratio Validation
**Issue**: ASME UG-32(e) requires L/r ≤ 16.67 for standard F&D heads. Ratios outside this range may not be valid.

**Current Behavior**: No validation, accepts any positive L and r values

**Expected Behavior**: 
- Warn if L/r > 20 (non-standard head)
- Error if L/r > 100 (physically unrealistic)
- Warn if L/r < 5 (unusual geometry)

**Test Cases**:
- L=100, r=1 → L/r=100 (should error)
- L=100, r=5 → L/r=20 (should warn)
- L=70, r=20 → L/r=3.5 (should warn)

### 2. M Factor Bounds Validation
**Issue**: M factor should typically be between 1.0 and 2.5 for real heads. Values outside this range indicate input errors.

**Current Behavior**: No validation on calculated M factor

**Expected Behavior**:
- Warn if M < 1.5 or M > 2.5 (unusual but possible)
- Error if M < 1.0 or M > 3.0 (physically unrealistic)

**Test Cases**:
- M = 0.8 (should error)
- M = 1.2 (should warn)
- M = 3.5 (should error)

### 3. Pressure to Stress Ratio
**Issue**: Design pressure should not exceed a reasonable fraction of allowable stress

**Current Behavior**: Only checks that denominator > 0

**Expected Behavior**:
- Warn if P > 0.5 * S * E (high pressure ratio)
- Error if P > 0.9 * S * E (denominator too small)

**Test Cases**:
- P=15000, S=20000, E=0.85 → P/SE=0.88 (should error)
- P=10000, S=20000, E=0.85 → P/SE=0.59 (should warn)

### 4. Near-Zero Denominator
**Issue**: Denominator (2SE - 0.2P) can be positive but very small, causing numerical instability

**Current Behavior**: Only checks if denominator ≤ 0

**Expected Behavior**:
- Warn if denominator < 1000 (numerical instability risk)
- Error if denominator < 100 (severe instability)

**Test Cases**:
- 2SE - 0.2P = 50 (should error)
- 2SE - 0.2P = 500 (should warn)

### 5. Default Parameter Warnings
**Issue**: When L and r are not provided, defaults are silently used without informing the user

**Current Behavior**: Uses L=D and r=0.06D silently

**Expected Behavior**:
- Return warning flags indicating default values were used
- Include in calculation results metadata

**Test Cases**:
- L=undefined, r=undefined → should set warning flags
- L=70, r=undefined → should warn about r only

### 6. Actual Thickness Edge Cases
**Issue**: When actual thickness is at or below minimum, calculations may produce invalid results

**Current Behavior**: Basic calculation, may produce negative Ca or infinite RL

**Expected Behavior**:
- If t_act ≤ t_min: Ca = 0, RL = 0, isCompliant = false
- If t_act < 0.9 * t_min: Add critical warning
- Handle division by zero in corrosion rate calculations

**Test Cases**:
- t_act = 0.5, t_min = 0.6 → Ca = 0, RL = 0
- t_act = 0.4, t_min = 0.6 → Critical warning
- Cr = 0 → RL should be "infinite" or very large number

### 7. Corrosion Rate Edge Cases
**Issue**: Zero or negative corrosion rates cause division by zero in remaining life calculation

**Current Behavior**: May produce Infinity or NaN

**Expected Behavior**:
- If Cr ≤ 0: RL = undefined (no measurable corrosion)
- If Cr is very small (< 0.001): RL capped at reasonable maximum (e.g., 500 years)

**Test Cases**:
- Cr = 0 → RL = undefined
- Cr = 0.0001 → RL capped at 500 years
- Cr = -0.01 → RL = undefined (growth, not corrosion)

### 8. MAWP Calculation Edge Cases
**Issue**: MAWP calculation may produce unrealistic values for edge case inputs

**Current Behavior**: Direct calculation without bounds checking

**Expected Behavior**:
- Warn if calculated MAWP > 2 * design pressure
- Warn if calculated MAWP < 0.5 * design pressure
- Error if MAWP ≤ 0 or MAWP > 10 * design pressure

**Test Cases**:
- Calculated MAWP = 500 psi, design P = 150 psi → Warn
- Calculated MAWP = 50 psi, design P = 150 psi → Warn
- Calculated MAWP = -10 psi → Error

## Acceptance Criteria

### Functional Requirements
1. All edge cases listed above are properly validated
2. Appropriate error messages are thrown for invalid inputs
3. Warning flags are returned (not thrown) for suspicious but valid inputs
4. Calculation results include metadata about warnings and default values used
5. All existing tests continue to pass
6. New tests cover all identified edge cases

### Non-Functional Requirements
1. Error messages are clear and actionable
2. Performance impact is negligible (< 1ms additional per calculation)
3. Code is well-documented with edge case explanations
4. Validation logic is reusable across different calculation functions

## Success Metrics

1. **Test Coverage**: >95% coverage for torispherical calculation function
2. **Edge Case Coverage**: All 8 edge case categories have passing tests
3. **No Regressions**: All existing tests pass
4. **Production Safety**: No runtime errors in production for any valid input combination
5. **User Feedback**: Clear error messages that help users correct input errors

## Out of Scope

- Changes to the ASME formulas themselves (only validation)
- UI changes to display warnings (backend only)
- Changes to other head types (ellipsoidal, hemispherical)
- Database schema changes
- PDF parsing improvements

## Technical Notes

### ASME Standards Reference
- **ASME Section VIII Division 1, UG-32(e)**: Torispherical heads
- **Standard F&D Head**: L = D, r = 0.06D, L/r ≈ 16.67
- **M Factor Range**: Typically 1.5 to 2.0 for standard heads

### Validation Strategy
1. **Input Validation**: Check individual parameters
2. **Relationship Validation**: Check ratios and relationships (L/r, P/S)
3. **Output Validation**: Check calculated values for reasonableness
4. **Metadata**: Return warnings without throwing errors when appropriate

### Error Handling Approach
```typescript
interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning' | 'critical';
  value: number;
  expectedRange?: string;
}

interface CalculationResults {
  // ... existing fields
  warnings: ValidationWarning[];
  defaultsUsed: string[];
}
```

## Dependencies

- No new external dependencies required
- Existing test framework (Vitest)
- Existing calculation functions in `asmeCalculations.ts`

## Risk Assessment

**Low Risk**: 
- Changes are additive (validation only)
- Existing functionality unchanged
- Comprehensive test coverage

**Mitigation**:
- TDD approach ensures all edge cases are tested
- Gradual rollout with monitoring
- Rollback plan if issues detected
