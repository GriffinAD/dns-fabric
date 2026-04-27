---
name: Service_V2 discovery plan
overview: Service_V2 introduces filesystem/module service discovery for `services/*.py` with protocol-validated auto-registration, deterministic startup behavior, and strong debugging/testing hooks, while preserving current `FabricService` route contracts during migration.
todos:
  - id: define-discovery-contract
    content: Add ServiceProtocol, ServiceFactoryProtocol, and ServiceContext for discoverable service modules
    status: pending
  - id: build-discovery-loader
    content: Implement deterministic services/*.py module scanner/importer with strict validation and duplicate-key detection
    status: pending
  - id: wire-app-and-fabric
    content: Switch create_app/FabricService to registry-driven service loading with strict/off rollout flag
    status: pending
  - id: add-debug-surface
    content: Add startup service-load report (logs + optional admin diagnostics surface)
    status: pending
  - id: structured-logging-review
    content: Define system-wide structured logging schema, event taxonomy, and rollout standards across API/services/discovery
    status: pending
  - id: admin-log-viewer
    content: Add admin log viewer endpoint/UI with filters for service, operation subcategory, discovery mode/event, severity, and time window
    status: pending
  - id: test-discovery-modes
    content: Add unit/integration coverage for discovery success/fail paths and parity with existing route behavior
    status: pending
  - id: document-discovery
    content: Document discovery contract, troubleshooting, and rollout policy in docs/ADR
    status: pending
isProject: false
---

# Service_V2 plan — full service discovery and observability

## Plan identity and storage

- **Canonical plan name:** `Service_V2 discovery and observability`
- **Canonical file:** `.cursor/plans/Service_V2_discovery_observability.plan.md`
- **Execution status:** deferred/not scheduled (design-complete plan for later implementation)

## Scope and non-goals

### In scope

- Filesystem/module discovery for backend services under `src/kea_fabric/services/*.py`
- Deterministic startup loading, strict contract validation, typed registry wiring
- Structured logging standardization and discovery-focused diagnostics
- Admin logs query/view capability with operational filters

### Non-goals (Service_V2)

- No dynamic plugin install/uninstall at runtime
- No hot-reload of service modules in production runtime
- No route contract redesign or API version bump purely for discovery
- No distributed log backend selection decision (viewer reads bounded retained local/system logs in this phase)

## Goal

Replace hardcoded service construction in [`/Volumes/Data/dev/DHCP/kea-fabric/src/kea_fabric/services/fabric.py`](/Volumes/Data/dev/DHCP/kea-fabric/src/kea_fabric/services/fabric.py) with module discovery under `services/*.py`, while keeping startup deterministic and failures diagnosable.

## Target architecture

- Keep `FabricService` as the route-facing façade for now.
- Add a discovery layer that scans `src/kea_fabric/services/*.py`, imports modules, and instantiates classes that implement a common protocol.
- Build a typed service container/map, inject into `FabricService`, and keep existing method delegation stable.

```mermaid
flowchart LR
  createApp[create_app]
  discoverer[serviceDiscoverer]
  modules[services/*.py modules]
  registry[serviceRegistryMap]
  fabric[FabricService facade]
  routes[v1_router endpoints]

  createApp --> discoverer
  discoverer --> modules
  modules --> registry
  registry --> fabric
  fabric --> routes
```

## Phase 1 — Contracts and discovery metadata

- Create a single discovery contract module, e.g. `src/kea_fabric/services/discovery.py`, with **exact required definitions**:
  - `ServiceKey = Literal["layout","dhcp","discovery","perf","replication","audit"]` (Phase 1 fixed key set).
  - `@dataclass(frozen=True)` `ServiceContext` containing only startup-shared dependencies:
    - `settings: ApiSettings`
    - `layout_store: JsonLayoutStore`
    - `dhcp: DhcpDataSource`
    - `nebula: MockNebulaReplicationAdapter`
  - `@runtime_checkable Protocol` `DiscoverableService` with required metadata:
    - `service_key: ServiceKey`
    - `service_version: str` (semantic version string)
  - `type ServiceFactory = Callable[[ServiceContext], DiscoverableService]`
- Define **module metadata contract** for each discoverable file (`services/*.py`):
  - Required: `SERVICE_KEY: ServiceKey`
  - Required: `SERVICE_VERSION: str`
  - Required: `def create_service(context: ServiceContext) -> DiscoverableService`
  - Optional: `SERVICE_ALIASES: tuple[str, ...] = ()` (reserved for future migrations, ignored in Phase 1).
- Define **validation rules** (Phase 1 strict):
  - `SERVICE_KEY` must be non-empty, lowercase snake-case, and unique.
  - `SERVICE_VERSION` must parse as semver-like `x.y.z` (regex check acceptable initially).
  - `create_service` must be callable and return an object exposing `service_key` equal to module `SERVICE_KEY`.
  - Returned `service_key` mismatch is a startup error.
- Define **registry shape** explicitly:
  - `ServiceRegistry = dict[ServiceKey, DiscoverableService]`
  - Required keys at end of discovery: `layout`, `dhcp`, `discovery`, `perf`, `replication`, `audit`.
  - Missing required key is a startup error in strict mode.
- Define **error taxonomy** for deterministic debugging:
  - `ServiceDiscoveryImportError(module, cause)`
  - `ServiceDiscoveryContractError(module, missing_or_invalid_symbol)`
  - `ServiceDiscoveryDuplicateKeyError(key, first_module, second_module)`
  - `ServiceDiscoveryInstantiationError(module, cause)`
  - `ServiceDiscoveryMissingRequiredError(missing_keys)`
- Define **determinism guarantees**:
  - Module scan order: lexical sort by module name.
  - Registration order follows scan order.
  - Duplicate-key failure reports first/second module names in deterministic order.
- Add a short contributor template to Phase 1 docs (or code comments) showing minimum valid module:
  - `SERVICE_KEY = "perf"`
  - `SERVICE_VERSION = "1.0.0"`
  - `def create_service(context): return PerfService(dhcp=context.dhcp)`

### Phase 1 exit criteria

- `ServiceKey`, `ServiceContext`, protocol contracts, and error classes exist and are type-checked.
- Every currently known service module has a compliant metadata/factory shape or is explicitly denylisted.
- Contract docs are clear enough that a new service can be added without touching loader internals.

## Phase 2 — Filesystem/module discovery engine

- Implement scanner with explicit entrypoint:
  - `discover_services(context: ServiceContext, mode: Literal["strict","off"]) -> ServiceRegistry`
  - `mode="off"` returns legacy explicit map (Phase 3 adapter), no module scan.
  - `mode="strict"` runs full discovery and enforces all Phase 1 contracts.
- Use deterministic module enumeration:
  - Source: `pkgutil.iter_modules(kea_fabric.services.__path__)`
  - Sort key: module name ascending.
  - Exclude hardcoded denylist: `{"__init__", "fabric", "discovery"}` plus non-service helper modules.
- Enforce a fixed discovery pipeline per module (same order for every module):
  1. `import_module("kea_fabric.services.<name>")`
  2. Resolve `SERVICE_KEY`, `SERVICE_VERSION`, `create_service`
  3. Validate metadata shapes and key/version format
  4. Instantiate with `create_service(context)`
  5. Validate returned `service_key` and `service_version`
  6. Insert into registry (or raise duplicate-key error)
- Bind failures to the exact Phase 1 error taxonomy:
  - import failure -> `ServiceDiscoveryImportError`
  - missing/invalid symbol -> `ServiceDiscoveryContractError`
  - factory exception -> `ServiceDiscoveryInstantiationError`
  - duplicate key -> `ServiceDiscoveryDuplicateKeyError`
  - required key absent after scan -> `ServiceDiscoveryMissingRequiredError`
- Return a structured discovery report object with each run:
  - `scanned_modules: list[str]`
  - `loaded: dict[ServiceKey, str]` (key -> module name)
  - `skipped: dict[str, str]` (module -> reason)
  - `mode: str`
  - `duration_ms: int`
- Define non-negotiable loader invariants:
  - No partial registry returned in strict mode if any fatal error occurs.
  - Same codebase + same mode yields same registry key set and same key->module map.
  - Error messages always include module name and failing step index (1-6).

### Phase 2 exit criteria

- Loader produces deterministic registry/report outputs across repeated runs.
- All taxonomy errors are emitted from the expected failure points.
- Strict mode cannot continue with partial/invalid service maps.

## Phase 3 — Startup wiring and fallback policy

- In [`/Volumes/Data/dev/DHCP/kea-fabric/src/kea_fabric/settings.py`](/Volumes/Data/dev/DHCP/kea-fabric/src/kea_fabric/settings.py), define `KEA_FABRIC_SERVICE_DISCOVERY` as:
  - allowed values: `off` (default), `strict`
  - invalid value behavior: startup failure with explicit allowed-values message.
- In [`/Volumes/Data/dev/DHCP/kea-fabric/src/kea_fabric/api/main.py`](/Volumes/Data/dev/DHCP/kea-fabric/src/kea_fabric/api/main.py), wire startup precedence exactly:
  1. Build baseline dependencies (`settings`, adapters, `layout_store`) as today.
  2. Build `ServiceContext`.
  3. If `service_discovery == "off"`, call legacy explicit builder and attach report `mode=off`.
  4. If `service_discovery == "strict"`, call `discover_services(..., mode="strict")`.
  5. Pass resulting `ServiceRegistry` into `FabricService`.
- In [`/Volumes/Data/dev/DHCP/kea-fabric/src/kea_fabric/services/fabric.py`](/Volumes/Data/dev/DHCP/kea-fabric/src/kea_fabric/services/fabric.py):
  - accept `service_registry: ServiceRegistry` constructor arg,
  - resolve fixed keys (`layout`, `dhcp`, `discovery`, `perf`, `replication`, `audit`) from registry only,
  - keep all façade methods and route-visible behavior unchanged.
- Define rollback semantics (operationally precise):
  - `strict` failure must fail process startup (no silent fallback to legacy map).
  - rollback is explicit config change to `KEA_FABRIC_SERVICE_DISCOVERY=off` and restart.
  - each startup logs active mode and rollback hint.
- Define compatibility constraints:
  - no route signature/path changes in this phase,
  - no response payload changes attributable to loader mode,
  - same adapter selection behavior (`dhcp_backend`) regardless of discovery mode.
- Add migration gate criteria for flipping default from `off` to `strict`:
  - discovery tests all green,
  - one release cycle with strict exercised in non-prod,
  - debug report proves expected key->module map in startup logs.

### Phase 3 exit criteria

- `create_app` startup mode behavior is deterministic and test-covered for `off` and `strict`.
- `FabricService` resolves all required keys via registry only.
- Strict-mode failure aborts startup with actionable rollback guidance.

## Phase 4 — Debuggability and operability

### 4.1 Structured logging review (system-wide)

- Add a dedicated logging design pass covering API, service layer, discovery loader, and admin operations (not discovery-only).
- Define a canonical structured log schema (JSON lines) with required fields:
  - `ts`, `level`, `event`, `message`, `service`, `operation`, `subcategory`, `mode`, `request_id`, `trace_id`, `error_type`, `error_message`
- Define event taxonomy and naming rules:
  - discovery events: `service_discovery.scan_start`, `service_discovery.module_loaded`, `service_discovery.failure`
  - service operation events: `service.<service_name>.<operation_name>`
  - admin events: `admin.logs.query`, `admin.services.query`
- Define redaction policy:
  - never log tokens/secrets/raw credentials,
  - hash or omit sensitive fields,
  - include allowlist-based payload fragments only.
- Define log-level policy:
  - `INFO`: startup summaries, successful mode selection, admin queries
  - `WARN`: recoverable/ignored module conditions
  - `ERROR`: strict-mode startup blockers and contract violations

### 4.2 Discovery-focused debug surface

- Add structured startup log summary:
  - discovered modules,
  - loaded service keys,
  - module→key mapping,
  - skipped modules + reason.
- Add diagnostic endpoint (`/api/v1/admin/services`) and attach startup report object to app state.
- Standardize discovery errors with actionable messages (missing symbol, duplicate key, import failure, protocol mismatch).

### 4.3 Admin logs viewer and filters

- Add backend log query endpoint(s), e.g. `/api/v1/admin/logs`, over bounded retained logs.
- Support filterable query params:
  - `service`
  - `operation`
  - `subcategory` (including discovery-related categories)
  - `level`
  - `mode` (`off`/`strict` where relevant)
  - `from`/`to` time range
  - pagination cursor/limit
- Add admin UI section for logs:
  - filter controls for fields above,
  - sortable timestamp view,
  - expandable JSON details per row,
  - clear empty/error states and query diagnostics.
- Define safety/perf constraints:
  - max query window and row limit,
  - server-side filtering only,
  - no full raw log download from UI by default.

### Phase 4 exit criteria

- Structured log schema and event taxonomy are documented and enforced in code paths touched by ServiceV2.
- Startup diagnostics expose mode, loaded map, skipped reasons, and error context.
- Admin logs endpoint/UI supports required filters (`service`, `operation`, `subcategory`, `mode`, `level`, time range).

## Phase 5 — Test strategy (must-have)

- Add a deterministic test matrix for discovery behavior (unit + integration), with each case asserting both exception/report semantics and startup mode behavior.

### Required matrix cases

- `case_id: off_mode_legacy_builder`
  - mode: `off`
  - fixture modules: ignored
  - expected: no discovery exceptions, legacy registry built
  - assert report: `mode=off`, `scanned_modules=[]`, `loaded` contains all required keys
- `case_id: strict_happy_path`
  - mode: `strict`
  - fixture modules: one valid module per required key
  - expected: success
  - assert report: deterministic `scanned_modules` order, expected `loaded` key->module map, `skipped` reasons present for denylisted modules
- `case_id: strict_duplicate_key`
  - mode: `strict`
  - fixture modules: two modules with same `SERVICE_KEY`
  - expected exception: `ServiceDiscoveryDuplicateKeyError`
  - assert error payload: `key`, `first_module`, `second_module`, failing step index
- `case_id: strict_missing_required_symbol`
  - mode: `strict`
  - fixture modules: missing `create_service` or missing `SERVICE_VERSION`
  - expected exception: `ServiceDiscoveryContractError`
  - assert error payload: module name, missing symbol name, failing step index
- `case_id: strict_import_failure`
  - mode: `strict`
  - fixture modules: module raises at import time
  - expected exception: `ServiceDiscoveryImportError`
  - assert error payload: module name, original exception class/message
- `case_id: strict_factory_raises`
  - mode: `strict`
  - fixture modules: `create_service` raises
  - expected exception: `ServiceDiscoveryInstantiationError`
  - assert error payload: module name, factory failure cause, failing step index
- `case_id: strict_returned_key_mismatch`
  - mode: `strict`
  - fixture modules: module `SERVICE_KEY` differs from instance `service_key`
  - expected exception: `ServiceDiscoveryContractError`
  - assert error payload: declared key, returned key, failing step index
- `case_id: strict_missing_required_registry_key`
  - mode: `strict`
  - fixture modules: omit one required key module
  - expected exception: `ServiceDiscoveryMissingRequiredError`
  - assert error payload: sorted `missing_keys` list
- `case_id: strict_deterministic_repeatability`
  - mode: `strict`
  - run discovery twice on same fixtures
  - expected: same `loaded` map, same `scanned_modules`, same `skipped` map

### Test placement and scope

- Unit discovery tests: new file under `tests/` dedicated to loader contract/errors.
- Extend [`/Volumes/Data/dev/DHCP/kea-fabric/tests/test_services_split.py`](/Volumes/Data/dev/DHCP/kea-fabric/tests/test_services_split.py) for registry-construction behavior in `FabricService`.
- Startup integration tests around [`/Volumes/Data/dev/DHCP/kea-fabric/src/kea_fabric/api/main.py`](/Volumes/Data/dev/DHCP/kea-fabric/src/kea_fabric/api/main.py):
  - verify mode `off` and `strict` wiring,
  - verify strict failures abort startup,
  - verify route behavior parity (selected read/write endpoints).

### Logging/report assertions (non-optional)

- Every strict-mode test must assert at least one of:
  - structured report fields (`mode`, `scanned_modules`, `loaded`, `skipped`, `duration_ms`)
  - standardized discovery exception fields.
- Add one integration assertion that startup logs include:
  - active discovery mode,
  - number of discovered modules,
  - rollback hint when mode is `strict`.

### Phase 5 exit criteria

- All required matrix cases pass with explicit assertion of error/report shape.
- Discovery behavior is reproducible and deterministic under repeated runs.
- Coverage gates remain at enforced 100% thresholds.

## Phase 6 — Documentation and policy

- Document discovery contract and debug output in operator/architecture docs (update discovery-relevant docs and add a short ADR for this loading model).
- Include contributor guidance: how to add a new discoverable service module safely.

### Phase 6 exit criteria

- ADR accepted for ServiceV2 loader model and logging schema.
- Operator documentation includes troubleshooting playbook for discovery failures and rollback.
- Contributor docs include copy-paste starter template for new discoverable services.

## Acceptance criteria

- Route behavior unchanged for existing endpoints.
- Discovery mode produces deterministic, logged service map.
- Misconfigured service module fails startup with clear error.
- Tests cover success + all critical failure modes.
- `bash scripts/check_app.sh` remains green with 100% enforced coverage.
- Plan remains tagged and referenced as **ServiceV2** in docs/ADR and implementation PR description.
