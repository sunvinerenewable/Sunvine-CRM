# Antigravity & Gemini Project Directives

Refer to `AGENTS.md` and `PROJECT_RULEBOOK.md` for full standards.

Permanent Core Protocols:
1. **Ponytail Protocol (DietrichGebert/ponytail)**: Decision ladder (YAGNI -> reuse -> stdlib -> native -> minimum code). Prevent bloated code and unnecessary packages.
2. **UI/UX Pro Max Protocol (nextlevelbuilder/ui-ux-pro-max-skill)**: 192 reasoning rules, contrast >=4.5:1, touch targets >=44px, cursor-pointer, zero horizontal overflow, preserve brand colors (emerald/teal, #0D1527, #070D18) and typography.
3. **Security Standards**: Zero secrets in Git. Never use password: near email in mock data (use accessCode).
4. **Non-Blocking Workflows**: Document uploads are strictly optional.
5. **Quality Gate**: Always verify `npm run build` passes with 0 errors before committing.
6. **Branch Protection & Deployment Policy**: All commits and pushes must go to the `sumit-updates` branch. NEVER push directly to `main` branch or production without explicit confirmation from the user.
7. **Direct Database Single Source of Truth**: All data added or updated MUST be saved directly to the database and fetched directly from the database upon mount / hard refresh. Never store data exclusively in client cache or localStorage, and ensure zero data loss on hard refresh. Must be upheld on every prompt without exception.

