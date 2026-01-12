# Implementation Plan: Track 001 - Fix ASME Calculation Edge Cases for Torispherical Heads

## Status: [ ] Pending

## Overview

This plan implements comprehensive edge case validation for torispherical head calculations following Test-Driven Development (TDD) methodology. Each phase includes writing tests first (Red), implementing to pass tests (Green), and refactoring for quality.

---

## Phase 1: Define Validation Types and Interfaces

**Status**: [ ] Pending

**Objective**: Create TypeScript interfaces and types for validation warnings and enhanced calculation results.

### Tasks

#### Task 1.1: Define ValidationWarning Interface
**Status**: [ ] Pending

**Description**: Create interface for validation warnings that can be returned without throwing errors.

**Subtasks**:
- [ ] **Red**: Write test for ValidationWarning type structure
- [ ] **Green**: Define ValidationWarning interface in `asmeCalculations.ts`
  - Fields: `field`, `message`, `severity`, `value`, `expectedRange`
  - Severity: 'warning' | 'critical'
- [ ] **Refactor**: Add JSDoc documentation with examples
- [ ] **Verify**: Run `pnpm check` to ensure type safety
- [ ] **Commit**: `feat(calculations): Add ValidationWarning interface`

#### Task 1.2: Enhance CalculationResults Interface
**Status**: [ ] Pending

**Description**: Add warnings and metadata fields to existing CalculationResults interface.

**Subtasks**:
- [ ] **Red**: Write test expecting warnings and defaultsUsed fields
- [ ] **Green**: Add `warnings: ValidationWarning[]` and `defaultsUsed: string[]` to CalculationResults
- [ ] **Green**: Initialize empty arrays in all calculation functions
- [ ] **Refactor**: Update all return statements to include new fields
- [ ] **Verify**: Run existing tests to ensure no regressions
- [ ] **Commit**: `feat(calculations): Enhance CalculationResults with warnings`

---

## Phase 2: Implement Input Validation Functions

**Status**: [ ] Pending

**Objective**: Create reusable validation functions for common edge cases.

### Tasks

#### Task 2.1: Create validatePositiveNumber Function
**Status**: [ ] Pending

**Description**: Validate that a number is positive and not near-zero.

**Subtasks**:
- [ ] **Red**: Write tests for positive, zero, negative, and near-zero values
- [ ] **Green**: Implement `validatePositiveNumber(value, name, minValue?)`
  - Throw error if value ≤ 0
  - Warn if value < minValue (optional threshold)
- [ ] **Refactor**: Add clear error messages
- [ ] **Verify**: Test coverage >95%
- [ ] **Commit**: `feat(calculations): Add validatePositiveNumber helper`

#### Task 2.2: Create validateRatio Function
**Status**: [ ] Pending

**Description**: Validate that a ratio falls within acceptable bounds.

**Subtasks**:
- [ ] **Red**: Write tests for in-range, out-of-range, and boundary values
- [ ] **Green**: Implement `validateRatio(ratio, name, min, max, warnMin?, warnMax?)`
  - Error if ratio < min or ratio > max
  - Warn if ratio < warnMin or ratio > warnMax
  - Return ValidationWarning[] array
- [ ] **Refactor**: Make parameters configurable
- [ ] **Verify**: Test all boundary conditions
- [ ] **Commit**: `feat(calculations): Add validateRatio helper`

#### Task 2.3: Create validateDenominator Function
**Status**: [ ] Pending

**Description**: Validate that a denominator is safe for division.

**Subtasks**:
- [ ] **Red**: Write tests for zero, negative, near-zero, and safe values
- [ ] **Green**: Implement `validateDenominator(denom, expression, minSafe?)`
  - Error if denom ≤ 0
  - Warn if denom < minSafe (default 1000)
- [ ] **Refactor**: Include expression string in error message
- [ ] **Verify**: Test numerical stability edge cases
- [ ] **Commit**: `feat(calculations): Add validateDenominator helper`

---

## Phase 3: Implement L/r Ratio Validation

**Status**: [ ] Pending

**Objective**: Validate crown radius to knuckle radius ratio for torispherical heads.

### Tasks

#### Task 3.1: Add L/r Ratio Validation Tests
**Status**: [ ] Pending

**Description**: Write comprehensive tests for L/r ratio edge cases.

**Subtasks**:
- [ ] **Red**: Test L/r = 100 (should error)
- [ ] **Red**: Test L/r = 25 (should warn)
- [ ] **Red**: Test L/r = 16.67 (standard, should pass)
- [ ] **Red**: Test L/r = 3 (should warn)
- [ ] **Red**: Test L/r = 0.5 (should error)
- [ ] **Verify**: All tests fail initially
- [ ] **Commit**: `test(calculations): Add L/r ratio validation tests`

#### Task 3.2: Implement L/r Ratio Validation
**Status**: [ ] Pending

