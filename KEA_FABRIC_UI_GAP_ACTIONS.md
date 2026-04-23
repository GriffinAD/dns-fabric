# Kea Fabric UI Refactor — Gap Actions (Condensed)

## Core Gaps
- No enforcement
- Host owns plugins
- Layout mixed with domain logic
- Direct DataGateway usage
- Prop drilling
- Weak contracts

## Actions

### Architecture
- Add PluginTileMount
- Add registry
- Add LayoutStore
- Add EventBus

### Rules
- No pluginId checks
- No plugin imports in host

### State
- Centralise layout
- EventBus for live data

### Plugins
- Standard structure
- Plugin-owned settings

### Layout
- Remove plugin-specific logic

### Contracts
- Expand contract definitions
- Enforce validation

### Migration
- No mixed mode
- Vertical slice

### Testing
- Isolation tests
- Registry tests
- Store tests

## Outcome
Clean plugin architecture, no coupling.
