# API 510 Pressure Vessel Inspection App - Copilot Instructions

## Architecture Overview

Full-stack TypeScript app: **Express + tRPC** backend, **React + Vite** frontend, **Drizzle ORM** with PostgreSQL.

```
client/src/
├── pages/              # Route components (Home, InspectionDetail, ValidationDashboard, etc.)
├── components/
│   ├── ui/             # shadcn/ui primitives
│   ├── inspection/     # Inspection tabs (VesselDataTab, CalculationsTab, ThicknessAnalysisTab)
│   └── professionalReport/  # PDF report components
├── lib/
│   ├── trpc.ts         # tRPC client (createTRPCReact<AppRouter>)
│   └── thicknessCalculations.ts  # Client-side ASME formulas
server/
├── _core/              # Infrastructure (index.ts, trpc.ts, llm.ts, logger.ts)
├── routers.ts          # Main appRouter combining all sub-routers
├── routers/pdfImportRouter.ts  # AI-powered PDF extraction
├── professionalReportRouters.ts  # Report generation, recalculate logic
├── professionalPdfGenerator.ts   # jsPDF-based PDF generation
├── componentCalculations.ts      # ASME calculation engine
├── enhancedCalculations.ts       # Dual corrosion rate, anomaly detection
├── db.ts               # Database queries (inspections, TML readings)
├── professionalReportDb.ts       # Component calculations, findings
drizzle/schema.ts       # Database schema (inspections, tmlReadings, componentCalculations, etc.)
```

## Running the App

```bash
pnpm install
pnpm dev          # Starts both server (port 3000) and Vite dev server
pnpm test         # Vitest tests
pnpm db:push      # Push schema changes to database
pnpm db:seed:material-stress  # Seed material stress lookup table
```

## ASME Calculation Formulas (CRITICAL)

All formulas in `server/componentCalculations.ts` and `server/professionalCalculations.ts`:

| Component | Formula | ASME Reference |
|-----------|---------|----------------|
| Shell t_min | `t = PR/(SE - 0.6P)` | UG-27(c)(1) |
| Shell MAWP | `P = SEt/(R + 0.6t)` (hoop) and `P = 2SEt/(R - 0.4t)` (longitudinal) — use minimum | UG-27(c) |
| 2:1 Ellipsoidal Head t_min | `t = PD/(2SE - 0.2P)` | UG-32(d) |
| Torispherical Head t_min | `t = PLM/(2SE - 0.2P)` where `M = 0.25(3 + √(L/r))` | UG-32(e) |
| Hemispherical Head t_min | `t = PR/(2SE - 0.2P)` | UG-32(f) |
| Corrosion Rate | `Cr = (t_prev - t_act) / Years` | API 510 |
| Remaining Life | `RL = (t_act - t_min) / Cr` | API 510 |
| Next Inspection | `min(RL/2, 10 years)` | API 510 §6.4 |

**DO NOT add corrosion allowance (CA) to t_min** — CA is only for design, not fitness-for-service calculations.

## Key Data Flow Patterns

### PDF Import → Calculations
1. User uploads PDF → `pdfImportRouter.extractFromPDF` 
2. LLM extracts structured data (vessel, TML readings, findings)
3. Data saved to `inspections`, `tmlReadings` tables
4. `generateDefaultCalculationsForInspection()` creates Shell, East Head, West Head calculations
5. Anomaly detection runs via `anomalyRouter.detectAnomalies`

### Professional Report Generation
1. `professionalReportRouter.generatePdf` called with reportId
2. `generateProfessionalPDF()` in `professionalPdfGenerator.ts` builds PDF
3. Fetches data: inspection → componentCalculations → tmlReadings → findings
4. Uses jsPDF with custom table helpers

### Recalculate Flow
1. `professionalReportRouter.recalculate` with inspectionId
2. Fetches inspection-specific `allowableStress`, `jointEfficiency` (NOT hardcoded!)
3. Groups TML readings by component (shell, east head, west head)
4. Calculates t_min, MAWP, corrosion rate, remaining life per component
5. Updates `componentCalculations` table

## Component Detection Patterns