**Description**: Add L/r ratio validation to calculateTorisphericalHead function.

**Subtasks**:
- [ ] **Green**: Calculate L/r ratio after defaults are applied
- [ ] **Green**: Error if L/r > 100 or L/r < 1
- [ ] **Green**: Warn if L/r > 20 or L/r < 5
- [ ] **Green**: Add warnings to results.warnings array
- [ ] **Refactor**: Extract to separate validation function
- [ ] **Verify**: All L/r tests pass
- [ ] **Commit**: `feat(calculations): Add L/r ratio validation for torispherical heads`

---

## Phase 4: Implement M Factor Bounds Validation

**Status**: [ ] Pending

**Objective**: Validate that calculated M factor is within physically reasonable bounds.

### Tasks

#### Task 4.1: Add M Factor Validation Tests
**Status**: [ ] Pending

**Description**: Write tests for M factor edge cases.

**Subtasks**:
- [ ] **Red**: Test M = 0.8 (should error)
- [ ] **Red**: Test M = 1.2 (should warn)
- [ ] **Red**: Test M = 1.77 (standard, should pass)
- [ ] **Red**: Test M = 2.8 (should warn)
- [ ] **Red**: Test M = 3.5 (should error)
- [ ] **Verify**: All tests fail initially
- [ ] **Commit**: `test(calculations): Add M factor bounds validation tests`

#### Task 4.2: Implement M Factor Validation
**Status**: [ ] Pending

**Description**: Add M factor bounds checking after calculation.

**Subtasks**:
- [ ] **Green**: Error if M < 1.0 or M > 3.0
- [ ] **Green**: Warn if M < 1.5 or M > 2.5
- [ ] **Green**: Add warnings to results.warnings array
- [ ] **Refactor**: Use validateRatio helper function
- [ ] **Verify**: All M factor tests pass
- [ ] **Commit**: `feat(calculations): Add M factor bounds validation`

---

## Phase 5: Implement Pressure to Stress Ratio Validation

**Status**: [ ] Pending

**Objective**: Validate that design pressure is reasonable relative to allowable stress.

### Tasks

#### Task 5.1: Add Pressure Ratio Validation Tests
**Status**: [ ] Pending

**Description**: Write tests for P/(SE) ratio edge cases.

**Subtasks**:
- [ ] **Red**: Test P/(SE) = 0.95 (should error)
- [ ] **Red**: Test P/(SE) = 0.7 (should warn)
- [ ] **Red**: Test P/(SE) = 0.3 (normal, should pass)
- [ ] **Red**: Test P/(SE) = 0.05 (unusually low, should warn)
- [ ] **Verify**: All tests fail initially
- [ ] **Commit**: `test(calculations): Add pressure ratio validation tests`

#### Task 5.2: Implement Pressure Ratio Validation
**Status**: [ ] Pending

**Description**: Add pressure to stress ratio validation.

**Subtasks**:
- [ ] **Green**: Calculate P/(SE) ratio
- [ ] **Green**: Error if P/(SE) > 0.9
- [ ] **Green**: Warn if P/(SE) > 0.5
- [ ] **Green**: Add warnings to results.warnings array
- [ ] **Refactor**: Extract to reusable function for all head types
- [ ] **Verify**: All pressure ratio tests pass
- [ ] **Commit**: `feat(calculations): Add pressure to stress ratio validation`

---

## Phase 6: Implement Denominator Safety Validation

**Status**: [ ] Pending

**Objective**: Validate that denominators are not near-zero to prevent numerical instability.

### Tasks

#### Task 6.1: Add Denominator Safety Tests
**Status**: [ ] Pending

**Description**: Write tests for denominator edge cases.

**Subtasks**:
- [ ] **Red**: Test denom = -100 (should error)
- [ ] **Red**: Test denom = 50 (should error)
- [ ] **Red**: Test denom = 500 (should warn)
- [ ] **Red**: Test denom = 5000 (safe, should pass)
- [ ] **Verify**: All tests fail initially
- [ ] **Commit**: `test(calculations): Add denominator safety validation tests`

#### Task 6.2: Implement Denominator Safety Validation
**Status**: [ ] Pending

**Description**: Enhance denominator validation with near-zero checking.

**Subtasks**:
- [ ] **Green**: Error if denom < 100
- [ ] **Green**: Warn if denom < 1000
- [ ] **Green**: Update validateDenominator helper
- [ ] **Green**: Apply to all calculation functions (shell, heads)
- [ ] **Refactor**: Consistent error messages across functions
- [ ] **Verify**: All denominator tests pass
- [ ] **Commit**: `feat(calculations): Add denominator safety validation`

---

## Phase 7: Implement Default Parameter Warnings

**Status**: [ ] Pending

**Objective**: Track and report when default values are used for L and r.

### Tasks

