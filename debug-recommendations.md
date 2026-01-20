# Recommendations Bug Investigation

## Current Status
- Vessel 54-11-001 shows "No recommendations extracted from the PDF" in the Results & Recommendations tab
- Database query confirms: recommendations field is NULL for this inspection
- inspectionResults field is also NULL

## Data Flow Analysis
1. **Extraction (extractFromPDF)**: Returns recommendations in the data structure
2. **Save (saveExtractedData)**: Accepts recommendations in input schema and saves to DB
3. **Display (InspectionResultsTab)**: Correctly checks for recommendations and displays them

## Root Cause Hypothesis
The issue is that when the user imported the PDF originally, the extraction either:
1. Did not extract recommendations (AI didn't find Section 4.0)
2. The data was not passed correctly during save

## Solution
The user needs to re-import the PDF using "Import from PDF (AI)" to re-extract the data.
The logging has been added to track extraction and save operations.

## Added Logging
- extractFromPDF: Now logs hasRecommendations, recommendationsLength
- saveExtractedData: Now logs recommendations status before saving
