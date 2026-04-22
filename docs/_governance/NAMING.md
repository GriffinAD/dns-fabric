---
title: Product Naming
owner: GriffinAD
peer_reviewer: GriffinAD
status: Accepted
last_review: 2026-04-19
---

# Product Naming

Single source of truth for the project's canonical names, the namespaces that
must be reserved, and the prior art we have to disambiguate against.

## Canonical names

The product is **Kea Fabric** (display, with a space).
The slug is **`kea-fabric`** (everywhere else: repo, dist, binaries, dirs, images).
The Python import package is **`kea_fabric`** (underscore, PEP 8).

| Surface | Value |
|---|---|
| Display name (prose, UI, docs titles, README, marketing) | Kea Fabric |
| Slug | `kea-fabric` |
| Repo | `kea-fabric` |
| Python dist (PyPI) | `kea-fabric` |
| Python import | `import kea_fabric` |
| CLI (admin) | `kea-fabric` |
| CLI (daemon) | `kea-fabricd` |
| Config dir | `/etc/kea-fabric/` |
| Data dir | `/var/lib/kea-fabric/` |
| Log dir | `/var/log/kea-fabric/` |
| systemd unit | `kea-fabric.service` |
| Docker image | `<registry>/kea-fabric` (plus `:tag-debug` variant) |
| Helm chart | `kea-fabric` |
| Docs site title | *Kea Fabric* |
| Tagline | *An enterprise plugin fabric for ISC Kea DHCP.* |

**Forbidden variants** (fail review on sight): `KeaFabric`, `keafabric`,
`Kea-Fabric`, `kea_fabric` in prose, `Kea fabric`, `KEA FABRIC`.

## Namespace reservation checklist

Sanity-check performed 2026-04-19. Primary namespaces remain available except
the user repo now created under `GriffinAD/kea-fabric`:

- [ ] PyPI `kea-fabric` (verified 404 — available)
- [ ] npm `kea-fabric` (verified 404 — available)
- [ ] Docker Hub `kea-fabric` (verified empty — available)
- [ ] Docker Hub `keafabric` (defensive reservation — available)
- [x] GitHub repo `GriffinAD/kea-fabric` (created 2026-04-19, private)
- [ ] GitHub org `kea-fabric` (verified 404 — available; still unreserved)
- [ ] GitHub org `keafabric` (defensive reservation — available; still unreserved)
- [ ] Read the Docs `kea-fabric` (verified 404 — available)
- [ ] Homebrew `kea-fabric` formula (verified 404 — available)
- [ ] crates.io `kea-fabric` (verified 404 — available; not needed but defensively noted)

**Action item (Phase 2 prerequisite):** these must be **reserved-but-not-published**
at the start of Phase 2. Squatters can claim them otherwise. Reservation requires
credentials and is tracked as a frontmatter todo on the architecture plan.

## Prior art and disambiguation

1. **ISC Kea** — the DHCP server. Our *target integration*, not a collision.
   Kea Fabric is a management plane for ISC Kea. Marketing copy should always
   be explicit on first use: *"Kea Fabric — a management plane for ISC Kea DHCP."*

2. **[keajs.org](https://keajs.org/) "Kea 3.0"** — a React state-management
   library (used by PostHog, Elastic). Different category (frontend library vs
   DHCP tooling), no direct collision, but the name overlap requires explicit
   disambiguation in any marketing or search-facing copy.

3. **ISC Stork** — ISC's own Kea GUI. Kea Fabric is explicitly differentiated
   as a **plugin-first fabric layer**, not a Stork replacement and not a GUI-only
   product. The contrast should be surfaced in the overview documentation.

## Change Log

| Date | Status | Reviewer | Notes |
|---|---|---|---|
| 2026-04-19 | Accepted | GriffinAD | Initial draft; namespace sanity-check recorded. |
| 2026-04-19 | Accepted | GriffinAD | Checked off `GriffinAD/kea-fabric` repo creation; org reservations remain pending. |