#### Task 7.1: Add Default Parameter Tracking Tests
**Status**: [ ] Pending

**Description**: Write tests for default value tracking.

**Subtasks**:
- [ ] **Red**: Test L=undefined, r=undefined → defaultsUsed includes both
- [ ] **Red**: Test L=70, r=undefined → defaultsUsed includes only r
- [ ] **Red**: Test L=70, r=4.2 → defaultsUsed is empty
- [ ] **Verify**: All tests fail initially
- [ ] **Commit**: `test(calculations): Add default parameter tracking tests`

#### Task 7.2: Implement Default Parameter Tracking
**Status**: [ ] Pending

**Description**: Track which parameters use default values.

**Subtasks**:
- [ ] **Green**: Initialize defaultsUsed array
- [ ] **Green**: Add "L (crown radius)" to array if L was undefined
- [ ] **Green**: Add "r (knuckle radius)" to array if r was undefined
- [ ] **Green**: Return defaultsUsed in results
- [ ] **Refactor**: Add to all head calculation functions
- [ ] **Verify**: All default tracking tests pass
- [ ] **Commit**: `feat(calculations): Add default parameter tracking`

---

## Phase 8: Implement Actual Thickness Edge Cases

**Status**: [ ] Pending

**Objective**: Handle edge cases when actual thickness is at or below minimum.

### Tasks

#### Task 8.1: Add Actual Thickness Edge Case Tests
**Status**: [ ] Pending

**Description**: Write tests for thickness edge cases.

**Subtasks**:
- [ ] **Red**: Test t_act = 0.5, t_min = 0.6 → Ca = 0, RL = 0, isCompliant = false
- [ ] **Red**: Test t_act = 0.4, t_min = 0.6 → Critical warning
- [ ] **Red**: Test t_act = 0.59, t_min = 0.6 → Warning (within 2%)
- [ ] **Red**: Test t_act = 0.7, t_min = 0.6 → No warning
- [ ] **Verify**: All tests fail initially
- [ ] **Commit**: `test(calculations): Add actual thickness edge case tests`

#### Task 8.2: Implement Actual Thickness Validation
**Status**: [ ] Pending

**Description**: Add validation for actual thickness edge cases.

**Subtasks**:
- [ ] **Green**: If t_act ≤ t_min: set Ca = 0, RL = 0, isCompliant = false
- [ ] **Green**: If t_act < 0.9 * t_min: add critical warning
- [ ] **Green**: If t_act < 1.02 * t_min: add warning (close to minimum)
- [ ] **Green**: Add warnings to results.warnings array
- [ ] **Refactor**: Extract to reusable function
- [ ] **Verify**: All thickness tests pass
- [ ] **Commit**: `feat(calculations): Add actual thickness edge case handling`

---

## Phase 9: Implement Corrosion Rate Edge Cases

**Status**: [ ] Pending

**Objective**: Handle edge cases in corrosion rate and remaining life calculations.

### Tasks

#### Task 9.1: Add Corrosion Rate Edge Case Tests
**Status**: [ ] Pending

**Description**: Write tests for corrosion rate edge cases.

**Subtasks**:
- [ ] **Red**: Test Cr = 0 → RL = undefined
- [ ] **Red**: Test Cr = -0.01 (growth) → RL = undefined
- [ ] **Red**: Test Cr = 0.0001 (very slow) → RL capped at 500 years
- [ ] **Red**: Test Cr = 0.01 (normal) → RL calculated normally
- [ ] **Verify**: All tests fail initially
- [ ] **Commit**: `test(calculations): Add corrosion rate edge case tests`

#### Task 9.2: Implement Corrosion Rate Validation
**Status**: [ ] Pending

**Description**: Add validation for corrosion rate edge cases.

**Subtasks**:
- [ ] **Green**: If Cr ≤ 0: set RL = undefined
- [ ] **Green**: If Cr > 0 and Cr < 0.001: cap RL at 500 years
- [ ] **Green**: If Cr < 0: add warning about metal growth
- [ ] **Green**: Handle division by zero gracefully
- [ ] **Refactor**: Apply to both short-term and long-term rates
- [ ] **Verify**: All corrosion rate tests pass
- [ ] **Commit**: `feat(calculations): Add corrosion rate edge case handling`

---

## Phase 10: Implement MAWP Calculation Edge Cases

**Status**: [ ] Pending

**Objective**: Validate that calculated MAWP values are reasonable.

### Tasks

#### Task 10.1: Add MAWP Validation Tests
**Status**: [ ] Pending

**Description**: Write tests for MAWP edge cases.

