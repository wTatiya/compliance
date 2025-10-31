# QA Testing Environments

This guide walks quality assurance teams through provisioning a realistic test
environment with representative data. The goal is to make it fast to validate
role-based access, automation, and reporting without touching production
systems.

## Provisioning steps

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Ensure a PostgreSQL database is available** and set
   `DATABASE_URL` accordingly. Local engineers typically rely on
   `postgresql://postgres:postgres@localhost:5432/compliance_qa`.
3. **Apply the latest schema**
   ```bash
   npm run prisma:migrate --workspace apps/api
   ```
4. **Seed the dedicated QA dataset**
   ```bash
   npm run prisma:seed:qa --workspace apps/api
   ```

The QA seed script wipes existing data and inserts a curated set of users,
templates, tasks, and audit logs that align with documented test scenarios.

## Seeded fixtures

| Email                     | Role               | Departments                             | Notes |
| ------------------------- | ------------------ | --------------------------------------- | ----- |
| `admin.qa@example.com`    | Admin              | Information Security, Field Operations  | Full platform access, used for admin flows |
| `manager.qa@example.com`  | DepartmentManager  | Field Operations                        | Owns departmental configuration and approvals |
| `frontline.qa@example.com`| Assignee           | Field Operations                        | Receives simple tasks with guidance |

- All accounts share the password **`Compliance123!`** for quick logins in
  ephemeral environments.
- Automation data includes two templates (identity review and field
  inspection), current-month tasks, and assignments covering different status
  combinations.
- Audit logs capture baseline actions so reporting dashboards and exports have
  non-empty results.

## Resetting the environment

Running the QA seed command is idempotent: it truncates the relevant tables
before re-populating them. Re-run the command whenever you need a clean slate
or after destructive test cases.

## Recommended validation cadence

1. Execute the QA seed script to ensure fresh data.
2. Complete the [manual QA checklist](./manual-qa-checklist.md) prior to each
   release candidate.
3. Document discrepancies directly in the test run (e.g., Linear, Jira) and
   include screenshots captured from the QA dataset for context.

Maintaining the QA environment with this workflow ensures automated tests and
manual checks run against consistent, human-readable records.
