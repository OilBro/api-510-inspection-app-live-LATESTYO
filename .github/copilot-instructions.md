# API 510 Pressure Vessel Inspection App - Copilot Instructions

## Architecture Overview

Full-stack TypeScript app: **Express + tRPC 11** backend, **React 19 + Vite** frontend, **Drizzle ORM** with **MySQL/TiDB**.

```
client/src/
├── pages/              # Route components (Home, InspectionDetail, ValidationDashboard, etc.)
├── components/
│   ├── ui/             # shadcn/ui primitives (Radix UI + Tailwind CSS 4)
│   ├── inspection/     # Inspection tabs (VesselDataTab, CalculationsTab, ThicknessAnalysisTab)
│   └── professionalReport/  # PDF report components
├── lib/
│   ├── trpc.ts         # tRPC client (createTRPCReact<AppRouter>)
│   └── thicknessCalculations.ts  # Client-side ASME formulas
server/
├── _core/              # Infrastructure (index.ts, trpc.ts, llm.ts, logger.ts, oauth.ts, sentry.ts)
├── routers.ts          # Main appRouter combining all sub-routers
├── routers/pdfImportRouter.ts  # AI-powered PDF extraction with LLM
├── hybridPdfParser.ts  # Auto-detects text vs scanned PDF pages, merges results
├── manusParser.ts      # Default text-based PDF parser (uses pdfjs-dist)
├── visionPdfParser.ts  # Vision-based parser for scanned/handwritten PDFs
├── professionalReportRouters.ts  # Report generation, recalculate logic
├── professionalPdfGenerator.ts   # jsPDF-based PDF generation
├── componentCalculations.ts      # ASME Section VIII calculation engine
├── enhancedCalculations.ts       # Dual corrosion rate, anomaly detection
├── db.ts               # Database queries (inspections, TML readings)
├── professionalReportDb.ts       # Component calculations, findings
drizzle/schema.ts       # Database schema (inspections, tmlReadings, componentCalculations, etc.)
```

**Tech Stack**: React 19, TypeScript, tRPC 11, TanStack Query, Wouter (routing), Tailwind CSS 4, Radix UI, Framer Motion, Chart.js, jsPDF, Drizzle ORM, Express, OpenAI, AWS S3/R2, Sentry, Jose (JWT).

## Critical Development Commands

```bash
pnpm install          # REQUIRED: pnpm only (see package.json packageManager)
pnpm dev              # Starts Express server + Vite dev (auto port 3000-3019 if busy)
pnpm build            # Production build: Vite + esbuild server bundle
pnpm start            # Run production build (NODE_ENV=production)
pnpm test             # Run all Vitest tests (node environment)
pnpm test <file>      # Run specific test file (e.g., pnpm test server/audit.test.ts)
pnpm check            # TypeScript type checking (no emit)
pnpm db:push          # Generate + apply Drizzle migrations to database
pnpm db:seed:material-stress  # Seed ASME material stress lookup table (187+ data points)
```

## ASME Calculation Formulas (CRITICAL - DO NOT MODIFY)

All formulas in [server/componentCalculations.ts](server/componentCalculations.ts) and [server/professionalCalculations.ts](server/professionalCalculations.ts):

| Component | Formula | ASME Reference |
|-----------|---------|----------------|
| **Shell t_min** | `t = PR/(SE - 0.6P)` | UG-27(c)(1) |
| **Shell MAWP** | `P = SEt/(R + 0.6t)` (hoop) and `P = 2SEt/(R - 0.4t)` (long.) — **use minimum** | UG-27(c) |
| **2:1 Ellipsoidal Head t_min** | `t = PD/(2SE - 0.2P)` | UG-32(d) |
| **Torispherical Head t_min** | `t = PLM/(2SE - 0.2P)` where `M = 0.25(3 + √(L/r))` | UG-32(e) |
| **Hemispherical Head t_min** | `t = PR/(2SE - 0.2P)` | UG-32(f) |
| **Corrosion Rate** | `Cr = (t_prev - t_act) / Years` | API 510 |
| **Remaining Life** | `RL = (t_act - t_min) / Cr` | API 510 |
| **Next Inspection** | `min(RL/2, 10 years)` | API 510 §6.4 |

