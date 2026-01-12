# Track 002 Implementation Plan

## Status: [~] In Progress

## Overview

Extend comprehensive edge case validation to all head types and shell calculations, following the successful TDD methodology from Track 001.

---

## Phase 1: Ellipsoidal Head Validation

**Estimated Time**: 4 hours

### Task 1.1: Add K Factor Validation (Red → Green → Refactor)
- [ ] **Red**: Write tests for K factor bounds validation
- [ ] **Green**: Implement K factor validation in `calculateEllipsoidalHead()`
- [ ] **Refactor**: Clean up and optimize

**Validation Rules**:
- Error if K < 0.8 or K > 1.5
- Warning if K < 0.9 or K > 1.2
- Normal if 0.9 ≤ K ≤ 1.2

### Task 1.2: Add D/(2h) Ratio Validation (Red → Green → Refactor)
- [ ] **Red**: Write tests for D/(2h) ratio validation
- [ ] **Green**: Implement D/(2h) ratio validation
- [ ] **Refactor**: Clean up

**Validation Rules**:
- Error if D/(2h) < 1 or D/(2h) > 4
- Warning if D/(2h) < 1.8 or D/(2h) > 2.2
- Normal if 1.8 ≤ D/(2h) ≤ 2.2 (2:1 ellipsoidal)

### Task 1.3: Add Core Validations (Red → Green → Refactor)
- [ ] **Red**: Write tests for P/(SE), denominator, thickness, corrosion, MAWP
- [ ] **Green**: Implement using helper functions from Track 001
- [ ] **Refactor**: Clean up

### Task 1.4: Verify and Commit
- [ ] Run all ellipsoidal tests
- [ ] Verify no regressions
- [ ] Format and commit

---

## Phase 2: Hemispherical Head Validation

**Estimated Time**: 2 hours

### Task 2.1: Add R = D/2 Validation (Red → Green → Refactor)
- [ ] **Red**: Write tests for R validation
- [ ] **Green**: Implement R = D/2 check and tracking
- [ ] **Refactor**: Clean up

### Task 2.2: Add Core Validations (Red → Green → Refactor)
- [ ] **Red**: Write tests for P/(SE), denominator, thickness, corrosion, MAWP
- [ ] **Green**: Implement using helper functions
- [ ] **Refactor**: Clean up

### Task 2.3: Verify and Commit
- [ ] Run all hemispherical tests
- [ ] Verify no regressions
- [ ] Format and commit

---

## Phase 3: Flat Head Validation

**Estimated Time**: 4 hours

### Task 3.1: Add C Factor Validation (Red → Green → Refactor)
- [ ] **Red**: Write tests for C factor bounds
- [ ] **Green**: Implement C factor validation
- [ ] **Refactor**: Clean up

**Validation Rules**:
- Error if C < 0.10 or C > 0.33
- Warning if C not in standard values (0.10, 0.17, 0.20, 0.25, 0.30, 0.33)
- Track when C is defaulted

### Task 3.2: Add d/D Ratio Validation (Red → Green → Refactor)
- [ ] **Red**: Write tests for d/D ratio
- [ ] **Green**: Implement d/D validation
- [ ] **Refactor**: Clean up

**Validation Rules**:
- Error if d/D < 0.1 or d/D > 1.5
- Warning if d/D > 1.0 (d should typically be ≤ D)

### Task 3.3: Add Pressure Limit Validation (Red → Green → Refactor)
- [ ] **Red**: Write tests for flat head pressure limits
- [ ] **Green**: Implement pressure validation
- [ ] **Refactor**: Clean up

**Note**: Flat heads have lower pressure limits than other types

### Task 3.4: Add Core Validations (Red → Green → Refactor)
- [ ] **Red**: Write tests for thickness, corrosion, MAWP
- [ ] **Green**: Implement using helper functions
- [ ] **Refactor**: Clean up

**Note**: Flat heads use `t = d * sqrt(CP / SE)`, no denominator validation needed

### Task 3.5: Verify and Commit
- [ ] Run all flat head tests
- [ ] Verify no regressions
- [ ] Format and commit

---

## Phase 4: Conical Section Validation

**Estimated Time**: 3 hours

### Task 4.1: Add Alpha (Half Apex Angle) Validation (Red → Green → Refactor)
- [ ] **Red**: Write tests for alpha bounds
- [ ] **Green**: Implement alpha validation
- [ ] **Refactor**: Clean up

**Validation Rules**:
- Error if alpha < 0° or alpha > 75°
- Warning if alpha > 60° (requires special consideration per ASME)
- Normal if 0° ≤ alpha ≤ 60°

