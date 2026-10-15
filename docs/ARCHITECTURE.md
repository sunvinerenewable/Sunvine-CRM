# Sunvine Renewable Energy — Fullstack Architecture Blueprint

## 1. System Overview

Sunvine Renewable Energy Portal is an enterprise Solar EPC management system powering Dealers, Verification Staff, and Administrators across Gujarat. The application provides instant solar engineering sizing, 4-page PDF proposal generation, customer lifecycle file tracking, and administrative controls.

---

## 2. Directory Structure & Responsibilities

```
dealer-portal-quotation/
├── api/                        # Serverless Backend Endpoints (Vercel / Node)
│   ├── _lib/                   # Backend Utilities & Middleware
│   │   ├── apiResponse.js      # Standard JSON response helpers (jsonSuccess, jsonError)
│   │   ├── authLogin.js        # PBKDF2/Bcrypt authentication handlers
│   │   ├── authLogout.js       # Secure session termination
│   │   ├── authManage.js       # Admin user lifecycle operations
│   │   ├── authVerify.js       # JWT & session verification
│   │   ├── cors.js             # Strict CORS allowlist handler (SEC-001)
│   │   ├── db.js               # PostgreSQL pool & Supabase service client
│   │   ├── documentStorage.js  # S3/R2 canonical path & upload utilities
│   │   ├── env.js              # Server-side environment configuration & validation
│   │   ├── errorHandler.js     # Sanitized error wrapper & middleware (Rule 2)
│   │   ├── jwt.js              # Token signing & verification (PBKDF2/HMAC)
│   │   ├── rateLimiter.js      # Distributed Upstash Redis & in-memory rate limiting
│   │   ├── redis.js            # Redis client & cacheAside helpers
│   │   ├── requireAuth.js      # Role-based access control guards (requireUser, requireAdmin)
│   │   ├── security.js         # Security hardening helpers
│   │   └── slackSync.js        # Slack Block Kit thread sync & notification engine
│   ├── auth/[action].js        # Authentication action dispatcher
│   ├── catalog.js              # Hardware, BOM, and system pricing catalog endpoint
│   ├── customer-files.js       # Customer lifecycle applications endpoint
│   ├── ledger.js               # Dealer financial ledger endpoint
│   ├── quotations.js           # Quotation persistence & public proposal endpoint
│   └── storage-*.js            # Cloudflare R2 presigned URLs, downloads, deletions
│
├── src/                        # Client Frontend Application (React 18 + Vite)
│   ├── config/                 # Frontend Configuration & Environment
│   │   ├── env.js              # Client-safe environment variables & telemetry flags
│   │   └── version.js          # Build version & changelog definitions
│   │
│   ├── context/                # Global Application State
│   │   ├── AppContext.jsx      # Core enterprise state (auth, dealers, quotations, settings)
│   │   └── LoadingContext.jsx  # Global action loader & spinner coordinator
│   │
│   ├── hooks/                  # Specialized Custom Hooks
│   │   ├── useAuth.js          # Domain hook for user session & role-based checks
│   │   ├── useQuotations.js    # Domain hook for quotation operations & drafts
│   │   ├── useCustomerFiles.js # Domain hook for customer applications & timeline
│   │   ├── useCatalog.js       # Domain hook for catalog & pricing matrices
│   │   ├── useHighAccuracyLocation.js # GPS telemetry (>35m threshold)
│   │   └── useRealtimeCustomerFiles.js # Supabase realtime subscriptions
│   │
│   ├── services/               # API & Network Services (Client-side Data Layer)
│   │   ├── authService.js      # HTTP-only cookie authentication & rate limiting
│   │   ├── quotationService.js # Quotation CRUD & normalization
│   │   ├── customerFileService.js # Customer application CRUD & document uploads
│   │   ├── dealerService.js    # Dealer account management
│   │   ├── pricingService.js   # Pricing matrices & tier margins
│   │   ├── storageService.js   # R2 presigned upload & file download handlers
│   │   └── crashReporter.js    # Slack crash alert webhook integration
│   │
│   ├── shared/                 # Isomorphic Logic (Shared between src/ and api/)
│   │   └── pricing/
│   │       └── calculations.js # Single source of truth for all financial & engineering math
│   │
│   ├── utils/                  # Utility Functions
│   │   ├── errorHandler.js     # Client error parser, toast dispatcher, safeAsync
│   │   ├── validators.js       # GSTIN, PAN, Phone, Email, Capacity validators
│   │   ├── solarCalculations.js# Re-export of shared pricing calculations
│   │   ├── solarLayoutEngine.js# Rooftop solar panel layout generation
│   │   └── quotationShare.js   # Public proposal share URL & token generator
│   │
│   ├── components/             # User Interface Components
│   │   ├── ui/                 # Reusable Design System (Button, Input, Card, Modal, etc.)
│   │   ├── AdminPortal/        # Administrative modules & management screens
│   │   ├── DealerPortal/       # Dealer quotation builder, proposals, dashboard
│   │   ├── StaffPortal/        # Field staff leads, files, radar map, verification desk
│   │   ├── Auth/               # Login screens (Dealer, Staff, Admin)
│   │   ├── Shared/             # Modal dialogs, skeletons, error boundaries, navigation
│   │   ├── App.jsx             # Root application orchestrator & route selector
│   │   ├── PortalApp.jsx       # Authenticated portal shell
│   │   └── PublicQuotationView.jsx # Standalone WhatsApp proposal viewer
│   │
│   └── data/                   # Default Master Presets & Fallback Registries
│       ├── defaultPresets.js   # Master BOM specs, hardware catalog defaults
│       └── systemSettingsDefaults.js # Default system governance rules
│
└── docs/                       # Architectural & Technical Documentation
    ├── ARCHITECTURE.md         # Fullstack architectural overview
    ├── API_REFERENCE.md        # Serverless API contracts & security guide
    ├── DESIGN_SYSTEM.md        # UI/UX design tokens & reusable component guide
    └── ENVIRONMENT_CONFIG.md   # Client & server environment configuration guide
```

