# Light Mode

AI Hermeneutica Orthodoxa supports both **dark mode** (default) and **light mode**. The user's preference is saved automatically in `localStorage` and restored on each visit.

## Toggling the Theme

Click the **sun / moon icon** (☀️ / 🌙) in the top-right toolbar to switch between dark and light mode.

- **Dark mode** – the default deep-navy appearance optimised for extended reading sessions.
- **Light mode** – a light, indigo-accented theme suitable for bright environments.

## Technical Details

### ThemeService

`frontend/src/app/services/theme.service.ts`

The `ThemeService` is an Angular `providedIn: 'root'` service that:

1. Reads the saved preference from `localStorage` (`hermeneutica-theme` key) on startup.
2. Applies the theme by toggling the `.dark` class on `<html>`.
3. Persists any change back to `localStorage`.

```typescript
// Inject and use in any component:
themeService = inject(ThemeService);

// Read current theme
themeService.theme(); // 'dark' | 'light'

// Toggle
themeService.toggleTheme();
```

### CSS Variables

All colours are expressed as CSS custom properties defined in `frontend/src/styles.scss`.

| Variable | Dark mode | Light mode |
|---|---|---|
| `--bg-dark` | `#0d0d1a` | `#f5f5f5` |
| `--bg-card` | `#1e1e2e` | `#ffffff` |
| `--text-light` | `#e8eaf6` | `#1a237e` |
| `--text-muted` | `#9fa8da` | `#5c6bc0` |
| `--gold` | `#ffd700` | `#f9a825` |
| `--navbar-bg` | `#0a0a1f` | `#e8eaf6` |
| `--panel-bg` | `rgba(10,10,30,0.5)` | `rgba(232,234,246,0.5)` |
| `--dialog-bg` | `#12122a` | `#ffffff` |
| `--dialog-content-bg` | `#1a1a2e` | `#f8f9fa` |

### PrimeNG Integration

PrimeNG is configured with `darkModeSelector: '.dark'` (see `frontend/src/app/app.config.ts`). When the `.dark` class is present on `<html>`, PrimeNG's Aura preset automatically uses its dark palette. Removing the class switches PrimeNG to its default light palette.

Additional overrides for PrimeNG components (inputs, selects, menus, dialogs, etc.) are defined in the `html.light` section of `styles.scss` to ensure a consistent light-mode appearance.
