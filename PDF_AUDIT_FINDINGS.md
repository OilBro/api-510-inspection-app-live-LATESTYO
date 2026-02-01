# PDF Audit Findings - Report 54-11-067

## Page 1 - UI Screenshot (Not actual PDF)
- Shows app interface with report 54-11-067
- East Head component showing PASS status
- Calculations tab visible

## Page 2 - East Head Calculation
**Vessel Identification:**
- Vessel ID: 54-11-067
- Component: East Head
- Inspection Date: 10/7/2025
- Inspector: — (missing)

**Design Data:**
- Design Pressure (P): 250.00 psig
- Inside Diameter (D): 70.750 inches
- Inside Radius (R): 35.375 inches
- Allowable Stress (S): 20000.00 psi
- Joint Efficiency (E): 0.85
- Material: SA-240 Type 304

**Thickness Data:**
- Nominal Thickness (t_nom): — (MISSING)
- Previous Thickness (t_prev): — (MISSING)
- Current Thickness (t_actual): 0.5550 inches
- Time Interval (Y): 0.32 years

**Calculation Results:**
- Min Required Thickness: 0.2605"
- Corrosion Rate: 1.0 mpy
- Remaining Life: >20 yrs
- Recalculated MAWP: 531.8 psi

## Page 3 - Compliance Determination
- Current Thickness vs Required: 0.5550" vs 0.2605" - PASS
- Remaining Life: >20 years - ACCEPTABLE
- Next Inspection Due: 147.25 years (Per API 510 §6.4)

## Page 3 - Shell Calculation
**Vessel Identification:**
- Vessel ID: 54-11-067
- Component: Shell
- Inspection Date: 10/7/2025
- Inspector: — (missing)

**Design Data:**
- Design Pressure (P): 250.00 psig
- Inside Diameter (D): 70.750 inches
- Inside Radius (R): 35.375 inches
- Allowable Stress (S): 20000.00 psi
- Joint Efficiency (E): 0.85
- Material: SA-240 Type 304

## Page 4 - Shell Thickness Data
- Nominal Thickness (t_nom): — (MISSING)
- Previous Thickness (t_prev): — (MISSING)
- Current Thickness (t_actual): 0.6520 inches
- Time Interval (Y): 0.32 years

**Step-by-Step Calculations:**
- Required Thickness: t_required = (P × R) / (S × E - 0.6 × P)
- t_required = (250 × 35.375) / (20000 × 0.85 - 0.6 × 250)
- t_required = 8843.75 / (17000 - 150.0)
- t_required = 8843.75 / 16850.0
- t_required = 0.5249 inches

## Page 5 - Corrosion Rate Calculation
**ISSUE FOUND - NEGATIVE CORROSION RATE:**
- Previous Thickness (t_prev) = 0.0000 inches (WRONG - should have actual value)
- Current Thickness (t_actual) = 0.6520 inches
- Time Interval (Y) = 0.3 years

**Calculation:**
- Cr = (0.0000 - 0.6520) / 0.3
- Cr = -0.6520 / 0.3
- Cr = 0.001000 in/yr (1.0 mpy)

**NOTE:** The corrosion rate shows negative because t_prev is 0.0000 (missing data).
The system appears to be using absolute value to avoid negative rates.

**Remaining Life Calculation:**
- RL = (t_actual - t_required) / Corrosion Rate
- RL = (0.6520 - 0.5249) / 0.001000
- RL = 0.1271 / 0.001000
- RL = 127.1 years

## Critical Issues Found

### 1. Missing Thickness Data
- Nominal Thickness (t_nom): Missing for all components
- Previous Thickness (t_prev): Missing for all components (showing 0.0000)

### 2. Incorrect Corrosion Rate Calculation
- Using t_prev = 0.0000 instead of actual previous thickness
- This makes the corrosion rate calculation meaningless
- System is using absolute value to hide the negative result