---

## 3. Core Architectural Directives

### 1. Direct Database First (Rule 1)
- Zero cache-only or localStorage-only mutations.
- Every create, read, update, or delete operation persists directly to PostgreSQL / Supabase via secure backend API routes.
- On page mount or hard refresh (`Ctrl + Shift + R`), data is fetched live from the database.

### 2. Adversarial Backend Security & Zero Secrets (Rule 2)
- Passwords are encrypted using salted PBKDF2 / bcrypt hashes before persistence. Plaintext passwords are never saved.
- Zero secrets committed to version control.
- API endpoints strictly enforce role authorization (`requireUser`, `requireAdmin`) and prevent IDOR, SQL injection, and parameter tampering.
- API errors are sanitized via `api/_lib/errorHandler.js` so connection strings and internal exceptions are never exposed to clients.

### 3. Separation of Concerns
- **UI Components (`src/components/`)**: Focus solely on presentation, rendering, and handling user interactions.
- **Business Logic & API Services (`src/services/`)**: Enforce validation, payload formatting, network calls, and database operations.
- **Math & Financial Engine (`src/shared/pricing/calculations.js`)**: Single source of truth for PM Surya Ghar subsidies, BOM totals, GST rounding, and EMI calculations.
- **State Management (`src/context/` & `src/hooks/`)**: Central reactive stores decomposed into domain-specific hooks (`useAuth`, `useQuotations`, `useCustomerFiles`, `useCatalog`).

---

## 4. Scalable API Pipeline

Every request to `/api/*` executes through a standardized pipeline:
```
Client Request
      │
      ▼
applyCors() ───► Preflight OPTIONS (204)
      │
      ▼
checkDistributedRateLimit() ───► Rate Limited (429)
      │
      ▼
requireUser() / requireAdmin() ───► Unauthorized (401) / Forbidden (403)
      │
      ▼
Request Handler Execution (with Business Validation)
      │
      ├─── Success ───► jsonSuccess(res, data, meta) (200 / 201)
      │
      └─── Failure ───► withApiHandler catch ──► jsonError(res, statusCode, message)
```
