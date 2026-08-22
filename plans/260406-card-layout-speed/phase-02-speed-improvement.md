---
phase: 2
title: Speed Improvement — Lower Endpoint Delay
status: completed
priority: medium
effort: small
completed: 2026-04-06
---

# Phase 2: Speed Improvement

## Overview

Lower default Soniox endpoint delay from 3000ms to 1500ms. Combined with Phase 1's "show original immediately" card layout, users perceive translation ~1.5s faster.

## Related Code Files

**Modify:**
- `src/js/app.js` — change default endpoint delay value
- `src/js/soniox.js` — no changes needed (already uses config param)

## Implementation Steps

### Step 1: Update default endpoint delay in `app.js`

In `_applySettings()` (~line 555):
```js
// Before:
const endpointDelay = s.endpoint_delay || 3000;

// After:
const endpointDelay = s.endpoint_delay || 1500;
```

In `_gatherSettingsFromUI()` (~line 647):
```js
// Before:
endpoint_delay: parseInt(document.getElementById('range-endpoint-delay')?.value || 3000),

// After:
endpoint_delay: parseInt(document.getElementById('range-endpoint-delay')?.value || 1500),
```

In `start()` (~line 1029):
```js
// Before:
endpointDelay: settings.endpoint_delay || 3000,

// After:
endpointDelay: settings.endpoint_delay || 1500,
```

### Step 2: Update slider default in `index.html`

```html
<!-- Before: -->
<input type="range" id="range-endpoint-delay" min="500" max="3000" step="100" value="3000" />

<!-- After: -->
<input type="range" id="range-endpoint-delay" min="500" max="3000" step="100" value="1500" />
```

### Step 3: Update Rust settings default

In `src-tauri/src/settings.rs`, the `Settings::default()` doesn't have `endpoint_delay` — it's frontend-only. No Rust change needed.

## Todo

- [x] Change 3 default values in `app.js` from 3000 to 1500
- [x] Change slider default value in `index.html` from 3000 to 1500
- [x] **[RED TEAM]** Add one-time migration in `_applySettings()`: if saved `endpoint_delay === 3000` (old default), update to 1500 so existing users get the speed improvement
- [x] Test: verify 1.5s default gives good sentence boundary detection without splitting mid-sentence

## Success Criteria

- Default endpoint delay is 1500ms for new installs
- Existing users with saved settings keep their configured value
- Settings slider still works (range 500-3000ms)
- Translation appears ~1.5s faster with default settings

## Risk

Lower delay may split sentences mid-thought for slow speakers. The setting is user-adjustable (500-3000ms range), so users can increase if needed.