**Variables**: `P`=pressure (psi), `R`=radius (in), `D`=diameter (in), `S`=allowable stress (psi), `E`=joint efficiency (0.6-1.0), `t`=thickness (in), `L`=crown radius (in), `r`=knuckle radius (in).

**⚠️ CRITICAL**: DO NOT add corrosion allowance (CA) to `t_min` — CA is only for design, not fitness-for-service calculations.

## Mandatory Coding Conventions

1. **Logger Only**: `import { logger } from './_core/logger'` — NEVER use `console.log`, `console.error`, etc.
   ```typescript
   logger.info('Processing inspection', { inspectionId });
   logger.error('Failed to generate PDF', error);
   logger.debug('Debug info'); // Only in development
   ```

2. **No Hardcoded Values**: ALWAYS read from database — `inspection.allowableStress`, `inspection.jointEfficiency`, etc.
   ```typescript
   // ❌ WRONG
   const S = 17100; // Never hardcode
   
   // ✅ CORRECT
   const inspection = await getInspection(inspectionId);
   const S = inspection.allowableStress;
   ```

3. **Time Span Helper**: Use `calculateTimeSpanYears()` from [server/routers.ts](server/routers.ts) — NOT hardcoded 10 years.
   ```typescript
   const years = calculateTimeSpanYears(previousDate, currentDate, 10); // 10 = default
   ```

4. **Dual Corrosion Rates**: Always calculate long-term (LT) and short-term (ST), use governing (max) rate.
   ```typescript
   const CR_LT = (t_initial - t_actual) / totalYears;
   const CR_ST = (t_previous - t_actual) / intervalYears;
   const governingRate = Math.max(CR_LT, CR_ST);
   ```

5. **Error Handling**: Wrap PDF operations, LLM calls, and file I/O in try-catch. Use `toast.error()` on client.

6. **Storage**: Use `storagePut()` for R2/S3 uploads. Handle trailing slashes in URLs (R2 includes them).


## Key Data Flow Patterns

### 1. PDF Import → Calculations
```typescript
// 1. User uploads PDF → pdfImportRouter.extractFromPDF
// 2. Hybrid parser auto-detects text vs scanned pages (hybridPdfParser.ts)
// 3. LLM extracts structured data (COMPREHENSIVE_EXTRACTION_PROMPT in pdfImportRouter.ts)
// 4. Data saved to inspections, tmlReadings tables
// 5. generateDefaultCalculationsForInspection() creates Shell, East Head, West Head calcs
// 6. anomalyRouter.detectAnomalies runs automatically
```

### 2. Professional Report Generation
```typescript
// 1. professionalReportRouter.generatePdf called with reportId
// 2. generateProfessionalPDF() in professionalPdfGenerator.ts builds PDF
// 3. Fetches data chain: inspection → componentCalculations → tmlReadings → findings
// 4. Uses jsPDF with custom table helpers (see professionalPdfGenerator.ts)
```

### 3. Recalculate Flow (CRITICAL for accuracy)
```typescript
// 1. professionalReportRouter.recalculate with inspectionId
// 2. Fetch inspection-specific allowableStress, jointEfficiency (NEVER use hardcoded)
// 3. Group TML readings by component using component detection patterns
// 4. Calculate t_min, MAWP, corrosion rate, remaining life per component
// 5. Update componentCalculations table with results
```

## Component Detection Patterns

Located in [server/routers.ts](server/routers.ts) and [server/professionalReportRouters.ts](server/professionalReportRouters.ts):

