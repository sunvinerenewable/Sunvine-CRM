# Sunvine Renewable Energy — UI/UX Pro Max Design System

## 1. Visual Language & Identity

Sunvine's design system adheres strictly to Directive Rule 6:
- **Canvas / Root Background**: `#070D18` (deep cosmic navy)
- **Card / Surface Background**: `#0D1527` (elevated dark slate)
- **Border / Divider**: `slate-800/80` or `emerald-500/20`
- **Primary Energy Gradient**: `from-emerald-600 to-teal-500` (hover: `from-emerald-500 to-teal-400`)
- **Typography**:
  - Headings & Titles: `Space Grotesk`
  - Body & UI Controls: `Inter`
  - Financial figures, Capacities & Serial Codes: `Roboto Mono`
- **Iconography**: Google `material-symbols-outlined`

---

## 2. Core Ergonomic & Accessibility Rules

1. **Touch Targets**: Minimum interactive dimensions of 44 × 44px (`min-h-[44px]`).
2. **Interactive States**: Mandatory `cursor-pointer` on every clickable or interactive element.
3. **WCAG Contrast**: Minimum text contrast ratio of 4.5:1 against the dark background.
4. **Responsive Layouts**: No horizontal page overflows. Use `min-w-0` on flex items with truncated text.
5. **Non-Blocking Workflows (Rule 7)**: Document uploads are strictly optional. Staff can create and progress records with 0 attachments.

---

## 3. Reusable UI Components (`src/components/ui/`)

### `Button`
```jsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md" icon="solar_power" onClick={handleSave}>
  Generate Quotation
</Button>
```
**Variants**:
- `primary`: Emerald-to-teal energy gradient with subtle glow
- `secondary`: Deep slate surface with subtle border
- `outline`: Emerald border with transparent background
- `ghost`: Transparent hover effect
- `danger`: Red-to-rose gradient for destructive actions

### `Input`
```jsx
import { Input } from '@/components/ui';

<Input
  label="Customer Phone"
  required
  icon="call"
  value={phone}
  onChange={e => setPhone(e.target.value)}
  error={phoneError}
  helperText="10-digit mobile number for WhatsApp proposal"
/>
```

### `Select`
```jsx
import { Select } from '@/components/ui';

<Select
  label="DISCOM"
  value={discom}
  onChange={e => setDiscom(e.target.value)}
  options={[
    { value: 'UGVCL', label: 'UGVCL (Uttar Gujarat)' },
    { value: 'DGVCL', label: 'DGVCL (Dakshin Gujarat)' },
    { value: 'MGVCL', label: 'MGVCL (Madhya Gujarat)' },
    { value: 'PGVCL', label: 'PGVCL (Paschim Gujarat)' }
  ]}
/>
```

### `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`
```jsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

<Card>
  <CardHeader>
    <CardTitle>System Sizing</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Sizing content */}
  </CardContent>
</Card>
```

### `Modal`
```jsx
import { Modal } from '@/components/ui';

<Modal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="Customer File Details"
  subtitle="File ID: SUN-2026-0042"
  footer={<Button onClick={handleClose}>Done</Button>}
>
  <p>Modal body content...</p>
</Modal>
```

### `Badge`
```jsx
import { Badge } from '@/components/ui';

<Badge variant="emerald" icon="check_circle">Approved</Badge>
<Badge variant="amber" icon="pending">Under Verification</Badge>
<Badge variant="rose" icon="cancel">Rejected</Badge>
```

### `EmptyState` & `ErrorState`
```jsx
import { EmptyState, ErrorState } from '@/components/ui';

// When list has 0 items:
<EmptyState
  icon="inventory_2"
  title="No Quotations Found"
  description="You haven't generated any customer proposals yet."
  actionLabel="Create Quotation"
  onAction={handleCreate}
/>

// When network fetch fails:
<ErrorState
  title="Unable to load customer files"
  error={loadError}
  onRetry={fetchFiles}
/>
```