```typescript
// In routers.ts and professionalReportRouters.ts
const isShell = (c: string) => c.includes('shell') && !c.includes('head');
const isEastHead = (c: string) => 
  c.includes('east') || c.includes('e head') || c.includes('head 1') || c.includes('north');
const isWestHead = (c: string) => 
  c.includes('west') || c.includes('w head') || c.includes('head 2') || c.includes('south');
```

## Database Schema Highlights

```typescript
// Key tables in drizzle/schema.ts
inspections        // Vessel metadata, design parameters, allowableStress, jointEfficiency
tmlReadings        // Thickness readings with tml1-4 for multi-angle, readingType (nozzle/seam/spot)
componentCalculations  // Shell/Head calculations with t_min, MAWP, corrosionRate, remainingLife
professionalReports    // Links to inspection, generated PDF URL
reportAnomalies        // Detected issues (thickness below min, high corrosion, etc.)
materialStressValues   // ASME allowable stress lookup by material and temperature
```

## Testing Patterns

```bash
pnpm test                    # Run all tests
pnpm test server/audit.test.ts  # Specific test file
```

Key test files:
- `server/audit.test.ts` — Validation dashboard, component calculations
- `server/asmeCalculations.test.ts` — Formula verification
- `server/cmlDeduplication.test.ts` — TML reading consolidation

## Critical Conventions

1. **Use centralized logger**: `import { logger } from './_core/logger'` — NOT `console.log`
2. **No hardcoded calculation values**: Always read `inspection.allowableStress`, `inspection.jointEfficiency`
3. **Time span calculation**: Use `calculateTimeSpanYears()` helper, not hardcoded 10 years
4. **Dual corrosion rates**: Long-term (LT) and Short-term (ST), use governing (max) rate
5. **Error handling**: Wrap PDF operations in try-catch, use toast notifications on client
6. **File storage**: Use `storagePut()` for R2/S3 uploads, handle trailing slashes in URLs

## Common Gotchas

- **Head detection**: TML readings may have component="Head" with location="West Head" — check both fields
- **Radius vs Diameter**: Shell formulas use R (radius), head formulas often use D (diameter)
- **Joint efficiency defaults**: RT-1=1.0, RT-2=0.85, RT-3=0.70, RT-4=0.60
- **Material stress lookup**: `materialStressRouter.getStressValue` with temperature interpolation
- **PDF generation hardcodes**: Check `professionalPdfGenerator.ts` for any remaining hardcoded arrays

## Location Mapping System

Configurable CML-to-component mappings in `server/locationMappingRouter.ts`:

```typescript
// Database table: locationMappings
// Allows vessel-specific or default mappings
{
  vesselTagNumber: "54-11-001",  // null for default mappings
  locationPattern: "8|9|10|11|12",  // regex pattern for CML locations
  componentType: "shell",
  componentName: "Vessel Shell"
}
```

**Usage in calculations:**
```typescript
// In professionalReportDb.ts - categorizeTmlReadings()
const mappings = await getLocationMappings(vesselTagNumber);
readings.forEach(r => {
  const match = mappings.find(m => new RegExp(m.locationPattern).test(r.location));
  r.componentType = match?.componentType || 'shell';
});
```

**Settings page**: `/settings/location-mapping` — UI for defining location-to-component mappings.

## Anomaly Detection System

`server/anomalyRouter.ts` detects issues during PDF import:

| Anomaly Type | Detection Logic | Severity |
|--------------|-----------------|----------|
| Below minimum thickness | `t_act < t_min` | critical |
| High corrosion rate | `Cr > 0.010 in/yr` | high |
| Negative remaining life | `RL < 0` | critical |
| Missing E value | `jointEfficiency === null` | warning |
| Thickness variation | `stdDev > 0.050"` within component | medium |

**Database table**: `reportAnomalies` — stores detected issues with `reviewStatus` (pending_review, reviewed, approved).

**Action plans**: `anomalyActionPlans` table for tracking remediation with assignments, due dates, priority.

## PDF Parser Configurations

Three parser options in `server/routers/pdfImportRouter.ts`:

