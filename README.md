# Compliance Document Hub Blueprint

This repository bootstraps a monorepo for the Compliance Document Hub. It hosts a Next.js web
application, a NestJS API, and shared tooling to accelerate development of compliance-centric
features.

## Monorepo Layout

```
├── apps
│   ├── api   # NestJS service exposing compliance APIs
│   └── web   # Next.js frontend for the document hub
├── docs      # Architecture and operations decision records
├── .github   # Continuous integration workflows
└── ...       # Shared configuration (Prettier, ESLint, etc.)
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment variables and customize them:
   ```bash
   cp .env.example .env
   ```
3. Run the applications:
   - Web: `npm run dev --workspace=@compliance/web`
   - API: `npm run start:dev --workspace=@compliance/api`

## Quality Gates

- `npm run lint` – runs ESLint across all workspaces.
- `npm run test` – executes Jest suites for the web and API projects.
- `npm run format` – checks Prettier formatting (auto-fix via `npx lint-staged` on staged files).

GitHub Actions (see `.github/workflows/ci.yml`) enforces the same lint and test checks on every pull
request.
