# Design System Component Guide

Comprehensive documentation for all design system components.

## Design Tokens

### Spacing

Strict 8px base unit scale for consistent spacing.

```typescript
import { spacing } from '@/design-system/tokens';

// Available tokens: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32
// Values: 0, 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px, 80px, 96px, 128px
```

### Typography

Professional type system with three font families.

```typescript
import { fontFamily, fontSize, fontWeight, lineHeight } from '@/design-system/tokens';

// Font families: display (Syne), body (Plus Jakarta Sans), mono (JetBrains Mono)
// Font sizes: xs (12px) to 5xl (48px)
// Font weights: normal (400), medium (500), semibold (600), bold (700)
```

### Colors

WCAG AA compliant color palette.

```typescript
import { colors } from '@/design-system/tokens';

// Brand: colors.brand[50-900]
// Neutral: colors.neutral[50-900]
// Semantic: colors.success, colors.warning, colors.danger, colors.info
```

### Elevation

Subtle shadow layers for depth hierarchy.

```typescript
import { elevation, elevationDark } from '@/design-system/tokens';

// Levels: none, sm, base, md, lg, xl
```

### Glassmorphism

Elegant glass effect for elevated surfaces.

```typescript
import { glass, glassDark } from '@/design-system/tokens';

// Levels: subtle, base, elevated
// Properties: background, backdropFilter, border
```

### Motion

Subtle, professional animations.

```typescript
import { duration, easing, transition } from '@/design-system/tokens';

// Duration: instant (100ms), fast (200ms), base (300ms), slow (500ms)
// Easing: linear, easeIn, easeOut, easeInOut
// Transitions: base, fast, colors, transform, opacity
```

---

## Atomic Components

### Button

Professional button component with variants and states.

**Variants:** primary, secondary, ghost, danger
**Sizes:** sm, md, lg
**States:** default, hover, active, disabled, loading

```tsx
import { Button } from '@/design-system/components';

// Primary button
<Button variant="primary" size="md" onClick={handleClick}>
  Submit
</Button>

// Loading state
<Button variant="primary" isLoading>
  Processing...
</Button>

// Full width
<Button variant="secondary" fullWidth>
  Sign In
</Button>

// Disabled
<Button variant="danger" disabled>
  Delete
</Button>
```

**Accessibility:**
- Proper ARIA attributes
- Focus visible ring
- Disabled state prevents interaction
- Loading state shows spinner and descriptive text

---

### Input

Text input with label, error, and helper text.

```tsx
import { Input } from '@/design-system/components';

// Basic input
<Input
  label="Email Address"
  type="email"
  placeholder="you@example.com"
  required
/>

// With error
<Input
  label="Password"
  type="password"
  error="Password must be at least 8 characters"
/>

// With helper text
<Input
  label="Username"
  helperText="Choose a unique username"
  fullWidth
/>

// Controlled
const [value, setValue] = useState('');
<Input
  label="Name"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

**Accessibility:**
- Proper label association via htmlFor/id
- Error messages announced to screen readers (role="alert")
- Helper text linked via aria-describedby
- Required indicator shown visually and programmatically

---

### Select

Dropdown select with options.

```tsx
import { Select } from '@/design-system/components';

const roleOptions = [
  { value: 'admin', label: 'Administrator' },
  { value: 'parent', label: 'Parent' },
  { value: 'medical', label: 'Medical Staff' },
];

<Select
  label="Role"
  options={roleOptions}
  placeholder="Select a role"
  required
/>

// With error
<Select
  label="Camp Session"
  options={sessionOptions}
  error="Please select a session"
/>

// Controlled
const [role, setRole] = useState('');
<Select
  label="User Role"
  options={roleOptions}
  value={role}
  onChange={(e) => setRole(e.target.value)}
/>
```

**Accessibility:**
- Custom chevron icon (native select underneath)
- Proper label association
- Error and helper text support
- Keyboard navigation supported

---

### Checkbox

Checkbox with label and optional error/helper text.

```tsx
import { Checkbox } from '@/design-system/components';

