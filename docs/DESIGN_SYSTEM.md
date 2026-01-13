# Elegant Design System

## Typography

### Font Families
- **Serif (Headings)**: Playfair Display - Used for elegant headings and titles
- **Sans-serif (Body)**: Inter - Used for body text and UI elements
- **Mono (Code)**: JetBrains Mono - Used for code and technical content

### Type Scale
- **H1**: 2.5rem (40px) - Page titles, major headings
- **H2**: 2rem (32px) - Section headings
- **H3**: 1.5rem (24px) - Subsection headings
- **Body**: 1rem (16px) - Default body text
- **Small**: 0.875rem (14px) - Secondary text, captions
- **Tiny**: 0.75rem (12px) - Labels, badges

### Font Weights
- **Regular**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700

## Color Palette

### Primary Colors
- **Elegant Green**: `oklch(0.45 0.15 160)` - Primary actions, success states
- **Elegant Green Dark**: `oklch(0.35 0.15 160)` - Hover states for green buttons
- **Elegant Red**: `oklch(0.55 0.25 25)` - Alerts, warnings, errors

### Neutral Grays
- **Gray 50**: `oklch(0.98 0.002 285)` - Lightest background
- **Gray 100**: `oklch(0.95 0.003 285)` - Light backgrounds
- **Gray 200**: `oklch(0.90 0.004 285)` - Borders, dividers
- **Gray 800**: `oklch(0.25 0.006 285)` - Dark text on light
- **Gray 900**: `oklch(0.15 0.005 285)` - Darkest text

## Spacing

### Base Unit
- Base spacing unit: 4px (0.25rem)

### Scale
- **xs**: 0.25rem (4px)
- **sm**: 0.5rem (8px)
- **md**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)
- **2xl**: 3rem (48px)
- **3xl**: 4rem (64px)

## Components

### Buttons
- **Primary**: Elegant green background, white text
- **Secondary**: Gray background, dark text
- **Outline**: Transparent with border
- **Destructive**: Red background for dangerous actions

### Cards
- White background
- Subtle border (gray-200)
- Light shadow for depth
- Rounded corners (0.625rem default)

### Badges/Tags
- Pill-shaped (full border-radius)
- Small padding (0.25rem 0.75rem)
- Font size: 0.75rem
- Medium font weight (500)

## Usage Examples

### Headings
```tsx
<h1 className="font-serif text-4xl font-bold">Page Title</h1>
<h2 className="font-serif text-3xl font-semibold">Section Title</h2>
```

### Buttons
```tsx
<button className="btn-elegant-primary px-6 py-2 rounded-lg">
  Primary Action
</button>
```

### Badges
```tsx
<span className="badge-elegant badge-elegant-green">Status</span>
```

