# PAI

Project PAI is the application monorepo for the Contextual Life architecture.
The live Feishu parent architecture and its non-deprecated child documents are
the source of truth for service boundaries and cross-service contracts.

## Workspace

- `packages/contracts` owns shared TypeBox contracts and generated artifacts.
- `packages/object-store` owns the only `ObjectStorePortV1` interface.
- `packages/service-kit` provides the common Fastify bootstrap without owning
  business contracts.
- `services/*` contains the eight document-defined application services.

Infrastructure, database migrations, deployment manifests, and seeds belong in
the separate `pai-infra` repository.

## Development baseline

- [20-day development plan](docs/development-plan-2026-07-20-to-2026-08-08.md)
- [architecture traceability matrix](docs/architecture-traceability-matrix.md)
- [`pai-infra` handoff v1](docs/pai-infra-handoff-v1.md)

## Locked toolchain

- Node.js `24.18.0`
- pnpm `11.13.1`
- TypeScript `7.0.2`

```bash
corepack enable
corepack prepare pnpm@11.13.1 --activate
pnpm verify:toolchain
pnpm install --frozen-lockfile
pnpm check
```