// Basic checkbox
<Checkbox label="I agree to the terms and conditions" required />

// With error
<Checkbox
  label="Confirm submission"
  error="You must confirm before submitting"
/>

// With helper text
<Checkbox
  label="Enable notifications"
  helperText="Receive email updates about your application"
/>

// Controlled
const [agreed, setAgreed] = useState(false);
<Checkbox
  label="I accept"
  checked={agreed}
  onChange={(e) => setAgreed(e.target.checked)}
/>
```

**Accessibility:**
- Proper label association
- Click label to toggle
- Focus ring on keyboard navigation
- Error messages announced

---

## Layout Primitives

### Container

Responsive container with max-width constraints.

**Sizes:** sm (672px), md (896px), lg (1152px), xl (1280px), full

```tsx
import { Container } from '@/design-system/components';

// Default (lg, centered)
<Container>
  <h1>Page Title</h1>
</Container>

// Custom size
<Container size="md">
  <form>...</form>
</Container>

// Full width, not centered
<Container size="full" center={false}>
  <div>Full width content</div>
</Container>
```

---

### Grid

Responsive grid layout with configurable columns and gap.

**Columns:** 1, 2, 3, 4, 6, 12
**Gap:** 2 (8px), 4 (16px), 6 (24px), 8 (32px)
**Responsive:** Automatically adjusts on mobile/tablet/desktop

```tsx
import { Grid } from '@/design-system/components';

// 3-column responsive grid
<Grid cols={3} gap={6}>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</Grid>

// Fixed columns (no responsive)
<Grid cols={4} gap={4} responsive={false}>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
  <div>Item 4</div>
</Grid>

// 12-column grid for complex layouts
<Grid cols={12} gap={6}>
  <div className="col-span-8">Main content</div>
  <div className="col-span-4">Sidebar</div>
</Grid>
```

---

### Stack

Flexbox-based stack for vertical or horizontal layouts.

**Direction:** horizontal, vertical
**Align:** start, center, end, stretch
**Justify:** start, center, end, between, around
**Gap:** 1 (4px), 2 (8px), 3 (12px), 4 (16px), 6 (24px), 8 (32px)

```tsx
import { Stack } from '@/design-system/components';

// Vertical stack (default)
<Stack direction="vertical" gap={4}>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</Stack>

// Horizontal stack with center alignment
<Stack direction="horizontal" align="center" gap={2}>
  <span>Label:</span>
  <strong>Value</strong>
</Stack>

// Space between items
<Stack direction="horizontal" justify="between" align="center">
  <h2>Title</h2>
  <Button>Action</Button>
</Stack>

// Wrap items
<Stack direction="horizontal" gap={2} wrap>
  <Button>Tag 1</Button>
  <Button>Tag 2</Button>
  <Button>Tag 3</Button>
</Stack>
```

---

## Layout Components

### AppShell

Application shell with header, optional sidebar, and main content area.

```tsx
import { AppShell, Header } from '@/design-system/layout';

<AppShell
  header={
    <Header
      logo={<img src="/logo.svg" alt="Camp Burnt Gin" />}
      navigation={<MainNavigation />}
      actions={<UserMenu />}
    />
  }
  sidebar={<Sidebar />}
>
  {/* Main content */}
  <div>Page content goes here</div>
</AppShell>
```

**Structure:**
- **Header:** Sticky at top, 64px height, backdrop blur
- **Sidebar:** Sticky, 256px width, hidden on mobile, scrollable
- **Main:** Flexible width, responsive padding

---

### Header

Sticky header with logo, navigation, and actions.

```tsx
import { Header } from '@/design-system/layout';

