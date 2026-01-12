# Technology Stack: API 510 Pressure Vessel Inspection Application

## Programming Languages

### Primary Languages
- **TypeScript 5.9.3** - Type-safe development for both frontend and backend
- **JavaScript (ES Modules)** - For build scripts and utilities
- **Python 3.11+** - For specialized calculation scripts and data analysis

## Frontend Stack

### Core Framework
- **React 19.1.1** - Modern UI framework with concurrent features
- **Vite 7.1.7** - Fast build tool and development server with HMR

### Styling and UI
- **Tailwind CSS 4.1.14** - Utility-first CSS framework
- **@tailwindcss/vite 4.1.3** - Vite integration for Tailwind
- **Radix UI** - Accessible, unstyled component primitives
- **shadcn/ui** - Pre-built component library based on Radix UI
- **Framer Motion 12.23.22** - Animation library
- **Lucide React 0.453.0** - Icon library

### State Management and Data Fetching
- **tRPC 11.6.0** - End-to-end type-safe API layer
- **@trpc/react-query 11.6.0** - React Query integration for tRPC
- **TanStack Query 5.90.2** - Powerful data fetching and caching
- **React Hook Form 7.64.0** - Form state management
- **Zod 4.1.12** - Schema validation and type inference

### Routing and Navigation
- **Wouter 3.3.5** - Lightweight routing library (with custom patch)

### Data Visualization
- **Chart.js 4.5.1** - Flexible charting library
- **React ChartJS 2 5.3.1** - React wrapper for Chart.js
- **Recharts 2.15.2** - Composable charting library

## Backend Stack

### Core Server
- **Express 4.21.2** - Web application framework
- **tRPC Server 11.6.0** - Type-safe API server
- **SuperJSON 1.13.3** - JSON serialization with type preservation

### Database
- **MySQL 8.x / TiDB** - Relational database (TiDB recommended for cloud)
- **Drizzle ORM 0.44.5** - Type-safe ORM with excellent TypeScript support
- **Drizzle Kit 0.31.4** - Migration and schema management tool
- **mysql2 3.15.0** - MySQL client for Node.js

### Authentication and Security
- **Jose 6.1.0** - JWT token generation and validation
- **Manus OAuth** - OAuth integration for user authentication

### File Storage
- **AWS SDK S3 Client 3.907.0** - S3-compatible storage client
- **Cloudflare R2** - S3-compatible object storage (primary)

### PDF Generation (Server-Side)
- **PDFKit 0.17.2** - Professional PDF document generation

### AI and LLM Integration
- **OpenAI 6.9.1** - LLM API client for PDF parsing and data extraction
- **Manus Forge API** - Integrated LLM service
- **Docupipe API** - Optional document parsing service

### Utilities
- **Axios 1.12.0** - HTTP client
- **date-fns 4.1.0** - Date manipulation library
- **nanoid 5.1.5** - Unique ID generation

## Development Tools

### Build and Bundling
- **ESBuild 0.25.0** - Fast JavaScript bundler
- **tsx 4.19.1** - TypeScript execution and watch mode
- **pnpm 10.15.1** - Fast, disk space efficient package manager

### Testing
- **Vitest 2.1.4** - Fast unit testing framework
- **Test Coverage Target**: >80% for calculation engines and critical paths

### Code Quality
- **Prettier 3.6.2** - Code formatting
- **TypeScript 5.9.3** - Static type checking

### Monitoring
- **Sentry Node 10.30.0** - Backend error tracking
- **Sentry React 10.30.0** - Frontend error tracking

## Architecture Patterns

### Frontend Architecture
- **Component-Based**: Reusable React components
- **Type-Safe APIs**: tRPC for end-to-end type safety
- **Optimistic Updates**: TanStack Query for responsive UI
- **Form Validation**: React Hook Form + Zod schemas

### Backend Architecture
- **tRPC Routers**: Modular API organization
- **Middleware Pattern**: Authentication, logging, error handling
- **Service Layer**: Business logic separation

### Calculation Engine
- **Pure Functions**: Stateless calculation functions
- **Unit Tested**: Comprehensive test coverage
- **ASME Compliant**: Validated against standards
- **Type-Safe**: Full TypeScript definitions

## Deployment Architecture

### Platform
- **Manus Platform** - Primary deployment target
- **Cloudflare R2** - File storage
- **TiDB Cloud** - Managed MySQL database

### Build Process
1. **Frontend Build**: Vite → `client/dist/`
2. **Backend Build**: ESBuild → `dist/`
3. **Database Migrations**: Drizzle Kit

## External Services

### Required Services
- **Manus Platform** - Hosting and runtime
- **Manus OAuth** - User authentication
- **Manus Forge API** - LLM integration
- **Cloudflare R2** - File storage
- **TiDB Cloud** - Database hosting

### Optional Services
- **Docupipe API** - Alternative PDF parsing
- **Sentry** - Error tracking and monitoring
