# Antigravity & Gemini Project Directives

Refer to `AGENTS.md` and `PROJECT_RULEBOOK.md` for full standards.

Permanent Core Protocols (In Strict Priority Order):
1. **Rule 1: Direct Database First & Schema Integrity**: Sole single source of truth. Zero cache-only/localStorage-only data. All data persists to Supabase/PostgreSQL. Live DB fetch on mount & hard refresh. Analyze DB schema first before new features; verify data genuinely saves (no fake/read-only saves).
2. **Rule 2: Adversarial Backend Security & Zero Secrets**: Mandatory password hashing (bcrypt/crypto). Never store plaintext passwords. Zero hardcoded secrets/API keys. Think like a hacker: test & protect against SQL injection, IDOR, auth bypass, role escalation, and payload tampering.
3. **Rule 3: Cross-Touchpoint Fullstack Consistency**: If a field/rule changes (e.g. mandatory field, remove field), update ALL forms, modals, tabs, and APIs across the entire project. Never leave sibling tabs inconsistent.
4. **Rule 4: Senior Fullstack Architecture & Pre-Execution Planning (/plan)**: Always formulate a comprehensive technical plan before coding. Think as a senior fullstack engineer with end-to-end integration.
5. **Rule 5: Zero Hardcoding & Dynamic Entity/Category Extensibility**: Never hardcode prices, categories, or units. Provide dynamic category/unit management automatically for new entities. Future-proof admin controls.
6. **Rule 6: UI/UX Pro Max Protocol & Ultra-Smooth Performance**: Dark theme (`#0D1527`, `#070D18`), emerald/teal gradients, contrast >=4.5:1, touch targets >=44px, cursor-pointer, zero horizontal overflow. Ultra-fast and lag-free UI and backend.
7. **Rule 7: Non-Blocking Workflows**: Document uploads are strictly optional.
8. **Rule 8: Authentic Telemetry & Real-World Geolocation**: Zero synthetic/fake leads or dummy phones. High-accuracy GPS with >35m movement threshold and desktop fallback.
9. **Rule 9: Pragmatic Package Management**: Install required packages cleanly via `npm` when needed (e.g. security/hashing/features).
10. **Rule 10: Branch Protection & 0-Error Build Quality Gate**: All commits/pushes go to `sumit-updates` branch. NEVER push directly to `main`. Mandatory `npm run build` with 0 errors before committing.
