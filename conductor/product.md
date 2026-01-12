# Initial Concept

A comprehensive web application for managing API 510 pressure vessel inspections, generating professional reports, and performing ASME-compliant thickness and corrosion calculations.

---

# Product Guide

## Overview

The **API 510 Pressure Vessel Inspection Application** is a professional-grade web application designed for API 510 certified inspectors, plant engineers, and integrity management professionals. It streamlines the entire pressure vessel inspection workflow from data collection to report generation.

## Target Users

### Primary Users
- **API 510 Certified Inspectors** - Professionals conducting pressure vessel inspections who need accurate calculations and professional report generation
- **Plant Integrity Engineers** - Engineers responsible for managing pressure vessel integrity programs
- **Inspection Companies** - Organizations providing third-party inspection services

### Secondary Users
- **Plant Operators** - Personnel who need to review inspection results and remaining life calculations
- **Regulatory Compliance Officers** - Staff ensuring adherence to ASME and API standards

## Core Value Proposition

1. **ASME-Compliant Calculations** - Accurate implementation of ASME Section VIII Division 1 formulas for all component types
2. **Professional Report Generation** - API 510-compliant inspection reports in PDF format
3. **AI-Powered Data Import** - Intelligent parsing of existing inspection PDFs with field mapping
4. **Comprehensive Validation** - Edge case handling and data quality indicators

## Key Features

### Inspection Management
- Create, view, and manage pressure vessel inspections
- Track inspection history and intervals
- Organize inspections by vessel, plant, or client

### Calculation Engine
ASME Section VIII Division 1 compliant calculations for:
- **Shell Components** (UG-27): Minimum required thickness and MAWP
- **2:1 Ellipsoidal Heads** (UG-32d): Standard head calculations
- **Hemispherical Heads** (UG-32f): Efficient head design calculations
- **Torispherical Heads** (UG-32e): M factor and edge case validation
- **Flat Heads**: Various attachment methods
- **Conical Sections**: Half-apex angle calculations
- **Corrosion Rates**: Long-term and short-term tracking
- **Remaining Life**: Conservative predictions based on corrosion data

### Data Import
- **Manus Parser**: AI-powered text extraction from PDFs
- **Vision Parser**: GPT-4 Vision for scanned documents
- **Hybrid Parser**: Combined approach for complex documents
- **Field Mapping System**: Intelligent mapping with confidence scores

### Report Generation
- Professional API 510-compliant PDF reports
- Executive summary with key findings
- Thickness measurement tables
- Calculation verification tables
- Photo documentation integration

### Data Quality
- **Anomaly Detection**: Flags growth errors and below-minimum readings
- **Validation Warnings**: Edge case notifications for complex geometries
- **CML Deduplication**: Intelligent merging of multi-angle readings

## Technical Architecture

### Frontend
- React 19 with TypeScript
- Tailwind CSS 4 for styling
- shadcn/ui component library
- tRPC for type-safe API calls
- TanStack Query for data management

### Backend
- Express server with tRPC 11
- Drizzle ORM with MySQL/TiDB
- PDFKit for report generation
- OpenAI integration for AI parsing
- AWS S3/R2 for file storage

### Testing
- Vitest for unit testing
- 308+ tests covering all calculations
- Comprehensive edge case validation

## Success Metrics

1. **Calculation Accuracy**: 100% match with hand calculations and ASME examples
2. **Test Coverage**: All ASME formulas validated with comprehensive test suites
3. **User Efficiency**: Reduce inspection report generation time by 70%
4. **Data Quality**: Zero calculation errors in production reports

## Roadmap

### Completed (Tracks 001-002)
- [x] Comprehensive ASME calculation validation
- [x] Edge case handling for torispherical heads
- [x] Extended validation to all head types
- [x] 308 tests passing with zero regressions

### Planned
- [ ] Enhanced nozzle reinforcement calculations
- [ ] Fitness-for-service (FFS) assessment automation
- [ ] Integration with external inspection databases
- [ ] Mobile-friendly inspection data entry
- [ ] Real-time collaboration features
