# Technology Stack Decision

## Summary
- **Frontend:** Next.js (React + TypeScript)
- **Backend:** NestJS (Fastify adapter, TypeScript)
- **Database:** PostgreSQL (managed via Prisma ORM)
- **Package Management:** npm workspaces with a monorepo layout

## Rationale
### Next.js
- Provides a batteries-included React framework with server-side rendering and static generation, which are valuable for a compliance document portal that mixes dynamic dashboards with static policy pages.
- Built-in API routes enable rapid experimentation for small endpoints while the NestJS service matures.
- Strong TypeScript support and first-party ESLint integration reduce tooling overhead.

### NestJS (with Fastify)
- Opinionated modular architecture aligns with long-term compliance requirements such as auditing, role-based access, and integration with external systems.
- Fastify adapter offers better performance characteristics than Express for heavily I/O-bound applications.
- Mature ecosystem for authentication, validation, and OpenAPI documentation shortens time-to-value.

### PostgreSQL
- ACID-compliant relational database with native JSON support, balancing structured compliance records and semi-structured metadata.
- Broad cloud provider support and compatibility with managed services, reducing operational burden.
- Works seamlessly with Prisma ORM for schema management, migrations, and type-safe data access.

### npm Workspaces Monorepo
- Enables shared tooling, linting, and TypeScript configuration across frontend and backend.
- Simplifies dependency management and CI configuration for a small core team.
- Keeps the door open for shared libraries (e.g., UI component library or domain models) under `packages/`.

## Alternatives Considered
- **Polyrepo:** Rejected to avoid duplicated tooling and slow cross-repo coordination during early development.
- **Express.js Backend:** Simpler but lacks NestJS's modularity and built-in architecture patterns, leading to higher maintenance costs for compliance-heavy features.
- **MongoDB:** Document databases make transactional workflows and relational reporting more difficult. PostgreSQL's reliability is more suitable for auditability.