### Task 4.2: Add cos(alpha) Validation (Red → Green → Refactor)
- [ ] **Red**: Write tests for cos(alpha) in denominator
- [ ] **Green**: Implement cos(alpha) safety checks
- [ ] **Refactor**: Clean up

**Validation Rules**:
- Error if cos(alpha) < 0.1 (alpha > 84°, too steep)
- Warning if cos(alpha) < 0.5 (alpha > 60°)

### Task 4.3: Add Core Validations (Red → Green → Refactor)
- [ ] **Red**: Write tests for P/(SE), denominator, thickness, corrosion, MAWP
- [ ] **Green**: Implement using helper functions
- [ ] **Refactor**: Clean up

### Task 4.4: Verify and Commit
- [ ] Run all conical tests
- [ ] Verify no regressions
- [ ] Format and commit

---

## Phase 5: Shell Calculation Validation

**Estimated Time**: 5 hours

### Task 5.1: Add Circumferential Stress Validation (Red → Green → Refactor)
- [ ] **Red**: Write tests for circumferential formula validation
- [ ] **Green**: Implement P/(SE) and denominator validation for circ stress
- [ ] **Refactor**: Clean up

**Formula**: `t = PR / (SE - 0.6P)`

**Validation Rules**:
- P/(SE) ratio validation (error > 0.95, warn > 0.6)
- Denominator (SE - 0.6P) safety validation

### Task 5.2: Add Longitudinal Stress Validation (Red → Green → Refactor)
- [ ] **Red**: Write tests for longitudinal formula validation
- [ ] **Green**: Implement P/(SE) and denominator validation for long stress
- [ ] **Refactor**: Clean up

**Formula**: `t = PR / (2SE + 0.4P)`

**Validation Rules**:
- P/(SE) ratio validation
- Denominator (2SE + 0.4P) safety validation (always positive, but check magnitude)

### Task 5.3: Add Governing Condition Validation (Red → Green → Refactor)
- [ ] **Red**: Write tests for circ vs long comparison
- [ ] **Green**: Implement validation that circ > long (as expected)
- [ ] **Refactor**: Clean up

**Validation Rules**:
- Warning if t_min_long > t_min_circ (unusual, longitudinal governing)
- Track which condition is governing

### Task 5.4: Add Core Validations (Red → Green → Refactor)
- [ ] **Red**: Write tests for thickness, corrosion, MAWP (both circ and long)
- [ ] **Green**: Implement using helper functions
- [ ] **Refactor**: Clean up

### Task 5.5: Verify and Commit
- [ ] Run all shell tests
- [ ] Verify no regressions
- [ ] Format and commit

---

## Phase 6: Integration Testing and Documentation

**Estimated Time**: 3 hours

### Task 6.1: Run Full Test Suite
- [ ] Run all ASME calculation tests
- [ ] Verify no regressions in any calculation type
- [ ] Check test coverage (target >95%)
- [ ] Performance benchmarks

### Task 6.2: Update Documentation
- [ ] Update EDGE_CASE_VALIDATION.md with all new validations
- [ ] Add examples for each head type
- [ ] Update ASME code references
- [ ] Add validation comparison table

### Task 6.3: Create Completion Summary
- [ ] Document implementation details
- [ ] Test results and coverage
- [ ] Success metrics
- [ ] Lessons learned
- [ ] Next steps

### Task 6.4: Update Tracks
- [ ] Mark Track 002 as complete in plan.md
- [ ] Update tracks.md with completion status
- [ ] Commit all documentation

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Ellipsoidal Tests | 30+ | [ ] |
| Hemispherical Tests | 20+ | [ ] |
| Flat Tests | 30+ | [ ] |
| Conical Tests | 25+ | [ ] |
| Shell Tests | 35+ | [ ] |
| **Total New Tests** | **140+** | **[ ]** |
| No Regressions | 100% | [ ] |
| Test Coverage | >95% | [ ] |
| Performance | <1ms overhead | [ ] |
| Documentation | Complete | [ ] |

---

## Git Commit Strategy

Follow Track 001 pattern:

1. `feat(calculations): Add ellipsoidal head validation`
2. `feat(calculations): Add hemispherical head validation`
3. `feat(calculations): Add flat head validation`
4. `feat(calculations): Add conical section validation`
5. `feat(calculations): Add shell calculation validation`
6. `docs(calculations): Update validation documentation for all types`
7. `chore(conductor): Complete Track 002`

---

## Notes

- Reuse helper functions from Track 001 as much as possible
- Each phase should be independently testable
- Commit after each phase completion
- Follow TDD strictly: Red → Green → Refactor
- Maintain code quality and formatting throughout

---

**Created**: 2026-01-11  
**Author**: Manus AI Agent  
**Track**: 002
