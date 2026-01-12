# ASME Calculation Audit - Track 003

**Date**: 2026-01-11  
**Purpose**: Audit all calculations against ASME Section VIII Division 1 standards  
**Approach**: Verify formulas are correct per code, NOT matching potentially incorrect professional reports

---

## Audit Findings

### ✅ CORRECT Implementations

#### 1. Shell Minimum Thickness (UG-27)

**Formula**: `t = PR / (SE - 0.6P)`

**Current Implementation** (componentCalculations.ts:165-178):
```typescript
function calculateShellMinThickness(
  pressure: number,
  radius: number,
  allowableStress: number,
  jointEfficiency: number,
  corrosionAllowance: number
): number {
  const denominator = allowableStress * jointEfficiency - 0.6 * pressure;
  if (denominator <= 0) return 0;
  const t = (pressure * radius) / denominator;
  return t; // Correctly does NOT add CA
}
```

**Status**: ✅ **CORRECT** - Matches ASME UG-27 exactly

---

#### 2. Shell MAWP (UG-27(c))

**Formulas**:
- Circumferential stress: `P = SEt / (R + 0.6t)`
- Longitudinal stress: `P = 2SEt / (R - 0.4t)`
- Returns minimum (governing) MAWP

**Current Implementation** (componentCalculations.ts:266-293):
```typescript
function calculateShellMAWP(...) {
  const t = thickness - corrosionAllowance;
  const P_hoop = (allowableStress * El * t) / (radius + 0.6 * t);
  const P_long = (2 * allowableStress * Ec_eff * t) / (radius - 0.4 * t);
  return Math.min(P_hoop, P_long > 0 ? P_long : P_hoop);
}
```

**Status**: ✅ **CORRECT** - Properly evaluates both stress cases

---

#### 3. Head Minimum Thickness (UG-32)

**Formulas**:
- Hemispherical: `t = PL / (2SE - 0.2P)` where L = R
- Ellipsoidal (2:1): `t = PD / (2SE - 0.2P)`
- Torispherical: `t = PLM / (2SE - 0.2P)` where M = 0.25(3 + √(L/r))

**Current Implementation** (componentCalculations.ts:195-252):
```typescript
export function calculateHeadMinThickness(...) {
  const D = radius * 2;
  switch (headType.toLowerCase()) {
    case "hemispherical":
      t = (pressure * R_hemi) / (2 * allowableStress * jointEfficiency - 0.2 * pressure);
    case "ellipsoidal":
      t = (pressure * D) / (2 * allowableStress * jointEfficiency - 0.2 * pressure);
    case "torispherical":
      const L = crownRadius || D;
      const r = knuckleRadius || 0.06 * D;
      const M = 0.25 * (3 + Math.sqrt(L / r));
      t = (pressure * L * M) / (2 * allowableStress * jointEfficiency - 0.2 * pressure);
  }
  return t; // Correctly does NOT add CA
}
```

**Status**: ✅ **CORRECT** - All three head types implemented per ASME

---

#### 4. Head MAWP (UG-32)

**Formulas**:
- Hemispherical: `P = 2SEt / (R + 0.2t)`
- Ellipsoidal: `P = 2SEt / (D + 0.2t)`
- Torispherical: `P = 2SEt / (LM + 0.2t)`

**Current Implementation** (componentCalculations.ts:295-368):
```typescript
function calculateHeadMAWP(...) {
  const t = thickness - corrosionAllowance;
  const D = radius * 2;
  
  switch (headType.toLowerCase()) {
    case "hemispherical":
      return (2 * allowableStress * jointEfficiency * t) / (R + 0.2 * t);
    case "ellipsoidal":
      return (2 * allowableStress * jointEfficiency * t) / (D + 0.2 * t);
    case "torispherical":
      const L = crownRadius || D;
      const r = knuckleRadius || 0.06 * D;
      const M = 0.25 * (3 + Math.sqrt(L / r));
      return (2 * allowableStress * jointEfficiency * t) / (L * M + 0.2 * t);
  }
}
```

**Status**: ✅ **CORRECT** - All formulas match ASME exactly

---

### ⚠️ POTENTIAL ISSUES TO INVESTIGATE

#### 1. Radius Calculation

**Current Implementation** (componentCalculations.ts:407):
```typescript
const radius = data.insideDiameter / 2;
```

**Question**: Is `insideDiameter` truly the inside diameter, or is it outside diameter?

**ASME Requirement**: 
- For shells: R = inside radius (measured from inside surface)
- For heads: D = inside diameter, R = D/2

