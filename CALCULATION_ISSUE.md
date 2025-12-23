# Calculation Issue Analysis

## Problem
The corrosion rates are showing extremely high values (112732.4 mpy for Shell, 302740.0 mpy for East Head) which are clearly incorrect.

## Root Cause
The calculation is using:
- Current thickness from 2025 data (0.8006" for shell, 0.4967" for head)
- Previous thickness from 2017 data (original thickness)
- But the time interval is being calculated as 0.0 years

The issue is that the `previousReadingDate` is not being set correctly, so the time interval calculation results in division by zero or near-zero.

## Data from Screen
**Shell:**
- Current Thickness: 0.8006 in
- Min Thickness: 0.9081 in
- Long-Term Rate: 112732.4 mpy (INCORRECT)
- Remaining Life: 0.00 years

**East Head:**
- Current Thickness: 0.4967 in
- Min Thickness: 0.4528 in
- Long-Term Rate: 302740.0 mpy (INCORRECT)
- Remaining Life: 0.00 years

## Fix Required
Need to update the TML readings with:
1. Correct previousThickness values (from 2017 inspection)
2. Correct previousReadingDate (June 20, 2017)
3. Correct currentReadingDate (November 4, 2025)

Time interval should be: 2025-11-04 to 2017-06-20 = ~8.38 years