### 3. Time Interval Issue
- Time Interval showing 0.32 years (about 4 months)
- This seems incorrect for a 2017 baseline to 2025 inspection (should be ~8 years)

### 4. Missing Inspector Name
- Inspector field shows "—" instead of actual inspector name

### 5. Material Discrepancy
- PDF shows SA-240 Type 304 (stainless steel)
- Original vessel was SA-516 Gr. 70 (carbon steel)
- This could be a data import issue

## Page 6 - Shell MAWP Calculation
**MAWP Calculation:**
- MAWP = (S × E × t) / (R + 0.6 × t)
- MAWP = (20000 × 0.85 × 0.6520) / (35.375 + 0.6 × 0.6520)
- MAWP = 11084.00 / (35.375 + 0.3912)
- MAWP = 11084.00 / 35.7662
- MAWP = 309.9 psig

**Shell Results:**
- Min Required Thickness: 0.5249"
- Corrosion Rate: 1.0 mpy
- Remaining Life: >20 yrs
- Recalculated MAWP: 309.9 psi
- Next Inspection Due: 63.55 years

## Page 7 - West Head Calculation
**Vessel Identification:**
- Vessel ID: 54-11-067
- Component: West Head
- Inspection Date: 10/7/2025
- Inspector: — (missing)

**Thickness Data:**
- Nominal Thickness (t_nom): — (MISSING)
- Previous Thickness (t_prev): — (MISSING)
- Current Thickness (t_actual): 0.5520 inches
- Time Interval (Y): 0.32 years

## Page 8 - West Head Required Thickness
**Required Thickness Calculation:**
- t_required = (P × R) / (S × E - 0.6 × P)
- t_required = (250 × 35.375) / (20000 × 0.85 - 0.6 × 250)
- t_required = 8843.75 / (17000 - 150.0)
- t_required = 8843.75 / 16850.0
- t_required = 0.2605 inches

**ISSUE: Using Shell formula UG-27 for Head instead of Head formula UG-32!**

**Corrosion Rate:**
- t_prev = 0.0000 inches (WRONG - missing data)
- t_actual = 0.5520 inches
- Y = 0.3 years
- Cr = (0.0000 - 0.5520) / 0.3 = -0.5520 / 0.3 = 0.001000 in/yr (1.0 mpy)

## Page 9 - West Head Remaining Life & MAWP
**Remaining Life:**
- RL = (0.5520 - 0.2605) / 0.001000
- RL = 0.2915 / 0.001000
- RL = 291.5 years

**MAWP Recalculation:**
- MAWP = (S × E × t) / (R + 0.6 × t)
- MAWP = (20000 × 0.85 × 0.5520) / (35.375 + 0.6 × 0.5520)
- MAWP = 9384.00 / (35.375 + 0.3312)
- MAWP = 9384.00 / 35.7062
- MAWP = 528.9 psig

**West Head Results:**
- Min Required Thickness: 0.2605"
- Corrosion Rate: 1.0 mpy
- Remaining Life: >20 yrs
- Recalculated MAWP: 528.9 psi

## Page 10 - West Head Compliance
- Current Thickness vs Required: 0.5520" vs 0.2605" - PASS
- Remaining Life: >20 years - ACCEPTABLE
- Next Inspection Due: 145.75 years

## Summary of Critical Issues

| Issue | Description | Impact |
|-------|-------------|--------|
| Missing t_prev | Previous thickness is 0.0000 for all components | Corrosion rate calculation is meaningless |
| Missing t_nom | Nominal thickness is missing | Cannot verify design data |
| Wrong head formula | Using UG-27 (shell) for heads instead of UG-32 | Min required thickness may be incorrect |
| Short time interval | 0.32 years instead of ~8 years (2017-2025) | Corrosion rate severely underestimated |
| Missing inspector | Inspector field is blank | Report incomplete |
| Wrong material | SA-240 Type 304 instead of SA-516 Gr. 70 | Wrong allowable stress being used |