**Subtasks**:
- [ ] **Red**: Test MAWP = 500, design P = 150 → Warn (too high)
- [ ] **Red**: Test MAWP = 50, design P = 150 → Warn (too low)
- [ ] **Red**: Test MAWP = -10 → Error (negative)
- [ ] **Red**: Test MAWP = 2000, design P = 150 → Error (unrealistic)
- [ ] **Red**: Test MAWP = 160, design P = 150 → Pass (reasonable)
- [ ] **Verify**: All tests fail initially
- [ ] **Commit**: `test(calculations): Add MAWP validation tests`

#### Task 10.2: Implement MAWP Validation
**Status**: [ ] Pending

**Description**: Add validation for calculated MAWP values.

**Subtasks**:
- [ ] **Green**: Error if MAWP ≤ 0 or MAWP > 10 * design P
- [ ] **Green**: Warn if MAWP > 2 * design P
- [ ] **Green**: Warn if MAWP < 0.5 * design P
- [ ] **Green**: Add warnings to results.warnings array
- [ ] **Refactor**: Apply to all head and shell calculations
- [ ] **Verify**: All MAWP tests pass
- [ ] **Commit**: `feat(calculations): Add MAWP validation`

---

## Phase 11: Integration and Documentation

**Status**: [ ] Pending

**Objective**: Integrate all validations and update documentation.

### Tasks

#### Task 11.1: Update Function Documentation
**Status**: [ ] Pending

**Description**: Add JSDoc comments documenting all edge cases and validations.

**Subtasks**:
- [ ] Document all ValidationWarning types that can be returned
- [ ] Document default value behavior
- [ ] Add examples of edge case handling
- [ ] Update ASME formula references
- [ ] **Commit**: `docs(calculations): Document edge case handling`

#### Task 11.2: Update README and Context Files
**Status**: [ ] Pending

**Description**: Update project documentation with edge case handling information.

**Subtasks**:
- [ ] Update README with validation features
- [ ] Update tech-stack.md if new patterns introduced
- [ ] Add edge case handling to product-guidelines.md
- [ ] **Commit**: `docs: Update documentation for edge case handling`

#### Task 11.3: Run Full Test Suite
**Status**: [ ] Pending

**Description**: Verify all tests pass and coverage meets target.

**Subtasks**:
- [ ] Run `pnpm test` - all tests must pass
- [ ] Run `pnpm test -- --coverage` - verify >95% coverage for torispherical function
- [ ] Run `pnpm check` - verify TypeScript compilation
- [ ] Run `pnpm format` - format all code
- [ ] **Commit**: `test: Verify full test suite passes`

---

## Phase 12: Final Verification and Deployment

**Status**: [ ] Pending

**Objective**: Final verification and preparation for deployment.

### Tasks

#### Task 12.1: Manual Testing with Real Data
**Status**: [ ] Pending

**Description**: Test with actual vessel data from the application.

**Subtasks**:
- [ ] Test with vessel 54-11-005 (torispherical heads)
- [ ] Test with edge case inputs manually
- [ ] Verify warnings display correctly in UI (if applicable)
- [ ] Verify no regressions in existing inspections
- [ ] Document any issues found

#### Task 12.2: Performance Testing
**Status**: [ ] Pending

**Description**: Verify that validation does not impact performance.

**Subtasks**:
- [ ] Benchmark calculation time before and after changes
- [ ] Verify performance impact < 1ms per calculation
- [ ] Test with large batch calculations (100+ components)
- [ ] Document performance results

#### Task 12.3: Code Review and Merge
**Status**: [ ] Pending

**Description**: Final code review before merging.

**Subtasks**:
- [ ] Self-review all code changes
- [ ] Verify all commits follow conventional commit format
- [ ] Verify all acceptance criteria met
- [ ] Update track status to completed
- [ ] **Commit**: `chore(conductor): Mark track-001 complete`

---

## Rollback Plan

If issues are discovered after deployment:

1. **Identify Issue**: Determine which validation is causing problems
2. **Disable Validation**: Comment out specific validation temporarily
3. **Revert Commit**: If necessary, revert to previous stable version
4. **Fix and Redeploy**: Fix issue and redeploy with additional tests

## Success Criteria

- [ ] All 8 edge case categories have comprehensive test coverage
- [ ] Test coverage for torispherical calculation function >95%
- [ ] All existing tests pass without modification
- [ ] No performance degradation (< 1ms additional time)
- [ ] Clear, actionable error messages for all edge cases
- [ ] Documentation updated with edge case handling information
- [ ] Manual testing with real vessel data successful

## Estimated Effort

- **Phase 1**: 2 hours
- **Phase 2**: 3 hours
- **Phase 3**: 2 hours
- **Phase 4**: 2 hours
- **Phase 5**: 2 hours
- **Phase 6**: 2 hours
- **Phase 7**: 2 hours
- **Phase 8**: 3 hours
- **Phase 9**: 3 hours
- **Phase 10**: 2 hours
- **Phase 11**: 2 hours
- **Phase 12**: 3 hours

**Total**: ~28 hours
