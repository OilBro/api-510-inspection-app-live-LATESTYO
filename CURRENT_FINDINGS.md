# Current Findings - Inspection 54-11-005

## Calculations Tab Shows:

### Shell
- Material: SA-240 Type 316
- Design MAWP: 150.00 psi
- Min Thickness: 0.4213 in
- Remaining Life: 43.30 years
- Governing Rate: 1.0 mpy
- MAWP @ Next Insp: psi (blank)
- Actual Thickness: 0.4646 in
- Next Inspection: 21.65 years

### East Head
- Material: SA-240 Type 316
- Design MAWP: 150.00 psi
- Min Thickness: 0.2097 in
- Remaining Life: 349.50 years
- Governing Rate: 1.0 mpy
- MAWP @ Next Insp: psi (blank)
- Actual Thickness: 0.5592 in
- Next Inspection: 174.75 years

## Issue Confirmed:
- **Only Shell and East Head are showing**
- **West Head is MISSING** - This is the bug the user reported
- The TML readings in the database only have "East Head" and "Vessel Shell" component names
- The PDF likely had "North Head" and "South Head" but the extraction mapped everything to "East Head"

## Root Cause:
The PDF extraction or the recalculate function is not properly detecting the second head (West Head / South Head).

## Solution:
1. Check the TML readings to see if there are any with "South Head" or "West Head" in the location field
2. Update the head detection logic to check the `location` field in addition to `component` field
3. Re-run recalculate to generate both heads
