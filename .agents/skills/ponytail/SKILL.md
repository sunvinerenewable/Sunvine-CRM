---
name: ponytail
description: Enforces the Lazy Senior Developer protocol (DietrichGebert/ponytail). Prevents AI agents from writing bloated, unnecessary, or over-engineered code, rejects unnecessary third-party packages, and mandates the Decision Ladder (YAGNI -> reuse existing -> stdlib -> native feature -> minimum code that works).
---

# Ponytail — The Lazy Senior Developer Protocol

> *"He says nothing. He writes one line. It works."*  
> Inspired by [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail).  
> **Core Principle**: The best code is the code you never wrote.

---

## 1. The Decision Ladder (Mandatory Pre-Execution Check)

Before writing any new code, components, or functions, the agent MUST stop at the **very first rung** that solves the requirement:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Does this need to exist?   → NO: Skip it (YAGNI).            │
│ 2. Already in this codebase?  → Reuse it, don't rewrite it.     │
│ 3. Stdlib does it?            → Use JavaScript/Node standard.   │
│ 4. Native platform feature?   → Use browser HTML5/CSS feature.  │
│ 5. Installed dependency?      → Use package already in json.    │
│ 6. Can it be one line?        → Keep it one line.               │
│ 7. Only then:                 → Write the minimum that works.   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Operational Commandments

### 2.1 Kill Over-Engineering at the Source
- **No Unnecessary Packages**: Never install npm packages for things browsers or standard JavaScript can do natively.
  - *Example*: Don't install a date-picker library when `<input type="date">` works.
  - *Example*: Don't install lodash for `.filter()`, `.map()`, or `.find()`.
  - *Example*: Don't install heavy animation frameworks when Tailwind transition classes suffice.
- **No Wrapper Bloat**: Do not create 5-layer abstraction wrappers when direct calls are clearer and faster.
- **No Premature Generalization**: Build for the immediate concrete requirement. Do not write dynamic metaprogramming for features that are not requested.

### 2.2 Lazy About Solutions, Deep About Understanding
- Read the existing code thoroughly *before* touching it.
- Trace the actual execution flow.
- Reuse existing hooks (`useHighAccuracyLocation`, `useApp`, `useToast`), contexts, and services instead of inventing duplicates.

### 2.3 Lazy, NEVER Negligent
Being "lazy" means cutting cruft, NOT cutting quality. The following are NEVER on the chopping block:
- **Security & Secret Protection**: Zero credentials in Git, clean environment isolation.
- **Error Handling & Resilience**: Always handle network failure, offline states, and empty API results.
- **Accessibility & Touch Targets**: Interactive buttons must be >= 44×44px, legible under sunlight.
- **Validation**: Strict schema checks on data inputs.

---

## 3. Practical Sunvine Project Examples

| Problem | Over-Engineered Trap | Ponytail Solution |
|---|---|---|
| Date input | Installing `flatpickr` or `react-datepicker` | Native `<input type="date" className="bg-surface ..." />` |
| Calculating Distance | External geolib npm dependency | Existing clean `calculateHaversineDistanceMeters()` utility |
| Distance Sorting | Heavy array sorting library | Standard `array.sort((a, b) => a.distanceMeters - b.distanceMeters)` |
| Modal Transitions | Heavy framer-motion library | Native Tailwind `transition-all animate-in fade-in` |
| Phone Calling | WebRTC dialing library | Native `<a href="tel:...">Call</a>` |
| Navigation Link | Custom Maps SDK wrapper | Native `<a href="https://maps.google.com/..." target="_blank">Navigate</a>` |

---

## 4. Pre-Diff Checklist

Before presenting or committing any code diff, ask:
1. *Did I write more than 50 lines where 10 lines would do?*
2. *Did I add an extra component file that could just be an inline element?*
3. *Did I reuse existing helpers in `src/utils` and `src/services`?*
4. *Is every line necessary for the user's explicit goal?*

If the answer to #1 is yes, refactor it down to the minimal working code before saving.
