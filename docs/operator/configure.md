# Configure

## Layering

Configuration merges in **lowest → highest** precedence (see [`../architecture/config.md`](../architecture/config.md)):

1. Compiled package defaults
2. System files under `/etc/kea-fabric/`
3. User/operator files (`$XDG_CONFIG_HOME/kea-fabric/` or `--config`)
4. Environment variables (`KEA_FABRIC_*`)
5. CLI flags
6. Audited runtime overrides via admin API (where allowed)

## Secrets

Reference secrets via provider URIs (`$secret://...`) per config architecture — never commit secrets to plain config files.

## HTTP bearer JWT (optional HS256 or JWKS)

When `http_jwt_hs256_secret` is set (or `KEA_FABRIC_HTTP_JWT_HS256_SECRET` in the
environment), the HTTP API verifies `Authorization: Bearer` tokens as HS256
JWTs and binds identity to the JWT `sub` claim (see `ADR-0040` / `ADR-0041`).
Optional `http_jwt_audience` / `http_jwt_issuer` (`KEA_FABRIC_HTTP_JWT_AUDIENCE`,
`KEA_FABRIC_HTTP_JWT_ISSUER`) enforce `aud` / `iss` when present.

When `http_jwt_jwks_url` is set (`KEA_FABRIC_HTTP_JWT_JWKS_URL`) and the HS256
secret is **not**, bearer tokens are verified against that JWKS URL using
asymmetric algorithms (RS256, ES256, and other common OIDC algorithms). Use the
same optional `aud` / `iss` settings to match your IdP. This path is intended
for OIDC / OAuth2 resource-server style tokens. It takes precedence over issuer
discovery when both are set.

When `http_oidc_issuer_url` is set (`KEA_FABRIC_HTTP_OIDC_ISSUER_URL`) and neither
HS256 nor `http_jwt_jwks_url` is configured, the process resolves the JWKS endpoint
from `{issuer}/.well-known/openid-configuration` (`jwks_uri` field) and verifies
bearer tokens the same way as the explicit JWKS URL mode.

When **no** verification mode above applies, legacy behaviour remains: a
non-empty bearer token is accepted without verification (subject
`bearer-present`).

The `X-Kea-Fabric-Dev-Subject` header still wins over bearer tokens when set.

## Reload semantics

Keys are tagged **hot**, **restart**, or **approval** — mutating sensitive values may require an approval workflow ([`../architecture/security.md`](../architecture/security.md)).

## Cross-refs

- [`../architecture/config.md`](../architecture/config.md)
- [`upgrade.md`](upgrade.md)
