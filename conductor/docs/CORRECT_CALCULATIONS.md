# Correct Calculation Formulas from User's Excel (54-11-001)

## Input Parameters

### Shell Evaluation

- **S** (Allowable Stress): 20,000 psi
- **E** (Joint Efficiency): 1.0
- **TEMP**: 125°F
- **P** (Design Pressure): 225 psi
- **SH** (Static Head): 8 ft
- **SG** (Specific Gravity): 0.63
- **D** (Inside Diameter): 130.25 inches
- **Tnom** (Nominal Thickness): 0.813 inches
- **R** (Radius): 64.312 inches (calculated as 0.5\*D - Tnom = 65.125 - 0.813 = 64.312)
- **Y** (Years between inspections): 10
- **Tact** (Actual/Current Thickness): 0.800 inches
- **Tprev** (Previous Thickness): 0.813 inches
- **Yn** (Next inspection interval): 5 years

### Head Evaluation (East/North Head)

- **Tprev EH**: 0.530 inches
- **Tact EH**: 0.502 inches
- **Tmin EH**: 0.421 inches
- **Y**: 10 years

### Head Evaluation (West/South Head)

- **Tprev WH**: 0.530 inches
- **Tact WH**: 0.502 inches
- **Tmin WH**: 0.421 inches
- **Y**: 10 years

## Formulas

### Minimum Required Thickness (Shell)

```
Tmin = PR / (SE - 0.6P)
Tmin = (225 × 64.312) / (20000 × 1.0 - 0.6 × 225)
Tmin = 14,470.2 / 19,865
Tmin = 0.7284 inches
```

### Corrosion Allowance (Ca)

```
Ca = Tact - Tmin
Ca = 0.800 - 0.7284 = 0.0716 inches
```

### Corrosion Rate (Cr)

```
Cr = (Tprev - Tact) / Y
Cr = (0.813 - 0.800) / 10 = 0.0013 in/yr
```

### Remaining Life (RL)

```
RL = Ca / Cr
RL = 0.0716 / 0.0013 = 55.06 years
```

### MAWP at Next Inspection

```
t = Tact - 2 × Yn × Cr
t = 0.800 - 2 × 5 × 0.0013 = 0.787 inches

Pcalc = SEt / (R + 0.6t)
Pcalc = (20000 × 1.0 × 0.787) / (64.312 + 0.6 × 0.787)
Pcalc = 15,740 / 64.7842 = 242.96 psi

Static Head Pressure = SH × 0.433 × SG
Static Head Pressure = 8 × 0.433 × 0.63 = 2.18 psi

MAWP = Pcalc - Static Head Pressure
MAWP = 242.96 - 2.18 = 240.78 psi
```

### Head Remaining Life (East Head)


```
Ca = Tact_EH - Tmin_EH = 0.502 - 0.421 = 0.081 inches
Cr = (Tprev_EH - Tact_EH) / Y = (0.530 - 0.502) / 10 = 0.0028 in/yr
RL = Ca / Cr = 0.081 / 0.0028 = 28.93 years
```

## Key Differences from Current App

1. **Radius Calculation**: R = 0.5\*D - Tnom (NOT just D/2)
2. **Joint Efficiency**: E = 1.0 (full radiography)
3. **Allowable Stress**: S = 20,000 psi for SA-612 at 125°F
4. **Corrosion Rate**: Uses actual years between inspections (Y=10)
5. **MAWP includes static head deduction**
6. **Future thickness projection**: t = Tact - 2*Yn*Cr (factor of 2 for safety)