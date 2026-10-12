# Sunvine Renewable Energy — Solar EPC Dealer & Admin Portal

[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2FSupabase-336791?style=flat&logo=postgresql&logoColor=white)](https://supabase.com/)

Production-grade Solar EPC Management System for Sunvine Renewable Energy. Powers dealer quotation sizing, residential PM Surya Ghar subsidy computations, 4-page customer proposal generation, customer lifecycle file verification, and administrative governance.

---

## 📖 Key Documentation

Detailed technical documentation is available in the [`docs/`](./docs) directory:

- [**Fullstack Architecture Blueprint**](./docs/ARCHITECTURE.md): Directory breakdown, separation of concerns, data flow, and security model.
- [**API Reference & Contracts**](./docs/API_REFERENCE.md): Serverless endpoint contracts, auth guards, rate limiting, and standard responses.
- [**UI/UX Pro Max Design System**](./docs/DESIGN_SYSTEM.md): Reusable UI components (`src/components/ui/`), dark console theme tokens, accessibility rules.
- [**Environment Configuration Guide**](./docs/ENVIRONMENT_CONFIG.md): Client vs server environment variables, security guidelines, and rotation procedures.

---

## 🏗️ Architecture & Folder Structure

```
dealer-portal-quotation/
├── api/                  # Serverless API routes (Node / Vercel functions)
│   ├── _lib/             # Auth guards, CORS, DB pool, R2 storage, Redis, error handler
│   ├── auth/             # Multi-tenant login, logout, verification, account management
│   ├── catalog.js        # Hardware, BOM, and pricing catalog
│   ├── customer-files.js # Customer application lifecycle & Slack thread sync
│   └── quotations.js     # Quotations persistence & public proposal URLs
├── src/                  # Client React application
│   ├── components/       # UI presentation layer
│   │   ├── ui/           # Modular design system (Button, Input, Select, Card, Modal, Badge)
│   │   ├── AdminPortal/  # Management console, pricing matrix, staff accounts
│   │   ├── DealerPortal/ # Quotation builder, PDF proposals, dealer dashboard
│   │   ├── StaffPortal/  # Field staff leads, files, radar map, verification desk
│   │   └── Shared/       # Dialogs, skeletons, error boundaries, navigation
│   ├── config/           # Centralized environment configuration (src/config/env.js)
│   ├── context/          # Global application state (AppContext, LoadingContext)
│   ├── hooks/            # Modular domain hooks (useAuth, useQuotations, useCustomerFiles, useCatalog)
│   ├── services/         # Client API & database services (authService, quotationService, etc.)
│   ├── shared/           # Isomorphic mathematical engines (PM Surya Ghar calculations)
│   └── utils/            # Validators, error handlers, layout algorithms
└── docs/                 # Architectural specifications and manuals
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation
```bash
# Clone the repository
git clone https://github.com/Sunvine-Solar/dealer-portal-quotation.git
cd dealer-portal-quotation

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase, JWT, and Cloudflare credentials
```

### Development
```bash
# Start Vite development server with local API middleware
npm run dev

# Run comprehensive test suite
npm test

# Production build
npm run build
```

---

## 🔒 Master Directives & Security Standards

The codebase strictly adheres to the Master Directives outlined in [`AGENTS.md`](./AGENTS.md):
1. **Direct Database First**: All operational data persists directly to PostgreSQL/Supabase. No cache-only mutations.
2. **Adversarial Backend Security**: Passwords salted and hashed with PBKDF2/bcrypt. Zero hardcoded secrets. Sanitized API errors.
3. **Cross-Touchpoint Consistency**: Mandatory fields and validation rules enforced uniformly across all user touchpoints.
4. **UI/UX Pro Max Protocol**: Dark console theme (`#0D1527` surface, `#070D18` canvas), emerald-to-teal gradients, 44px touch targets, WCAG 4.5:1 contrast.
5. **Non-Blocking Workflows**: Document uploads are optional for creating records and proposals.
6. **Branch Protection**: All commits push strictly to `sumit-updates`. Mandatory `npm run build` and `npm test` passing with 0 errors.

---

## 📄 License
Private & Confidential — Sunvine Renewable Energy © 2026. All rights reserved.
