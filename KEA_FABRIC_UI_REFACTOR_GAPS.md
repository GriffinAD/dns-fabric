# Kea Fabric UI Refactor — Implementation Gaps (Action Document)

## Purpose
This document defines mandatory implementation actions required to realise the UI engine architecture.

Focus: gaps not covered in UI_ENGINE_* docs.

---

## 1. Enforcement Rules

### Plugin Isolation (CI)
grep -R "pluginId ===" apps/ui/src/lib/dashboard && exit 1

### Host Must Not Import Plugins
No imports from lib/plugins in dashboard/host or dashboard/layout

### App Shell Limit
AppShell ≤ 120 lines

### Dependency Direction
kernel → dashboard → plugins
(no reverse)

---

## 2. Structural Additions

### PluginTileMount
Central rendering component

### plugins/registry.ts
Single source of truth

### Plugin Structure
plugins/<domain>/
  index.ts
  Tile
  OptionsForm
  schema

---

## 3. State Rules

- Only LayoutStore/EventBus call DataGateway
- Remove prop drilling
- Ownership:
  layout → LayoutStore
  UI → DashboardPage
  plugin data → plugin

---

## 4. Layout Rules

- No plugin logic in gridPlacement
- Plugins define gridPolicy

---

## 5. Settings

- Overlay generic only
- Plugins own settings UI

---

## 6. Contracts

- Expand ui_dashboard_plugin.py
- Enforce runtime schema validation

---

## 7. Migration

- No mixed mode
- Freeze new plugins
- Vertical slice first

---

## 8. Docs Lifecycle

- Root docs temporary
- Move to docs/architecture

---

## 9. Testing

- Plugin isolation tests
- Registry tests
- LayoutStore tests

---

## Summary
This prevents regression and enforces architecture.