| Parser | Use Case | Configuration |
|--------|----------|---------------|
| **Manus AI** | Default, text-based PDFs | Uses `invokeLLM()` with structured JSON schema |
| **Document AI** | Scanned PDFs, handwritten | Requires `GOOGLE_CLOUD_PROJECT_ID`, `DOCUMENT_AI_PROCESSOR_ID` |
| **Docupipe** | Legacy | `DOCUPIPE_API_KEY`, `DOCUPIPE_SCHEMA_ID` |

**LLM extraction prompt** in `COMPREHENSIVE_EXTRACTION_PROMPT`:
- Extracts vessel data, TML readings, nozzles, findings, TABLE A calculations
- Looks for E value in both metadata AND calculation tables
- Handles North/South and East/West head naming conventions

## Mobile Field Inspector (PWA)

`client/src/pages/FieldInspector.tsx` — offline-capable TML data capture:

```typescript
// Offline storage: localStorage
// Service worker: client/public/sw.js
// Sync mechanism: Background sync when online

// Data capture flow:
1. Select vessel from dropdown
2. Enter CML, location, thickness readings
3. Capture photo with geolocation
4. Store locally if offline
5. Auto-sync when connection restored
```

**PWA manifest**: `client/public/manifest.json` — installable on mobile devices.

## Dual Corrosion Rate System (Phase 1)

`server/enhancedCalculations.ts` implements industry-standard dual rates:

```typescript
// Long-term rate: total metal loss over vessel lifetime
CR_LT = (t_initial - t_actual) / totalYears

// Short-term rate: recent inspection interval
CR_ST = (t_previous - t_actual) / intervalYears

// Governing rate: use maximum (most conservative)
CR_governing = Math.max(CR_LT, CR_ST)
```

**Database fields**: `corrosionRateLT`, `corrosionRateST`, `governingRate`, `governingRateReason` in `componentCalculations`.

**Zero corrosion handling**: Default to nominal rate of 0.001 ipy (1 mpy) when no measurable corrosion.

## Material Stress Database

`server/materialStressRouter.ts` with 187+ data points:

**Seeded materials** (via `pnpm db:seed:material-stress`):
- SA-240 Type 304/316 (stainless)
- SA-516 Grade 55/60/65/70 (carbon steel)
- SA-515 Grade 60/70 (older vessels)
- SA-387 Grade 11/22 (chrome-moly)
- SA-612 (low-temp carbon steel)
- SA-106 Grade B (pipe)

**Temperature interpolation**:
```typescript
// Linear interpolation between data points
const stress = stressLow + (stressHigh - stressLow) * (temp - tempLow) / (tempHigh - tempLow);
```

## Trend Analysis (Phase 4)

`server/trendAnalysisRouter.ts` — multi-inspection comparison:

- `getVesselInspectionHistory`: All inspections for a vessel by tag number
- Thickness degradation charts with Chart.js
- Corrosion rate acceleration detection (>50% increase = alert)
- Route: `/trends/:vesselTagNumber`

## Component Hierarchy (Phase 5)

Database fields in `componentCalculations`:
- `parentComponentId` — links CMLs to parent components
- `componentPath` — hierarchical path string
- `hierarchyLevel` — tree depth (0=vessel, 1=component, 2=CML)

**Life-limiting analysis**: Identifies component with shortest remaining life for prioritization.

## Hybrid PDF Parser (NEW - Mixed Content Support)

\\server/hybridPdfParser.ts\\ - Auto-detects and handles mixed text/scanned PDFs:

\\\	ypescript
// Detection algorithm:
// 1. Extract text from all pages using pdfjs-dist
// 2. Analyze each page - if <100 chars, mark as scanned
// 3. Choose strategy based on scanned ratio:
//    - >50% scanned  full vision parsing
//    - 0% scanned  standard text parsing  
//    - Mixed  hybrid extraction with merge

// Merge priority:
// - Text extraction takes priority (more accurate for text)
// - Vision fills gaps for scanned content
// - TML readings deduplicated by CML number
// - Larger checklist/nozzle arrays preferred
\\\

**Parser Selection (UI dropdown):**
| Option | Use Case |
|--------|----------|
| **Hybrid Auto-Detect** (default) | Mixed text + scanned PDFs |
| Manus AI | Pure text-based PDFs |
| Vision Parser | Fully scanned/handwritten PDFs |
| Docupipe | Legacy |

