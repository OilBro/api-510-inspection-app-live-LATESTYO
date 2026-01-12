# API 510 Pressure Vessel Inspection Application

A comprehensive web application for managing API 510 pressure vessel inspections, generating professional reports, and performing ASME-compliant thickness and corrosion calculations.

## Features

### Core Functionality
- **Inspection Management** - Create, view, and manage pressure vessel inspections
- **Professional Report Generation** - Generate API 510-compliant inspection reports in PDF format
- **PDF Import** - Import existing inspection reports using AI-powered parsing (Manus Parser, Vision LLM)
- **Thickness Analysis** - Track and analyze thickness measurement locations (TML/CML readings)
- **Calculation Engine** - ASME Section VIII Division 1 compliant calculations for:
  - Minimum required thickness
  - Maximum allowable working pressure (MAWP)
  - Corrosion rates (long-term and short-term)
  - Remaining life predictions
  - Next inspection intervals
- **Validation Dashboard** - Compare app-calculated values against PDF original values
- **Nozzle Evaluations** - Track and evaluate nozzle integrity
- **FFS Assessments** - Fitness-for-service evaluations
- **In-Lieu-of Inspections** - Alternative inspection method tracking
- **Photo Management** - Upload, annotate, and organize inspection photos
- **CSV Export** - Export raw calculation data for external analysis

### Advanced Features
- **CML Deduplication** - Intelligently merge multi-angle readings into single records
- **Data Quality Indicators** - Flag anomalies, growth errors, and below-minimum readings
- **Dual Corrosion Rate System** - Track both long-term and short-term corrosion rates
- **Component Hierarchy** - Organize vessel components (shell, heads, nozzles)
- **Field Mapping System** - AI-powered field mapping for flexible PDF imports
- **Unmatched Data Review** - Manual review interface for unparsed PDF data

## Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Build tool and dev server
- **Tailwind CSS 4** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - Pre-built component library
- **tRPC** - End-to-end type-safe APIs
- **TanStack Query** - Data fetching and caching
- **Wouter** - Lightweight routing
- **Chart.js** - Data visualization
- **Framer Motion** - Animations

### Backend
- **Express** - Web server
- **tRPC 11** - Type-safe API layer
- **Drizzle ORM** - Database ORM
- **MySQL/TiDB** - Database
- **PDFKit** - PDF generation
- **OpenAI** - LLM integration for parsing
- **AWS S3/R2** - File storage
- **Jose** - JWT authentication

### Development Tools
- **Vitest** - Unit testing
- **ESBuild** - Fast bundling
- **Prettier** - Code formatting
- **TypeScript** - Static type checking
- **pnpm** - Package management

## Installation

### Prerequisites
- Node.js 22.x or higher
- pnpm 10.x or higher
- MySQL 8.x or compatible database (TiDB recommended)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/OilBro/api-510-inspection-app.git
   cd api-510-inspection-app
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   
   Environment variables are managed by the Manus platform. All required secrets are automatically injected at runtime. For local development outside Manus, contact the platform administrator for credentials.

4. **Set up database**
   ```bash
   pnpm db:push
   ```
   
   This generates and applies database migrations.

5. **Start development server**
   ```bash
   pnpm dev
   ```
   
   Application will be available at `http://localhost:3000`

## Environment Variables
All environment variables are managed by the Manus platform and automatically injected at runtime. Key variables include:

### Database
- `DATABASE_URL` - MySQL connection string

### Authentication
- `JWT_SECRET` - Secret for signing session tokens
- `OAUTH_SERVER_URL` - Manus OAuth backend URL
- `VITE_OAUTH_PORTAL_URL` - Manus login portal URL
- `VITE_APP_ID` - Manus application ID
- `OWNER_OPEN_ID` - Owner's OpenID
- `OWNER_NAME` - Owner's name

### Storage
- `R2_ACCESS_KEY_ID` - Cloudflare R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `R2_BUCKET_NAME` - R2 bucket name
- `R2_ENDPOINT` - R2 endpoint URL
- `R2_PUBLIC_URL` - Public URL for R2 assets
- `STORAGE_PROVIDER` - Storage provider (default: "r2")

### APIs
- `BUILT_IN_FORGE_API_KEY` - Manus Forge API key (server-side)
- `BUILT_IN_FORGE_API_URL` - Forge API URL
- `VITE_FRONTEND_FORGE_API_KEY` - Forge API key (client-side)
- `VITE_FRONTEND_FORGE_API_URL` - Forge API URL (client-side)
- `DOCUPIPE_API_KEY` - Docupipe API key (optional)
- `DOCUPIPE_SCHEMA_ID` - Docupipe schema ID (optional)

