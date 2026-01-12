# API 510 Calculation Analysis

## Date: 2025-01-30

## Source: 54-11-0672025REVIEW.pdf

---

## Summary

The professional OilPro report contains **internal calculation inconsistencies**. The joint efficiency (E) value that produces the correct minimum thickness does not produce the correct MAWP values, and vice versa.

---

## Detailed Analysis

### Given Data from PDF

- Design Pressure (P): 250 psi
- Inside Diameter (D): 70.750"
- Allowable Stress (S): 20,000 psi (SS-304 at 200°F)
- Static Head (SH): 6.0 ft
- Specific Gravity (SG): 0.92
- Static Head Pressure: 6.0 × 0.433 × 0.92 = 2.39 psi

### East Head (from PDF Page 3 & 19)

- Nominal Thickness: 0.552"
- Previous Thickness: 0.555"
- Actual Thickness: 0.536"
- **Minimum Required: 0.500"**
- **Calculated MAWP: 263.9 psi**
- Remaining Life: >13 years

### West Head (from PDF Page 3 & 19)

- Nominal Thickness: 0.552"
- Previous Thickness: 0.555"
- Actual Thickness: 0.537"
- **Minimum Required: 0.500"**
- **Calculated MAWP: 262.5 psi**
- Remaining Life: >15 years

---

## Reverse Engineering Results

### To Match t_min = 0.500"

Formula: `t_min = PD / (2SE - 0.2P)`

Solving for SE:

```
0.500 = (250 × 70.750) / (2SE - 0.2×250)
0.500 × (2SE - 50) = 17,687.5
SE - 25 = 17,687.5
2SE = 17,712.5
SE = 17,712.5
```

With S = 20,000 psi:

```
E = 17,712.5 / 20,000 = 0.88563
```

**Result:** E = 0.8856 produces t_min = 0.500" exactly ✓

### Checking MAWP with E = 0.8856

Formula: `P = 2SEt / (D + 0.2t)`, then `MAWP = P - (SH × 0.433 × SG)`

**East Head:**

```
P = (2 × 20,000 × 0.8856 × 0.536) / (70.750 + 0.2×0.536)
P = 19,019.136 / 71.8572
P = 264.6 psi
MAWP = 264.6 - 2.39 = 262.2 psi
```

**PDF shows: 263.9 psi** ← Difference of 1.7 psi ✗

**West Head:**

```
P = (2 × 20,000 × 0.8856 × 0.537) / (70.750 + 0.2×0.537)
P = 19,054.944 / 71.8574
P = 265.1 psi
MAWP = 265.1 - 2.39 = 262.7 psi
```

**PDF shows: 262.5 psi** ← Difference of 0.2 psi ✗

---

## To Match MAWP Values
Working backwards from the PDF MAWP values:

**East Head (MAWP = 263.9 psi):**

```
P = 263.9 + 2.39 = 266.29 psi
SE = P(D + 0.2t) / (2t)
SE = 266.29 × (70.750 + 0.1072) / (2 × 0.536)
SE = 266.29 × 70.8572 / 1.072
SE = 17,601.9
E = 17,601.9 / 20,000 = 0.8801
```

With E = 0.8801:

```
t_min = (250 × 70.750) / (2 × 20,000 × 0.8801 - 50)
t_min = 17,687.5 / 35,154
t_min = 0.5031" (not 0.500") ✗
```

**West Head (MAWP = 262.5 psi):**

```
P = 262.5 + 2.39 = 264.89 psi
SE = 264.89 × (70.750 + 0.1074) / (2 × 0.537)
SE = 17,476.8
E = 17,476.8 / 20,000 = 0.8738
```

With E = 0.8738:

```
t_min = (250 × 70.750) / (2 × 20,000 × 0.8738 - 50)
t_min = 17,687.5 / 34,902
t_min = 0.5068" (not 0.500") ✗
```

---

## Conclusion

**The PDF calculations are internally inconsistent.** There is no single E value that produces both:

1. t_min = 0.500" exactly, AND
2. MAWP = 263.9 / 262.5 psi exactly

### Possible Causes:

1. **Rounding errors** in the professional software
2. **Different E values** used for different calculations (non-standard practice)
3. **Proprietary formula adjustments** in commercial software
4. **Manual calculation errors** in the original report

### Recommendations:

**Option 1: Use Standard ASME Values**

- E = 0.85 (single-welded butt joint, spot RT per UW-12)
- E = 1.0 (seamless or double-welded full RT per UW-12)
- Document deviation from PDF

**Option 2: Use Calculated E = 0.8856**

- Matches t_min exactly
- MAWP off by 1-2 psi (acceptable engineering tolerance)
- Most mathematically consistent

**Option 3: Match PDF Exactly**

- Use different E for each calculation
- Not standard engineering practice
- Creates confusion and audit issues

---

## Recommended Approach

**Use E = 1.0 for heads** (seamless or fully radiographed) and **E = 0.85 for shell** (spot radiographed).

This is standard ASME practice. The PDF likely uses a custom E value or has software rounding issues. Our calculations should follow ASME standards, not replicate potential errors in the source document.

If exact matching is required for validation, we can add a "legacy mode" that uses E = 0.8856, but this should not be the default.