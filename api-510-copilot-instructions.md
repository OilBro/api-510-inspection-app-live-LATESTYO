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