### Application
- `VITE_APP_TITLE` - Application title
- `VITE_APP_LOGO` - Logo path
- `VITE_ANALYTICS_ENDPOINT` - Analytics endpoint (optional)
- `VITE_ANALYTICS_WEBSITE_ID` - Analytics website ID (optional)

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm check` - Type check without emitting files
- `pnpm format` - Format code with Prettier
- `pnpm test` - Run unit tests
- `pnpm db:push` - Generate and apply database migrations

### Project Structure

```
api-510-inspection-app/
├── client/                 # Frontend React application
│   ├── public/            # Static assets
│   └── src/
│       ├── components/    # Reusable UI components
│       │   ├── ui/       # shadcn/ui components
│       │   ├── inspection/  # Inspection-specific components
│       │   └── professionalReport/  # Report components
│       ├── pages/         # Page components
│       ├── contexts/      # React contexts
│       ├── hooks/         # Custom hooks
│       ├── lib/           # Utilities and tRPC client
│       ├── App.tsx        # Routes and layout
│       ├── main.tsx       # Entry point
│       └── index.css      # Global styles
├── server/                # Backend Express + tRPC server
│   ├── _core/            # Core server infrastructure
│   │   ├── index.ts      # Server entry point
│   │   ├── context.ts    # tRPC context
│   │   ├── llm.ts        # LLM integration
│   │   ├── map.ts        # Google Maps integration
│   │   └── voiceTranscription.ts  # Audio transcription
│   ├── routers.ts        # Main tRPC router
│   ├── db.ts             # Database queries
│   ├── professionalReportRouters.ts  # Report generation
│   ├── professionalPdfGenerator.ts   # PDF generation
│   ├── componentCalculations.ts      # ASME calculations
│   ├── manusParser.ts    # AI PDF parser
│   └── *.test.ts         # Vitest test files
├── drizzle/              # Database schema and migrations
│   └── schema.ts         # Database tables
├── storage/              # S3 storage helpers
├── shared/               # Shared constants and types
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── README.md             # This file
```

### Key Concepts
#### tRPC Procedures
All API endpoints are defined as tRPC procedures in `server/routers.ts` and `server/professionalReportRouters.ts`. Frontend calls them using type-safe hooks:

```typescript
// Backend (server/routers.ts)
export const appRouter = router({
  inspection: {
    create: protectedProcedure
      .input(z.object({ ... }))
      .mutation(async ({ input }) => {
        // Implementation
      })
  }
});

// Frontend (client/src/pages/NewInspection.tsx)
const createInspection = trpc.inspection.create.useMutation();
```

#### Component Calculations
ASME Section VIII Division 1 calculations are performed in `server/componentCalculations.ts`:

- **Shell minimum thickness**: `t_min = PR/(SE - 0.6P)`
- **Head minimum thickness**: `t_min = PD/(2SE - 0.2P)` (2:1 ellipsoidal)
- **Corrosion rate**: `Cr = (t_prev - t_act) / Years`
- **Remaining life**: `RL = Ca / Cr` where `Ca = t_act - t_min`

#### PDF Import Flow
1. User uploads PDF
2. Manus Parser extracts structured data using LLM
3. Field mapping system matches extracted fields to database schema
4. TML readings are deduplicated and consolidated
5. Component calculations are auto-generated
6. Professional report is created

## Testing

Run unit tests:
```bash
pnpm test
```

Test files are located alongside source files with `.test.ts` extension:
- `server/auth.logout.test.ts` - Authentication tests
- `server/cmlDeduplication.test.ts` - CML deduplication logic
- `server/thicknessTable.test.ts` - PDF table generation
- `server/csvExport.test.ts` - CSV export functionality
- `server/headEvaluation.test.ts` - Head evaluation calculations

## Deployment

### Production Build

1. **Build the application**
   ```bash
   pnpm build
   ```
   
   This creates:
   - `dist/` - Server bundle
   - `client/dist/` - Client bundle

2. **Start production server**
   ```bash
   pnpm start
   ```

### Manus Platform Deployment

This application is designed to be deployed on the Manus platform:

1. Create checkpoint: `webdev_save_checkpoint`
2. Click "Publish" button in Management UI
3. Configure custom domain (optional)

## License

MIT

## Support


For issues or questions, please contact:
- **Email**: support@oilproconsulting.com
- **Phone**: 337-446-7459
- **Website**: www.oilproconsulting.com