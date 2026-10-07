# Sunvine Renewable Energy — Master Project Vision & Strategic Goals

> **Company**: Sunvine Renewable Energy (Rajkot, Gujarat)  
> **Core Identity**: Impaneled Solar EPC, Vendor & Distributor  
> **Primary Platform**: Unified Solar ERP — Super Admin, Verification Desk, Dealer Console & Staff Portal

---

## 1. Executive Summary & Business Ecosystem

Sunvine Renewable Energy operates as an authorized/impaneled solar vendor based out of **Rajkot, Gujarat**. Because government solar subsidies (PM Surya Ghar Muft Bijli Yojana / GEDA / DISCOM) require impaneled vendor registration, non-impaneled regional solar contractors and distributors operate through Sunvine as **Dealers**.

### Dual Dealer Business Model

```
                          ┌─────────────────────────────────────┐
                          │    Sunvine Renewable Energy         │
                          │        (Rajkot Hub)                 │
                          └──────────────────┬──────────────────┘
                                             │
                    ┌────────────────────────┴────────────────────────┐
                    ▼                                                 ▼
     ┌─────────────────────────────┐                   ┌─────────────────────────────┐
     │   Type 1: Kit-Based Dealer  │                   │  Type 2: Margin/Commission  │
     │   (Self-Installation)       │                   │         Dealer (Lead Only)  │
     ├─────────────────────────────┤                   ├─────────────────────────────┤
     │ • Sunvine supplies full kit │                   │ • Sunvine supplies kit,     │
     │   (Panels, Inverter, BOS)   │                   │   manages installation,     │
     │ • Dealer installs himself   │                   │   and does all paperwork    │
     │ • Dealer sets retail margin │                   │ • Dealer only sources lead  │
     │ • Sunvine handles official  │                   │ • Dealer earns fixed        │
     │   subsidy registration      │                   │   per-kW commission         │
     │ • Registration fees apply   │                   │ • Payout tracked in ledger  │
     └─────────────────────────────┘                   └─────────────────────────────┘
```

---

## 2. Strategic Objectives & Core Pillars

### Pillar 1: Tab-Isolated Session Authentication (Multi-Tab Multi-Role Fix)
- **Objective**: Allow users to run Super Admin in Tab 1, Dealer in Tab 2, and Verification Desk in Tab 3 on the same machine without cross-tab session overwrites or role bleeding.
- **Mechanism**: Implement tab-scoped `sessionStorage` tokens paired with Authorization Bearer headers alongside server-side role validation.

### Pillar 2: Dynamic System-Wise Base Pricing & Dealer Margin Engine
- **Objective**: Eliminate static Excel sheets. Enable Admin to maintain system-wise base prices (by capacity kW and panel brand) that include standard BOM, inverter, and GST.
- **Dealer Flow**:
  - Dealer selects system capacity (e.g. 3.3 kW) and panel brand (e.g. Adani, Waaree, Rayzon).
  - Base price with GST auto-loads.
  - Dealer inputs their custom margin (e.g. ₹15,000).
  - Total quotation updates dynamically with automatic GST breakdown and download ready PDF.
  - **Inverter Policy**: Clear quotation clause stating installation uses Sunvine's certified 4-brand inverter pool based on stock availability.
  - **Structure & Site Add-ons**: Checkboxes for Standard GI, Elevated Structure, Tin Clamps, etc.
  - **Transportation Slabs**: Distance-based freight calculations from Rajkot.

### Pillar 3: Dealer-Specific Custom Pricing Overrides
- **Objective**: Support tiered/negotiated pricing where specific dealers receive customized rates per kW or per hardware item based on order volume or agreement.
- **Access Control**: Super Admin and authorized Verification Desk can configure dealer-specific price profiles.

### Pillar 4: Frictionless Lead-to-File Conversion & Stage Tracking
- **Objective**: Replace messy WhatsApp file exchanges with structured digital customer files.
- **Lifecycle**:
  1. Dealer converts approved Quotation into Customer File with 1 click.
  2. Dealer uploads documents directly (Aadhaar, Light Bill, Photos). Uploads remain non-blocking.
  3. Sunvine Operations team updates live stages: `Sourced` → `Survey Scheduled` → `Documents Received` → `DISCOM Registered` → `Kit Dispatched` → `Installation Completed` → `Net-Metering / PCR` → `Subsidy Disbursed`.
  4. Real-time status visibility for dealers eliminates repetitive status inquiry calls.

### Pillar 5: Bulk 1-Click Document Downloader for Operations
- **Objective**: Allow Sunvine back-office staff to download all uploaded customer documents as a single organized ZIP archive with standardized file names (`{CustomerName}_{DocType}.pdf`).

### Pillar 6: Comprehensive Financial & Payment Ledger
- **Objective**: Complete visibility over financial receivables and payables between Sunvine and Dealers.
- **Features**:
  - Payment modes: Cash vs Bank Loan tracking.
  - **Dealer Receivables**: If dealer owes kit payment, display prominent reminder banners and highlight amounts on the Dealer Dashboard.
  - **Dealer Payables**: Track per-kW commission payouts owed to Margin-Based dealers.
  - **Executive Summary**: Admin view of total outstanding dues and payable commissions.

### Pillar 7: Granular Role Ergonomics & Operational Matrix
- **Objective**: Empower the office Verification Desk (Madam's role) with full operational oversight (viewing pricing, verifying customer files, checking dealer status) while preserving critical destructive controls (deletion, master bank accounts, system settings) exclusively for Super Admin.

### Pillar 8: Common-Sense UX Optimization & Deadlock Removal
- **Objective**: Audit and remove illogical UX deadlocks across all portals (e.g., allowing dealers to delete or cancel their draft/erroneous quotations, clear filtering, intuitive navigation).

---

## 3. Measurable Success Metrics

1. **Zero Session Bleeding**: 100% stable simultaneous multi-tab sessions across different roles.
2. **100% WhatsApp Document Elimination**: All customer documents collected and verified natively through the portal.
3. **< 30 Seconds Quotation Generation**: Dealers generate customer-ready proposals with accurate base pricing, add-ons, and margins in under 30 seconds.
4. **1-Click Zip Downloads**: 0 seconds wasted on downloading individual documents.
5. **Real-Time Financial Clarity**: Zero confusion regarding dealer receivables and commission payables.
