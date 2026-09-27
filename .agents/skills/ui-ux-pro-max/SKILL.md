---
name: ui-ux-pro-max
description: Professional UI/UX design intelligence skill (nextlevelbuilder/ui-ux-pro-max-skill) with 192 reasoning rules, 79 searchable UI styles, WCAG accessibility standards (contrast 4.5:1, touch targets >=44px), Tailwind design tokens, and anti-pattern prevention for enterprise solar and SaaS platforms.
---

# UI UX Pro Max — Design Intelligence & Architecture

> Inspired by [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).  
> **Mission**: Build production-grade, highly intuitive, accessible, and aesthetically cohesive enterprise interfaces.

---

## 1. Core Visual Principles for Enterprise Solar & SaaS

### 1.1 The Visual Hierarchy Ladder
1. **Primary Focal Point**: Highest visual weight (Live GPS telemetry, Primary CTA buttons, key statistics like Total Files / kW Pipeline).
2. **Secondary Support**: Cards, data tables, grouped key-value pairs, action icons.
3. **Tertiary Subtext**: Explanatory tooltips, timestamps, metadata, badges.

### 1.2 Sunvine Brand Design Tokens
- **Base Canvas**: Deep space dark mode (`#070D18`) with card containers in `#0D1527`.
- **Primary Energy Gradient**: `bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400`.
- **Borders & Dividers**: `border-white/10` or `border-surface-container-high`.
- **Typography Scale**:
  - Headings: `font-extrabold tracking-tight text-white`
  - Body: `text-xs sm:text-sm text-slate-300`
  - Technical / Numeric: `font-mono text-emerald-300 font-bold` (kW, currency, coordinates)

---

## 2. Universal Pre-Delivery Checklist (Mandatory for Every UI Component)

Before delivering any UI component or view, verify all 8 rules:

- [ ] **1. Cursor Pointer**: Every interactive button, chip, tab, and clickable row MUST have `cursor-pointer`.
- [ ] **2. Contrast Ratio >= 4.5:1**: Text must remain crisply legible against dark and light backgrounds. Avoid washed-out low-contrast grays on dark surfaces.
- [ ] **3. Touch Ergonomics**: Minimum touch targets of **44×44px** on mobile and tablets (`p-2.5`, `py-2 px-3`). Technicians on rooftops need easy tapping.
- [ ] **4. Layout Containment (`min-w-0`)**: Flex children with text or badges must have `min-w-0` to allow clean truncation (`truncate`) without blowing out the parent container.
- [ ] **5. Responsive Viewport Adaptability**: Flawless rendering from **360px** (compact mobile) to **1920px** (desktop monitors) without root horizontal scroll.
- [ ] **6. No Emoji Icons**: Never use raw emojis (e.g. 📞, 📍) as primary button icons. Always use Google `material-symbols-outlined` with crisp vectors (`call`, `location_on`, `directions`).
- [ ] **7. State Feedback**: Every button must have active hover, focus-visible, and disabled states (`disabled:opacity-50 disabled:cursor-not-allowed`).
- [ ] **8. Non-Disruptive Micro-Transitions**: Use subtle Tailwind transitions (`transition-all duration-150 active:scale-[0.99]`). Avoid harsh or jarring animations.

---

## 3. Anti-Patterns to Strictly AVOID

❌ **Avoid**: Overly bright neon colors that cause eye fatigue in dark mode.  
❌ **Avoid**: Truncating critical data without a tooltip or hover preview.  
❌ **Avoid**: Uncontained modals that overflow mobile viewports without internal `overflow-y-auto`.  
❌ **Avoid**: Designing a new portal (e.g. Staff Portal) with a completely different theme or layout that clashes with the Dealer Portal.  
❌ **Avoid**: Forcing users into multi-step dialogs when a direct one-click inline action exists.

---

## 4. UI Patterns for Common Scenarios

### Pattern A: Lead Discovery Cards & Proximity Tables
- Clean tabular rows with alternating hover highlights (`hover:bg-white/5`).
- Visual rank badges (`#1`, `#2`, `#3`) with proximity badges:
  - `< 500m`: `bg-emerald-600 text-white font-extrabold` + "Right Next to You 📍"
  - `< 2000m`: `bg-emerald-500/20 text-emerald-300`
  - `> 2000m`: `bg-white/5 text-slate-300`
- Compact ground actions: Call, Navigate, WhatsApp, Add to Leads.

### Pattern B: Statistics & Metrics Bento Grid
- Grid layout: `grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4`.
- Large bold numeral with small uppercase label and icon indicator.