<Header
  logo={
    <a href="/">
      <img src="/logo.svg" alt="Camp Burnt Gin" className="h-8" />
    </a>
  }
  navigation={
    <ul className="flex gap-6">
      <li><a href="/dashboard">Dashboard</a></li>
      <li><a href="/campers">Campers</a></li>
      <li><a href="/applications">Applications</a></li>
    </ul>
  }
  actions={
    <>
      <NotificationBell />
      <UserMenu />
    </>
  }
/>
```

---

### Sidebar

Collapsible sidebar with sections and links.

```tsx
import { Sidebar, SidebarSection, SidebarLink } from '@/design-system/layout';
import { HomeIcon, UsersIcon, FileTextIcon } from 'lucide-react';

<Sidebar>
  <SidebarSection title="Main">
    <SidebarLink href="/dashboard" icon={<HomeIcon />} isActive>
      Dashboard
    </SidebarLink>
    <SidebarLink href="/campers" icon={<UsersIcon />}>
      Campers
    </SidebarLink>
  </SidebarSection>

  <SidebarSection title="Applications">
    <SidebarLink href="/applications" icon={<FileTextIcon />}>
      All Applications
    </SidebarLink>
  </SidebarSection>
</Sidebar>
```

---

## Utilities

### cn (Class Name Merger)

Utility for merging Tailwind CSS classes with conflict resolution.

```typescript
import { cn } from '@/utils/cn';

// Merge classes
const buttonClass = cn('px-4 py-2', 'bg-blue-500', 'text-white');

// Conditional classes
const buttonClass = cn(
  'px-4 py-2',
  isActive && 'bg-blue-500',
  isDisabled && 'opacity-50'
);

// Override conflicting classes (tailwind-merge)
const buttonClass = cn('px-4', 'px-6'); // Result: 'px-6'
```

### debounce

Delays function execution until after wait time has elapsed.

```typescript
import { debounce } from '@/utils/debounce';

// Basic debounce (300ms default)
const debouncedSearch = debounce((query: string) => {
  fetchSearchResults(query);
});

// Custom delay
const debouncedSave = debounce((data: FormData) => {
  saveToServer(data);
}, 500);

// Cancel pending execution
debouncedSearch.cancel();

// Execute immediately
debouncedSearch.flush();
```

### requestDeduplication

Prevents duplicate identical requests from being sent simultaneously.

```typescript
import { deduplicateRequest } from '@/utils/requestDeduplication';

// Deduplicate API calls
const fetchUser = async (userId: string) => {
  return deduplicateRequest(
    `/api/users/${userId}`,
    'GET',
    () => axiosInstance.get(`/users/${userId}`)
  );
};

// Multiple calls to fetchUser('123') will only trigger one request
// Subsequent calls receive the same promise

// Clear all pending requests (e.g., on logout)
clearPendingRequests();
```

---

## Theme Support

All components support light, dark, and system theme modes via Tailwind's dark mode class strategy.

**Setup:**
```typescript
// tailwind.config.ts
darkMode: 'class'
```

**Usage:**
```typescript
// Toggle theme
document.documentElement.classList.add('dark');
document.documentElement.classList.remove('dark');
```

All components automatically adapt to dark mode when the `dark` class is applied to the root element.

---

## Accessibility Standards

All components meet WCAG AA standards:

- Color contrast ratios meet 4.5:1 minimum
- Keyboard navigation fully supported
- Focus indicators clearly visible
- ARIA attributes properly implemented
- Form fields have associated labels
- Error messages announced to screen readers
- Semantic HTML structure

---

## Design Principles

1. **Formal and Professional:** No decorative gimmicks or excessive effects
2. **Clean and Spacious:** Strict spacing scale prevents cramped layouts
3. **Minimal Motion:** Subtle, purposeful animations only
4. **Elegant Glassmorphism:** Controlled opacity and blur, not excessive
5. **Accessible by Default:** WCAG AA compliance built-in
6. **Type-Safe:** Full TypeScript support with proper types
7. **Consistent Patterns:** Shared API across all components
