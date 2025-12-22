# TML Data Analysis for Inspection 54-11-005

## Issue Summary

The recalculate function shows "No TMLs found for West Head" in the server logs. This means the TML readings in the database don't have component names that match the West Head detection patterns.

## Current Detection Patterns

### East Head Detection (working):
- `east`, `e head`, `head 1`, `head-1`, `left head`
- Any `head` without `west`, `north`, `right` keywords

### West Head Detection (NOT matching):
- `west`, `w head`, `head 2`, `head-2`, `right head`
- `north` keyword

## Root Cause

The PDF import extracted TML readings with component names that don't include "North" or "South" head identifiers. The data likely has:
- "East Head" readings (matching East Head filter)
- Shell readings (matching Shell filter)
- But NO readings with "West", "North", "South", or "Head 2" in the component name

## Solution Options

1. **Re-import the PDF** with improved extraction that identifies North/South heads
2. **Manually update TML records** to add proper component names
3. **Add more detection patterns** to recognize the actual component naming in the data

## Next Steps

1. Query the actual TML component names in the database
2. Update the detection logic to match the actual naming patterns
3. Add support for location-based head detection (e.g., location 7 = North Head)
