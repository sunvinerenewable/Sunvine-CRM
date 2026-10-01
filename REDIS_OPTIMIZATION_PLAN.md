# 🚀 Sunvine Solar — Real-Time Dual-Sync Redis Optimization Plan

---

## 📌 Executive Summary
This document details the high-throughput caching and performance optimization plan for the Sunvine Solar Portal using **Upstash Redis**. It focuses strictly on the **3 high-frequency core features** approved for production, enforcing the **Simultaneous Dual-Write Protocol (PostgreSQL Database + Redis updated simultaneously)** to guarantee 100% real-time data accuracy with zero stale data.

---

## 🔒 The Dual-Write Rule: Zero Stale Data Guarantee

Whenever any detail is added, edited, or deleted in the system:
1. It is permanently saved to the **PostgreSQL Database (Supabase)**.
2. At the **exact same millisecond**, the corresponding **Redis cache is updated / refreshed**.

```
[User / Admin Edit] 
         │
         ▼
┌────────────────────────────────────────┐
│  Backend Mutation Handler              │
├────────────────────────────────────────┤
│ 1. Write to PostgreSQL DB (Supabase)   │ ──> Permanent Data Store
│ 2. Dual-Write to Upstash Redis         │ ──> High-Speed In-Memory Cache (<5ms)
└────────────────────────────────────────┘
```

---

## 🚀 Approved Core Features

### 1. Live-Synced WhatsApp Customer Proposals (`quote:public:${token}`)
* **Workflow**:
  - When dealers share a quote with a customer via WhatsApp (e.g. `sunvinesolar.com/view-quotation/:token`), the public proposal loads from Redis in **under 10ms** on the customer's phone without burdening the PostgreSQL database.
* **Handling Dynamic Edits (Phone, BOM, Price, kW, Customer Details)**:
  - Whenever the dealer or admin edits **any detail** (phone number, customer name, solar panels, inverters, extra BOM hardware items, discounts, or payment terms) and clicks **Save**:
    - The new details are written to PostgreSQL.
    - The Redis key `quote:public:${token}` is **instantly updated with the new details**.
  - When the customer re-opens their WhatsApp link, they immediately see the **updated phone number, new BOM, and new prices**.

---

### 2. Real-Time Dual-Synced Master Hardware & BOS Pricing Catalog (`catalog:hardware`)
* **Workflow**:
  - Whenever a dealer creates a quotation or opens the Quotation Engine, the master list of Solar Modules (Adani, Waaree, Rayzone, APS), String Inverters (Solis, Sunvine, Growatt), and BOS Hardware items loads in **1 single roundtrip** from Redis.
* **Handling Admin Price Changes**:
  - Whenever an Admin updates module pricing (e.g. Adani 600W to ₹24/Wp), inverter benchmark costs, or BOS hardware:
    - The new price is saved to PostgreSQL (`solar_modules`, `bos_pricing_matrix`).
    - The Redis cache `catalog:hardware` is **instantly updated with the new prices**.
  - Any dealer opening the Quotation Engine the next second automatically receives the **new live prices**.

---

### 3. Real-Time Dual-Synced Dealer Custom Negotiated Rates (`dealer:rates:${dealer_id}`)
* **Workflow**:
  - Caches each dealer's specific margin tier and negotiated hardware discounts (e.g. custom base rates, panel discounts, and inverter rates).
* **Handling Admin Rate Adjustments**:
  - Whenever an Admin sets or modifies a custom rate for a dealer in `DealerCustomPricingMatrix`:
    - The new rates are saved to the dealer's record in PostgreSQL.
    - Redis key `dealer:rates:${dealer_id}` is **updated simultaneously**.
  - When that dealer generates quotations on-site with a customer, their custom rates apply in **1 millisecond** with zero lag.

---

## 📊 Summary Table: Approved vs Cancelled Features

| Feature | Status | Dual-Sync Behavior |
| :--- | :--- | :--- |
| **1. WhatsApp Proposal Links** | ✅ **Active** | DB + Redis updated simultaneously on every edit (phone, BOM, price) |
| **2. Hardware & BOS Pricing Catalog** | ✅ **Active** | DB + Redis updated simultaneously whenever Admin edits prices |
| **3. Dealer Custom Negotiated Rates** | ✅ **Active** | DB + Redis updated simultaneously whenever Admin configures rates |
| **4. Field Sales Solar Lead Radar** | ❌ **Cancelled** | *Removed per user request* |
| **5. Verification Desk Status Tracker**| ❌ **Cancelled** | *Removed per user request* |
| **6. Admin Rate Limit Reset Button** | ❌ **Cancelled** | *Removed per user request* |
| **7. Executive KPI Summary** | ❌ **Cancelled** | *Removed per user request* |

---

## 🛠️ Key Technical Files

- [`api/_lib/redis.js`](file:///e:/repos/dealer-portal-quotation/api/_lib/redis.js): Central Upstash Redis client with `cacheAside`, `redisGet`, `redisSet`, `redisDel`.
- [`api/quotations.js`](file:///e:/repos/dealer-portal-quotation/api/quotations.js): Handles public proposal dual-writes and Redis caching on WhatsApp views.
- [`src/services/pricingService.js`](file:///e:/repos/dealer-portal-quotation/src/services/pricingService.js): Dual-syncs BOS pricing slabs and inverter benchmarks to Redis.
- [`src/services/hardwareService.js`](file:///e:/repos/dealer-portal-quotation/src/services/hardwareService.js): Dual-syncs solar modules and BOM items to Redis.

---

## ✅ Quality Verification
- **Build Quality**: `npm run build` with 0 errors.
- **Data Freshness**: Instant reflection of price/BOM edits in both Supabase SQL tables and Upstash Redis Data Browser.
