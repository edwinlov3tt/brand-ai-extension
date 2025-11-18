# Metronic HTML/Tailwind Usage Guide for Claude Code

This guide provides definitive instructions for implementing Metronic 9 Tailwind components in plain HTML applications.

---

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Dependencies Setup](#dependencies-setup)
4. [KeenIcons System](#keenicons-system)
5. [Component Patterns](#component-patterns)
6. [Layout System](#layout-system)
7. [Interactive Components](#interactive-components)
8. [Styling Guidelines](#styling-guidelines)
9. [Common Patterns](#common-patterns)
10. [Best Practices](#best-practices)

---

## Overview

**What is Metronic?**
- Metronic 9 is a Tailwind CSS-based UI component toolkit
- Version: 9.3.3
- Publisher: KeenThemes
- Documentation: https://keenthemes.com/metronic/tailwind/docs

**Core Technologies:**
- Tailwind CSS for styling
- KeenIcons for iconography (400+ icons in 4 styles)
- Vanilla JavaScript for interactivity
- No framework dependencies (React/Vue not required)

---

## File Structure

### Typical Metronic Project Structure

```
project/
├── assets/
│   ├── css/
│   │   └── styles.css              # Main Tailwind CSS bundle
│   ├── js/
│   │   ├── core.bundle.js          # Core Metronic JavaScript
│   │   ├── widgets/                # Widget-specific JS
│   │   ├── layouts/                # Layout-specific JS
│   │   └── datatables/             # DataTable components
│   ├── vendors/
│   │   ├── keenicons/
│   │   │   ├── styles.bundle.css   # Icon font CSS
│   │   │   └── fonts/              # Icon font files
│   │   ├── apexcharts/             # Chart library (optional)
│   │   ├── prismjs/                # Code highlighting (optional)
│   │   └── ktui/                   # UI component library
│   └── media/
│       ├── app/                    # App assets (logos, favicons)
│       └── [other media folders]
└── index.html
```

---

## Dependencies Setup

### Minimal HTML Template

```html
<!DOCTYPE html>
<html class="h-full" data-kt-theme="true" data-kt-theme-mode="light" dir="ltr" lang="en">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"/>
    <title>Your App Name</title>

    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>

    <!-- KeenIcons (REQUIRED) -->
    <link href="assets/vendors/keenicons/styles.bundle.css" rel="stylesheet"/>

    <!-- Main Styles (REQUIRED) -->
    <link href="assets/css/styles.css" rel="stylesheet"/>

    <!-- Optional Vendors -->
    <link href="assets/vendors/apexcharts/apexcharts.css" rel="stylesheet"/>
</head>
<body class="antialiased flex h-full text-base text-foreground bg-background">
    <!-- Theme Mode Script (Place before content) -->
    <script>
        const defaultThemeMode = 'light'; // light|dark|system
        let themeMode;

        if (document.documentElement) {
            if (localStorage.getItem('kt-theme')) {
                themeMode = localStorage.getItem('kt-theme');
            } else if (document.documentElement.hasAttribute('data-kt-theme-mode')) {
                themeMode = document.documentElement.getAttribute('data-kt-theme-mode');
            } else {
                themeMode = defaultThemeMode;
            }

            if (themeMode === 'system') {
                themeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }

            document.documentElement.classList.add(themeMode);
        }
    </script>

    <!-- Your Content Here -->

    <!-- Scripts (Place at end of body) -->
    <script src="assets/js/core.bundle.js"></script>
    <script src="assets/vendors/ktui/ktui.min.js"></script>
</body>
</html>
```

### Required Files

**Minimum requirements:**
1. `assets/vendors/keenicons/styles.bundle.css` - Icon font CSS
2. `assets/vendors/keenicons/fonts/*` - Icon font files (ttf, woff, svg for all 4 styles)
3. `assets/css/styles.css` - Main Tailwind CSS bundle
4. `assets/js/core.bundle.js` - Core JavaScript
5. `assets/vendors/ktui/ktui.min.js` - UI component library

---

## KeenIcons System

### Icon Styles

KeenIcons are available in **4 styles**:
- `ki-outline` - Outlined icons (line-based)
- `ki-filled` - Filled icons (solid fill)
- `ki-solid` - Solid icons (bold, thick lines)
- `ki-duotone` - Duotone icons (two-tone color)

### Icon Usage

**Basic Pattern:**
```html
<i class="ki-{style} ki-{icon-name}"></i>
```

**Examples:**
```html
<!-- Outlined menu icon -->
<i class="ki-outline ki-menu"></i>

<!-- Filled chart icon -->
<i class="ki-filled ki-chart-line-star"></i>

<!-- Solid user icon -->
<i class="ki-solid ki-user"></i>

<!-- Duotone home icon -->
<i class="ki-duotone ki-home"></i>
```

### Icon Sizing

Use Tailwind text utilities:
```html
<i class="ki-filled ki-menu text-xs"></i>    <!-- Extra small -->
<i class="ki-filled ki-menu text-sm"></i>    <!-- Small -->
<i class="ki-filled ki-menu text-base"></i>  <!-- Base (default) -->
<i class="ki-filled ki-menu text-lg"></i>    <!-- Large -->
<i class="ki-filled ki-menu text-xl"></i>    <!-- Extra large -->
<i class="ki-filled ki-menu text-2xl"></i>   <!-- 2X large -->
<i class="ki-filled ki-menu text-3xl"></i>   <!-- 3X large -->
```

### Icon Colors

Use Tailwind color utilities:
```html
<i class="ki-filled ki-menu text-primary"></i>
<i class="ki-filled ki-menu text-secondary-foreground"></i>
<i class="ki-filled ki-menu text-success"></i>
<i class="ki-filled ki-menu text-danger"></i>
<i class="ki-filled ki-menu text-warning"></i>
```

### Common Icons Reference

| Category | Icons |
|----------|-------|
| **Navigation** | `menu`, `burger-menu`, `arrow-left`, `arrow-right`, `arrow-up`, `arrow-down`, `home` |
| **Actions** | `plus`, `minus`, `check`, `cross`, `edit`, `trash`, `save-2`, `copy` |
| **UI Elements** | `setting`, `search`, `notification`, `dots-vertical`, `dots-horizontal` |
| **Files** | `file`, `folder`, `document`, `notepad`, `clipboard` |
| **Users** | `user`, `users`, `profile-circle`, `people` |
| **Communication** | `message-text`, `sms`, `notification`, `messages` |
| **Commerce** | `basket`, `credit-cart`, `dollar`, `price-tag`, `wallet` |
| **Media** | `picture`, `eye`, `heart`, `like`, `star` |

**See full list:** `keenicons-reference.md` (400+ icons)

---

## Component Patterns

### Button Components

**Base Button:**
```html
<button class="kt-btn kt-btn-primary">
    Primary Button
</button>
```

**Button Variants:**
```html
<!-- Primary -->
<button class="kt-btn kt-btn-primary">Primary</button>

<!-- Secondary -->
<button class="kt-btn kt-btn-secondary">Secondary</button>

<!-- Outline -->
<button class="kt-btn kt-btn-outline">Outline</button>

<!-- Ghost -->
<button class="kt-btn kt-btn-ghost">Ghost</button>

<!-- Icon Button -->
<button class="kt-btn kt-btn-icon kt-btn-ghost">
    <i class="ki-filled ki-menu"></i>
</button>
```

**Button Sizes:**
```html
<button class="kt-btn kt-btn-primary kt-btn-sm">Small</button>
<button class="kt-btn kt-btn-primary">Default</button>
<button class="kt-btn kt-btn-primary kt-btn-lg">Large</button>
```

### Menu Components

**Basic Menu Structure:**
```html
<div class="kt-menu" data-kt-menu="true">
    <div class="kt-menu-item">
        <a class="kt-menu-link" href="#">
            <span class="kt-menu-icon">
                <i class="ki-filled ki-home"></i>
            </span>
            <span class="kt-menu-title">Home</span>
        </a>
    </div>
    <div class="kt-menu-item">
        <a class="kt-menu-link" href="#">
            <span class="kt-menu-icon">
                <i class="ki-filled ki-profile-circle"></i>
            </span>
            <span class="kt-menu-title">Profile</span>
        </a>
    </div>
</div>
```

**Dropdown Menu:**
```html
<div class="kt-menu-item"
     data-kt-menu-item-toggle="dropdown"
     data-kt-menu-item-trigger="click|lg:hover">
    <div class="kt-menu-link">
        <span class="kt-menu-title">Dropdown</span>
        <span class="kt-menu-arrow">
            <i class="ki-filled ki-down text-xs"></i>
        </span>
    </div>
    <div class="kt-menu-dropdown gap-0.5 w-[220px]">
        <div class="kt-menu-item">
            <a class="kt-menu-link" href="#">
                <span class="kt-menu-title">Item 1</span>
            </a>
        </div>
        <div class="kt-menu-item">
            <a class="kt-menu-link" href="#">
                <span class="kt-menu-title">Item 2</span>
            </a>
        </div>
    </div>
</div>
```

### Card Components

**Basic Card:**
```html
<div class="kt-card">
    <div class="kt-card-header">
        <h3 class="kt-card-title">Card Title</h3>
    </div>
    <div class="kt-card-body">
        Card content goes here
    </div>
</div>
```

**Card with Actions:**
```html
<div class="kt-card">
    <div class="kt-card-header">
        <h3 class="kt-card-title">Card Title</h3>
        <div class="kt-card-toolbar">
            <button class="kt-btn kt-btn-sm kt-btn-primary">Action</button>
        </div>
    </div>
    <div class="kt-card-body">
        Card content
    </div>
    <div class="kt-card-footer">
        Footer content
    </div>
</div>
```

### Form Components

**Input Field:**
```html
<div class="kt-form-group">
    <label class="kt-form-label">Label</label>
    <input type="text" class="kt-input" placeholder="Enter text..."/>
</div>
```

**Select Dropdown:**
```html
<div class="kt-form-group">
    <label class="kt-form-label">Select Option</label>
    <select class="kt-select">
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
    </select>
</div>
```

**Checkbox:**
```html
<label class="kt-form-label flex items-center gap-2.5">
    <input class="kt-checkbox" type="checkbox"/>
    <span class="text-sm font-medium">Checkbox Label</span>
</label>
```

**Radio Button:**
```html
<label class="kt-form-label flex items-center gap-2.5">
    <input class="kt-radio" type="radio" name="radio-group" value="1"/>
    <span class="text-sm font-medium">Radio Label</span>
</label>
```

---

## Layout System

### Layout 8 Pattern (Vertical Sidebar with Icons)

**Structure:**
```html
<body class="antialiased flex h-full text-base text-foreground bg-background
             [--header-height:60px] [--sidebar-width:90px] bg-muted">
    <div class="flex grow">
        <!-- Mobile Header -->
        <header class="flex lg:hidden items-center fixed z-10 top-0 start-0 end-0
                       shrink-0 bg-muted h-(--header-height)" id="header">
            <!-- Mobile header content -->
        </header>

        <!-- Wrapper -->
        <div class="flex flex-col lg:flex-row grow pt-(--header-height) lg:pt-0">
            <!-- Sidebar -->
            <div class="fixed top-0 bottom-0 z-20 hidden lg:flex flex-col
                        items-stretch shrink-0 bg-muted w-(--sidebar-width)"
                 data-kt-drawer="true"
                 data-kt-drawer-class="kt-drawer kt-drawer-start flex"
                 id="sidebar">
                <!-- Sidebar content -->
            </div>

            <!-- Main Content -->
            <div class="grow">
                <!-- Page content -->
            </div>
        </div>
    </div>
</body>
```

### Sidebar Menu Item Pattern

**Icon-based Menu Item (for narrow sidebars):**
```html
<div class="kt-menu-item">
    <a class="kt-menu-link rounded-[9px] border border-transparent
              kt-menu-item-active:border-border kt-menu-item-active:bg-background
              kt-menu-link-hover:bg-background kt-menu-link-hover:border-border
              w-[62px] h-[60px] flex flex-col justify-center items-center gap-1 p-2"
       href="#">
        <span class="kt-menu-icon kt-menu-item-here:text-primary
                     kt-menu-item-active:text-primary kt-menu-link-hover:text-primary
                     text-secondary-foreground">
            <i class="ki-filled ki-chart-line-star text-xl"></i>
        </span>
        <span class="kt-menu-title text-xs kt-menu-item-here:text-primary
                     kt-menu-item-active:text-primary kt-menu-link-hover:text-primary
                     text-secondary-foreground font-medium">
            Dashboard
        </span>
    </a>
</div>
```

### Container System

**Fixed Container:**
```html
<div class="kt-container-fixed">
    <!-- Content constrained to max-width with auto margins -->
</div>
```

**Fluid Container:**
```html
<div class="kt-container-fluid">
    <!-- Full-width content with padding -->
</div>
```

---

## Interactive Components

### Modal Pattern

**Modal Structure:**
```html
<!-- Modal Trigger -->
<button class="kt-btn kt-btn-primary"
        data-kt-modal-toggle="#my_modal">
    Open Modal
</button>

<!-- Modal -->
<div class="kt-modal" id="my_modal" data-kt-modal="true">
    <div class="kt-modal-dialog">
        <div class="kt-modal-content">
            <div class="kt-modal-header">
                <h3 class="kt-modal-title">Modal Title</h3>
                <button class="kt-btn kt-btn-icon kt-btn-sm"
                        data-kt-modal-dismiss="true">
                    <i class="ki-filled ki-cross"></i>
                </button>
            </div>
            <div class="kt-modal-body">
                Modal content
            </div>
            <div class="kt-modal-footer">
                <button class="kt-btn kt-btn-primary">Save</button>
                <button class="kt-btn kt-btn-outline"
                        data-kt-modal-dismiss="true">Cancel</button>
            </div>
        </div>
    </div>
</div>
```

### Drawer Pattern (Slide-out Panel)

**Drawer Structure:**
```html
<!-- Drawer Trigger -->
<button class="kt-btn kt-btn-icon"
        data-kt-drawer-toggle="#my_drawer">
    <i class="ki-filled ki-menu"></i>
</button>

<!-- Drawer -->
<div class="kt-drawer kt-drawer-start"
     id="my_drawer"
     data-kt-drawer="true"
     data-kt-drawer-width="300px">
    <div class="kt-drawer-header">
        <h3 class="kt-drawer-title">Drawer Title</h3>
        <button class="kt-btn kt-btn-icon kt-btn-sm"
                data-kt-drawer-dismiss="true">
            <i class="ki-filled ki-cross"></i>
        </button>
    </div>
    <div class="kt-drawer-body">
        Drawer content
    </div>
</div>
```

### Dropdown Pattern

**Dropdown Structure:**
```html
<div class="kt-menu-item"
     data-kt-menu-item-toggle="dropdown"
     data-kt-menu-item-trigger="click">
    <button class="kt-btn kt-btn-primary">
        Dropdown
        <i class="ki-filled ki-down text-xs ms-2"></i>
    </button>
    <div class="kt-menu-dropdown">
        <div class="kt-menu-item">
            <a class="kt-menu-link" href="#">Action 1</a>
        </div>
        <div class="kt-menu-item">
            <a class="kt-menu-link" href="#">Action 2</a>
        </div>
    </div>
</div>
```

### Scrollable Container

**Scrollable Area:**
```html
<div class="kt-scrollable-y-hover"
     data-kt-scrollable="true"
     data-kt-scrollable-height="auto"
     data-kt-scrollable-offset="80px"
     data-kt-scrollable-dependencies="#header,#footer">
    <!-- Scrollable content -->
</div>
```

---

## Styling Guidelines

### Color System

**Semantic Colors (use these classes):**
```
Text Colors:
- text-foreground        (primary text)
- text-secondary-foreground  (secondary text)
- text-muted-foreground  (muted text)
- text-primary           (brand color)
- text-success           (success green)
- text-danger            (error red)
- text-warning           (warning yellow)
- text-info              (info blue)

Background Colors:
- bg-background          (main background)
- bg-muted              (muted background)
- bg-primary            (brand background)
- bg-secondary          (secondary background)

Border Colors:
- border-border         (default border)
- border-primary        (primary border)
```

### Spacing System

Use Tailwind spacing utilities:
```html
<!-- Padding -->
<div class="p-4">Padding all sides</div>
<div class="px-4">Horizontal padding</div>
<div class="py-4">Vertical padding</div>
<div class="pt-4 pb-8">Top and bottom</div>

<!-- Margin -->
<div class="m-4">Margin all sides</div>
<div class="mx-auto">Center horizontally</div>
<div class="my-4">Vertical margin</div>

<!-- Gap (for flex/grid) -->
<div class="flex gap-4">Items with gap</div>
<div class="flex gap-x-4 gap-y-2">Different x/y gaps</div>
```

### Typography

**Font Sizes:**
```html
<div class="text-xs">Extra small</div>
<div class="text-sm">Small</div>
<div class="text-base">Base</div>
<div class="text-lg">Large</div>
<div class="text-xl">Extra large</div>
<div class="text-2xl">2X large</div>
<div class="text-3xl">3X large</div>
```

**Font Weights:**
```html
<div class="font-normal">Normal (400)</div>
<div class="font-medium">Medium (500)</div>
<div class="font-semibold">Semibold (600)</div>
<div class="font-bold">Bold (700)</div>
```

### Responsive Design

**Responsive Prefixes:**
```html
<!-- Hidden on mobile, flex on desktop -->
<div class="hidden lg:flex">Desktop only</div>

<!-- Full width on mobile, half on desktop -->
<div class="w-full lg:w-1/2">Responsive width</div>

<!-- Stacked on mobile, row on desktop -->
<div class="flex flex-col lg:flex-row">
    <div>Item 1</div>
    <div>Item 2</div>
</div>
```

**Breakpoints:**
- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up
- `2xl:` - 1536px and up

---

## Common Patterns

### Tab System

**Tab Navigation:**
```html
<div class="kt-tabs" data-kt-tabs="true">
    <!-- Tab Headers -->
    <div class="kt-tabs-nav">
        <button class="kt-tabs-link active" data-kt-tabs-target="#tab1">
            Tab 1
        </button>
        <button class="kt-tabs-link" data-kt-tabs-target="#tab2">
            Tab 2
        </button>
    </div>

    <!-- Tab Content -->
    <div class="kt-tabs-content">
        <div class="kt-tabs-pane active" id="tab1">
            Tab 1 content
        </div>
        <div class="kt-tabs-pane" id="tab2">
            Tab 2 content
        </div>
    </div>
</div>
```

### Accordion Pattern

**Accordion Structure:**
```html
<div class="kt-accordion" data-kt-accordion="true">
    <div class="kt-accordion-item">
        <button class="kt-accordion-toggle" data-kt-accordion-toggle="true">
            <span>Accordion Item 1</span>
            <i class="ki-filled ki-down"></i>
        </button>
        <div class="kt-accordion-content">
            Content for item 1
        </div>
    </div>
    <div class="kt-accordion-item">
        <button class="kt-accordion-toggle" data-kt-accordion-toggle="true">
            <span>Accordion Item 2</span>
            <i class="ki-filled ki-down"></i>
        </button>
        <div class="kt-accordion-content">
            Content for item 2
        </div>
    </div>
</div>
```

### Data Attributes for Interactivity

**Common Data Attributes:**

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-kt-menu="true"` | Initialize menu | `<div class="kt-menu" data-kt-menu="true">` |
| `data-kt-modal="true"` | Initialize modal | `<div class="kt-modal" data-kt-modal="true">` |
| `data-kt-modal-toggle="#id"` | Modal trigger | `<button data-kt-modal-toggle="#modal">` |
| `data-kt-modal-dismiss="true"` | Close modal | `<button data-kt-modal-dismiss="true">` |
| `data-kt-drawer="true"` | Initialize drawer | `<div data-kt-drawer="true">` |
| `data-kt-drawer-toggle="#id"` | Drawer trigger | `<button data-kt-drawer-toggle="#drawer">` |
| `data-kt-tabs="true"` | Initialize tabs | `<div data-kt-tabs="true">` |
| `data-kt-scrollable="true"` | Scrollable area | `<div data-kt-scrollable="true">` |

---

## Best Practices

### 1. **File Organization**

**DO:**
- Keep all Metronic assets in an `assets/` folder
- Maintain the folder structure (css/, js/, vendors/)
- Keep fonts with their respective CSS files

**DON'T:**
- Mix Metronic files with custom files
- Modify vendor files directly
- Skip the required dependencies

### 2. **Icon Usage**

**DO:**
```html
<i class="ki-filled ki-menu text-xl"></i>
```

**DON'T:**
```html
<!-- Missing style class -->
<i class="ki-menu"></i>

<!-- Incorrect syntax -->
<i class="keenicon-menu"></i>
```

### 3. **Component Composition**

**DO:**
- Use semantic Metronic classes (`kt-btn`, `kt-card`)
- Combine with Tailwind utilities for customization
- Follow the established component patterns

**Example:**
```html
<button class="kt-btn kt-btn-primary rounded-lg px-6">
    Custom Button
</button>
```

**DON'T:**
- Create components from scratch when Metronic has them
- Override core Metronic styles globally

### 4. **Responsive Design**

**DO:**
```html
<!-- Mobile-first approach -->
<div class="flex flex-col lg:flex-row gap-4">
    <div class="w-full lg:w-1/2">Column 1</div>
    <div class="w-full lg:w-1/2">Column 2</div>
</div>
```

**DON'T:**
```html
<!-- Desktop-first (less flexible) -->
<div class="flex-row lg:flex-col">
```

### 5. **Interactive Components**

**DO:**
- Always include `data-kt-*` attributes for components that need JavaScript
- Place scripts at the end of `<body>`
- Initialize components with proper data attributes

**DON'T:**
- Rely on class names alone for interactivity
- Load scripts in `<head>` without `defer`

### 6. **Theme Mode**

**DO:**
- Include the theme mode script before your content
- Use semantic color classes that adapt to theme
- Test in both light and dark modes

**DON'T:**
- Hard-code colors (use `text-foreground` instead of `text-black`)
- Assume light mode only

### 7. **Accessibility**

**DO:**
```html
<button class="kt-btn kt-btn-icon" aria-label="Open menu">
    <i class="ki-filled ki-menu"></i>
</button>

<a class="kt-menu-link" href="#" role="menuitem">
    <span class="kt-menu-title">Profile</span>
</a>
```

**DON'T:**
- Create icon-only buttons without `aria-label`
- Use `<div>` for clickable items (use `<button>` or `<a>`)

---

## Quick Reference: Extracting Metronic from a Downloaded Package

### Step 1: Locate Source Files

From the Metronic package folder:
```
metronic-tailwind-html-starter-kit/
└── dist/
    ├── assets/
    │   ├── css/styles.css
    │   ├── js/core.bundle.js
    │   └── vendors/
    │       ├── keenicons/
    │       │   ├── styles.bundle.css
    │       │   └── fonts/
    │       └── ktui/ktui.min.js
    └── html/
        └── layout-8/
            └── index.html  (reference for structure)
```

### Step 2: Copy Required Files

**Minimum files to copy:**
1. `dist/assets/css/styles.css` → `your-project/assets/css/`
2. `dist/assets/js/core.bundle.js` → `your-project/assets/js/`
3. `dist/assets/vendors/keenicons/*` → `your-project/assets/vendors/keenicons/`
4. `dist/assets/vendors/ktui/ktui.min.js` → `your-project/assets/vendors/ktui/`

### Step 3: Reference Layout Examples

Look at `dist/html/layout-8/index.html` (or any layout) for:
- HTML structure patterns
- Component examples
- Data attribute usage
- Proper class combinations

### Step 4: Adapt to Your Project

- Copy HTML patterns (not the entire file)
- Keep the dependency structure intact
- Maintain relative paths between CSS/JS/fonts

---

## Troubleshooting

### Icons Not Showing

**Problem:** Icons appear as empty squares or missing
**Solution:**
1. Verify `keenicons/styles.bundle.css` is loaded
2. Check that `fonts/` folder is in correct location relative to CSS
3. Ensure both style class and icon class are present: `ki-filled ki-menu`

### Interactive Components Not Working

**Problem:** Modals, dropdowns, or drawers don't respond
**Solution:**
1. Ensure `core.bundle.js` and `ktui.min.js` are loaded
2. Verify `data-kt-*` attributes are present
3. Check browser console for JavaScript errors
4. Confirm scripts are loaded at end of `<body>`

### Styling Looks Wrong

**Problem:** Components don't match Metronic examples
**Solution:**
1. Verify `styles.css` is loaded correctly
2. Check that you're using exact class names from Metronic
3. Ensure no conflicting custom CSS overrides
4. Verify Tailwind utilities are spelled correctly

### Dark Mode Not Working

**Problem:** Theme doesn't switch or looks broken
**Solution:**
1. Include the theme mode script before content
2. Add `data-kt-theme="true"` to `<html>` tag
3. Use semantic colors (`text-foreground` not `text-black`)
4. Check `localStorage` for saved theme preference

---

## Summary

**To use Metronic in any HTML project:**

1. **Copy assets:** CSS, JS, and vendor files
2. **Set up HTML:** Include dependencies in `<head>` and scripts at end of `<body>`
3. **Use components:** Follow established patterns from reference layouts
4. **Add icons:** Use `ki-{style} ki-{name}` syntax
5. **Enable interactivity:** Add proper `data-kt-*` attributes
6. **Style with Tailwind:** Combine Metronic classes with Tailwind utilities
7. **Test responsively:** Use `lg:` prefixes for desktop layouts

**Key principle:** Metronic provides pre-built components and patterns. Your job is to assemble them using the patterns shown in the reference layouts, customizing with Tailwind utilities as needed.

---

**This guide is complete and ready for use with Claude Code in any project requiring Metronic components.**