```typescript
// Detect component type from TML reading component/location strings
const isShell = (c: string) => 
  c.toLowerCase().includes('shell') && !c.toLowerCase().includes('head');

const isEastHead = (c: string) => {
  const lc = c.toLowerCase();
  return lc.includes('east') || lc.includes('e head') || 
         lc.includes('head 1') || lc.includes('north');
};

const isWestHead = (c: string) => {
  const lc = c.toLowerCase();
  return lc.includes('west') || lc.includes('w head') || 
         lc.includes('head 2') || lc.includes('south');
};

// GOTCHA: TML readings may have component="Head" with location="West Head"
// Always check BOTH fields when categorizing
```


## Database Schema Highlights

Key tables in [drizzle/schema.ts](drizzle/schema.ts):

```typescript
inspections        // Vessel metadata, design parameters, allowableStress, jointEfficiency
tmlReadings        // Thickness readings with tml1-4 for multi-angle measurements
                   // readingType: "nozzle" | "seam" | "spot" | "general"
componentCalculations  // Per-component calcs: t_min, MAWP, corrosionRate, remainingLife
                       // Includes corrosionRateLT, corrosionRateST, governingRate
professionalReports    // Links to inspection, stores generated PDF URL
reportAnomalies        // Auto-detected issues (thickness below min, high corrosion, etc.)
                       // reviewStatus: "pending" | "acknowledged" | "resolved" | "false_positive"
anomalyActionPlans     // Tracks remediation with assignments, due dates, priority
materialStressValues   // ASME allowable stress lookup by material and temperature
locationMappings       // CML-to-component mapping patterns (vessel-specific or default)
```

## Testing Patterns

```bash
pnpm test                    # Run all Vitest tests (node environment)
pnpm test server/audit.test.ts  # Run specific test file
```

Key test files demonstrate real-world usage:
- [server/audit.test.ts](server/audit.test.ts) — Full PDF import → calculation → report generation
- [server/asmeCalculations.test.ts](server/asmeCalculations.test.ts) — Formula verification with known values
- [server/cmlDeduplication.test.ts](server/cmlDeduplication.test.ts) — Multi-angle TML reading consolidation
- [server/hardcodedValues.test.ts](server/hardcodedValues.test.ts) — Checks for hardcoded calculation values

## Common Gotchas

1. **Head detection**: TML readings may have `component="Head"` with `location="West Head"` — check BOTH fields
2. **Radius vs Diameter**: Shell formulas use R (radius), head formulas often use D (diameter)
3. **Joint efficiency defaults**: RT-1=1.0, RT-2=0.85, RT-3=0.70, RT-4=0.60
4. **Material stress lookup**: Use `materialStressRouter.getStressValue` with temperature interpolation
5. **R2/S3 URLs**: Handle trailing slashes in storage URLs (R2 includes them, S3 doesn't)
6. **TML reading types**: `readingType` field distinguishes nozzle/seam/spot measurements


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

**Database table**: `reportAnomalies` — stores detected issues with `reviewStatus` (pending, acknowledged, resolved, false_positive).

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

`server/hybridPdfParser.ts` - Auto-detects and handles mixed text/scanned PDFs:

```typescript
// Detection algorithm:
// 1. Extract text from all pages using pdfjs-dist
// 2. Analyze each page - if <100 chars, mark as scanned
// 3. Choose strategy based on scanned ratio:
//    - >50% scanned → full vision parsing
//    - 0% scanned → standard text parsing  
//    - Mixed → hybrid extraction with merge

// Merge priority:
// - Text extraction takes priority (more accurate for text)
// - Vision fills gaps for scanned content
// - TML readings deduplicated by CML number
// - Larger checklist/nozzle arrays preferred
```

**Parser Selection (UI dropdown):**
| Option | Use Case |
|--------|----------|
| **Hybrid Auto-Detect** (default) | Mixed text + scanned PDFs |
| Manus AI | Pure text-based PDFs |
| Vision Parser | Fully scanned/handwritten PDFs |
| Docupipe | Legacy |
