# Environment Configuration

## Overview
The repository follows a layered environment configuration strategy to support local development, CI, and production deployments while keeping secrets out of source control.

## Files and Precedence
1. **`.env`** (developer local overrides) – ignored by Git.
2. **`.env.local`** (optional package-specific overrides) – ignored by Git.
3. **`.env.example`** – committed, documents the variables required for all environments.
4. **CI variables** – configured via the CI platform's secret store.

Each workspace is responsible for loading environment variables through its framework conventions:
- **Next.js (`apps/web`)** automatically reads `.env.local`, `.env.development`, `.env.production`, and `.env`.
- **NestJS (`apps/api`)** consumes variables using the `@nestjs/config` module, which should be configured to load from `.env` and environment-specific files (e.g., `.env.development`).

## Secrets Management
- Secrets (database passwords, JWT secrets, third-party tokens) **must not** be committed. Provide placeholders in `.env.example`.
- In production, prefer cloud-managed secret stores (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault). The service should inject secrets into the runtime environment variables rather than writing files to disk.

## Local Development Workflow
1. Copy `.env.example` to `.env` at the repository root.
2. Update values with developer-specific credentials.
3. For package-specific overrides, create `apps/<package>/.env.local` files that are ignored by Git.
4. Use Docker Compose (to be added in a future iteration) to provision dependencies such as PostgreSQL, ensuring consistency across the team.

## CI/CD Workflow
- GitHub Actions relies on environment variables stored in repository secrets (`Settings > Secrets and variables > Actions`).
- Secrets are injected at job runtime and mapped to the respective application steps.
- Use environment-specific prefixes such as `PROD_` or `STAGING_` to differentiate deployments.

## Validation
- Add runtime validation (e.g., Zod schemas or `class-validator`) to fail fast when required variables are missing.
- Document any schema updates in `.env.example` and communicate changes via release notes.
