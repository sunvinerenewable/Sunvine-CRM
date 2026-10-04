# Sunvine Renewable Energy — Master Agent Directives

Every AI assistant, subagent, and engineer working on this repository MUST strictly follow these two primary operational protocols alongside `PROJECT_RULEBOOK.md`:

---

## 1. PONYTAIL PROTOCOL (DietrichGebert/ponytail)
> *"The best code is the code you never wrote."*

Before writing any new code, stop at the first rung of the **Decision Ladder**:
1. **Does this need to exist?** → Skip if not strictly necessary (YAGNI).
2. **Already in this codebase?** → Reuse existing hooks, contexts, utilities, and components.
3. **Stdlib does it?** → Use standard JavaScript/HTML5.
4. **Native platform feature?** → Use browser native tags (`<input type="date">`, `<a>` with `tel:`, etc.).
5. **Installed dependency?** → Use existing packages in `package.json`. Do not install new packages without explicit user request.
6. **Can it be one line?** → Keep it one line.
7. **Only then**: Write the minimum code that works.

**Rule**: Never write 100 lines where 15 lines solve the task. Keep diffs focused, minimal, and surgical.

---

## 2. UI/UX PRO MAX PROTOCOL (nextlevelbuilder/ui-ux-pro-max-skill)
> *"Enterprise aesthetics, zero horizontal overflow, flawless accessibility."*

1. **Brand Continuity**:
   - Maintain the Sunvine dark enterprise theme (`#0D1527` card background, `#070D18` canvas).
   - Energy gradient: `from-emerald-600 to-teal-500`.
   - Fonts: `Inter` (body), `Space Grotesk` (headings), `Roboto Mono` (kW, numbers, coordinates).
2. **Component Rules**:
   - `cursor-pointer` on every interactive button, chip, tab, and clickable row.
   - Touch targets >= 44×44px for rooftop/field technicians.
   - Text contrast >= 4.5:1.
   - All flex children with text must have `min-w-0` to support clean `truncate`.
   - Responsive across all viewports (360px to 1920px) with zero horizontal root overflow.
   - Use Google `material-symbols-outlined` for icons.

---

## 3. ZERO SECRETS IN CODE
- Never commit API keys, tokens, or passwords to Git.
- Use `.env` (gitignored) and `localStorage`.
- In mock test data, use `accessCode: 'dealer123'` or `authPin: '1234'`, NEVER `email:` followed by `password:` (triggers GitGuardian / GitHub Secret Scanning).
- Mandatory: Run `npm run build` with 0 errors before committing.

---

## 4. BRANCH & DEPLOYMENT PROTOCOL
- All changes, commits, and pushes MUST be made to the `sumit-updates` branch on GitHub / Vercel.
- NEVER push directly to the `main` branch.
- Deploying to production (`main`) requires explicit confirmation from the user. Never auto-push to `main`.

---

## 5. DIRECT DATABASE PERSISTENCE PROTOCOL (Single Source of Truth)
- **Zero Cache-Only / Zero LocalStorage-Only Data**: Any data created, added, modified, or deleted in this project MUST be saved directly to the database (Supabase / PostgreSQL) via backend APIs or database services.
- **Direct Database Fetch on Mount & Hard Refresh**: The app MUST fetch active data directly from the database upon mount and hard refresh (`Ctrl + Shift + R`). Data must NEVER disappear or revert on hard refresh.
- **Mandatory Enforcement**: On EVERY prompt and feature update, the assistant MUST strictly uphold this database-first rule.

