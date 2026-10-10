# Sunvine Renewable Energy — Master Agent Directives

Every AI assistant, subagent, and engineer working on this repository MUST strictly follow these Master Directives alongside `PROJECT_RULEBOOK.md`:

---

## 1. DIRECT DATABASE FIRST (Rule 1 — Absolute Top Priority)
- **Zero Cache-Only / Zero LocalStorage-Only Data**: Any data created, added, modified, or deleted in this project MUST be saved directly to the database (Supabase / PostgreSQL) via backend APIs or database services.
- **Direct Database Fetch on Mount & Hard Refresh**: The app MUST fetch active data directly from the database upon mount and hard refresh (`Ctrl + Shift + R`). Data must NEVER disappear or revert on hard refresh.
- **Database Schema Analysis First**: Before introducing any new feature, inspect the database schema. If needed, create the proper tables/columns in the database first.
- **Save Verification**: Verify that every saved field actually persists in the database and is never blocked by `readOnly`, missing mappings, or unpersisted inputs.

---

## 2. ADVERSARIAL BACKEND SECURITY & ZERO SECRETS (Rule 2)
- **Mandatory Password Hashing**: Passwords MUST ALWAYS be securely hashed (bcrypt/crypto) before saving to the database. NEVER save plaintext passwords.
- **Zero Hardcoded Secrets**: Never commit API keys, tokens, or passwords to Git. Use `.env` (gitignored). In mock test data, use `accessCode: 'dealer123'` or `authPin: '1234'`, NEVER `email:` followed by `password:`.
- **Hacker Mindset Architecture**: Backend APIs must NEVER be weak. When designing endpoints, actively simulate attacks like a hacker (SQL injection, auth bypass, IDOR, privilege escalation, payload tampering). Patch every flaw and re-test for breach resistance.

---

## 3. CROSS-TOUCHPOINT FULLSTACK CONSISTENCY (Rule 3)
- If a field or entity validation is added, modified, made mandatory, or removed (e.g. dealer address mandatory):
  - Update **ALL** entry points, modals, tabs, and APIs across the entire project (Settings > Account, Dealer Partners tab, Admin Portal, Staff Portal).
  - Never update only a single screen and leave sibling tabs broken or inconsistent.

---

## 4. SENIOR FULLSTACK ARCHITECTURE & PRE-EXECUTION PLANNING (Rule 4)
- Formulate a clear, comprehensive technical plan (`/plan`) before executing changes.
- Never write superficial or reactive code. Ensure end-to-end integration: Database -> Backend -> API -> State -> UI.

---

## 5. ZERO HARDCODING & DYNAMIC EXTENSIBILITY (Rule 5)
- Never hardcode prices, categories, units, or operational options.
- If a feature is implemented that introduces an entity with categories/units/options (e.g. inventory/items), automatically provide dynamic category/unit creation and management options, even if unprompted.
- Provide future-proof admin/settings controls so operational updates require zero code changes.

---

## 6. UI/UX PRO MAX PROTOCOL & ULTRA-SMOOTH PERFORMANCE (Rule 6)
- **Brand Continuity**: Dark console theme (`#0D1527` card background, `#070D18` canvas), energy gradient `from-emerald-600 to-teal-500`, typography (`Inter`, `Space Grotesk`, `Roboto Mono`), Google `material-symbols-outlined`.
- **Component Rules**: `cursor-pointer` on every interactive element, touch targets >= 44×44px, text contrast >= 4.5:1, `min-w-0` on flex children with text, responsive viewports with zero horizontal overflow.
- **Performance**: Ultra-smooth, fast, and fully optimized frontend and backend. Zero lag.

---

## 7. NON-BLOCKING WORKFLOWS (Rule 7)
- Document uploads (Aadhaar, Light Bill, Photos) are strictly optional. Field staff must be able to create and save leads and quotations with 0 documents uploaded.

---

## 8. AUTHENTIC TELEMETRY & GEOLOCATION (Rule 8)
- Zero hallucinated leads, dummy names, or fake phone numbers.
- High-accuracy GPS with >35m movement threshold, race-condition guards, and desktop manual location picker.

---

## 9. PRAGMATIC DEPENDENCY MANAGEMENT (Rule 9)
- Install required packages cleanly via `npm` when genuinely needed for security (e.g. password hashing), core functionality, or libraries. Avoid bloated or unnecessary dependencies.

---

## 10. BRANCH & DEPLOYMENT PROTOCOL (Rule 10)
- All commits and pushes MUST be made to the **`sumit-updates`** branch on GitHub / Vercel.
- **NEVER push directly to the `main` branch**.
- Mandatory: Run **`npm run build`** with **0 errors** before staging and committing.