**Investigation Needed**:
1. Check where `insideDiameter` comes from in the data flow
2. Verify it's not actually outside diameter
3. Confirm it doesn't need nominal thickness subtracted

**From CORRECT_CALCULATIONS.md**:
```
R = 0.5*D - Tnom = 65.125 - 0.813 = 64.312
```

This suggests radius should account for nominal thickness, but this formula seems incorrect. The standard ASME approach is:
- If given OD: `ID = OD - 2*Tnom`, then `R = ID/2`
- If given ID: `R = ID/2` directly

**Action**: Need to trace data flow to verify diameter values

---

#### 2. Corrosion Allowance in Remaining Life

**Current Implementation** (componentCalculations.ts:370-400):
```typescript
function calculateRemainingLife(
  actualThickness: number,
  minThickness: number,
  corrosionRate: number
): { remainingLife: number; nextInspectionDate: Date } {
  const corrosionAllowance = actualThickness - minThickness;
  
  if (corrosionRate <= 0 || corrosionAllowance <= 0) {
    return { remainingLife: Infinity, nextInspectionDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) };
  }
  
  const remainingLife = corrosionAllowance / corrosionRate;
  // ...
}
```

**Status**: ✅ **CORRECT** - Standard API 510 approach:
- Ca = t_act - t_min
- RL = Ca / Cr

---

#### 3. Static Head Pressure

**Current Implementation** (componentCalculations.ts:86-92):
```typescript
function calculateStaticHeadPressure(
  specificGravity: number,
  liquidHeight: number
): number {
  return specificGravity * liquidHeight * 0.433;
}
```

**Status**: ✅ **CORRECT** - Standard formula: P_static = SG × h × 0.433 psi/ft

**Usage** (componentCalculations.ts:414-423):
```typescript
if (data.liquidService && data.specificGravity && data.liquidHeight) {
  staticHeadPressure = calculateStaticHeadPressure(...);
  totalDesignPressure = data.designPressure + staticHeadPressure;
}
```

**Status**: ✅ **CORRECT** - Adds static head to design pressure for t_min calculation

**MAWP Calculation**: Need to verify MAWP is reported with static head **subtracted**:
- `MAWP = P_calc - P_static`

This is correct per API 510 - MAWP is at the top of the vessel (zero static head).

---

### 📋 Action Items

1. **Verify Diameter/Radius Data Flow**
   - Trace where `insideDiameter` comes from
   - Confirm it's truly inside diameter
   - Check if any conversions are needed

2. **Verify MAWP Static Head Handling**
   - Confirm MAWP subtracts static head
   - Check if this is done in componentCalculations or elsewhere

3. **Add ASME Validation Tests**
   - Create test cases using ASME example problems
   - Verify all formulas produce correct results
   - Don't use professional report values (may be incorrect)

4. **Document Standard E Values**
   - E = 1.0 for seamless or double-welded full RT (UW-12(a))
   - E = 0.85 for single-welded butt joint, spot RT (UW-12(b))
   - E = 0.70 for single-welded butt joint, no RT (UW-12(c))

5. **Create Calculation Comparison Tool**
   - Allow users to compare app calculations with any reference
   - Show formula used and all intermediate values
   - Highlight differences and explain why they occur

---

## Conclusion

**Overall Assessment**: The core ASME formulas in `componentCalculations.ts` are **CORRECT** and match ASME Section VIII Division 1 exactly.

**Primary Investigation Needed**: Verify the data flow for diameter/radius values to ensure correct values are being passed to the calculation functions.

**Recommendation**: Do NOT try to match potentially incorrect professional report values. Instead:
1. Ensure correct ASME formulas (✅ already done)
2. Verify correct input data
3. Use standard E values
4. Document methodology
5. Provide comparison tool for transparency

---

## ASME References

- **UG-27**: Thickness of Shells Under Internal Pressure
  - (c)(1): Circumferential stress
  - (c)(2): Longitudinal stress
  
- **UG-32**: Formed Heads, Pressure on Concave Side
  - (d): Hemispherical heads
  - (e): Ellipsoidal heads
  - Appendix 1-4(d): Torispherical heads (M-factor method)

- **UW-12**: Joint Efficiencies
  - (a): E = 1.0 (full RT)
  - (b): E = 0.85 (spot RT)
  - (c): E = 0.70 (no RT)

- **API 510**: Pressure Vessel Inspection Code
  - Section 7: Inspection and Test Methods
  - Section 8: Evaluation of Inspection Results
  - Section 9: Repairs and Alterations
