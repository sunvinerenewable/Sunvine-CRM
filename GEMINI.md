# Antigravity & Gemini Project Directives

Refer to `AGENTS.md` and `PROJECT_RULEBOOK.md` for full standards.

Permanent Core Protocols:
1. **Ponytail Protocol (DietrichGebert/ponytail)**: Decision ladder (YAGNI -> reuse -> stdlib -> native -> minimum code). Prevent bloated code and unnecessary packages.
2. **UI/UX Pro Max Protocol (nextlevelbuilder/ui-ux-pro-max-skill)**: 192 reasoning rules, contrast >=4.5:1, touch targets >=44px, cursor-pointer, zero horizontal overflow, preserve brand colors (emerald/teal, #0D1527, #070D18) and typography.
3. **Security Standards**: Zero secrets in Git. Never use password: near email in mock data (use accessCode).
4. **Non-Blocking Workflows**: Document uploads are strictly optional.
5. **Quality Gate**: Always verify `npm run build` passes with 0 errors before committing.
