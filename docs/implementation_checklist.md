# Implementation Checklist

Use this checklist to build and deploy the Compliance Document Hub.

## Phase 1 – Foundation

- [ ] Create Google Sheet with tables using CSV templates in `/data`.
- [ ] Import sheet into AppSheet and verify keys/labels.
- [ ] Configure user roles and add initial user accounts.
- [ ] Apply security filters to `Departments`, `MonthlyTasks`, and `TaskResponses`.

## Phase 2 – UX Setup

- [ ] Build `My Tasks` deck view and quick-edit inline responses.
- [ ] Create admin views for departments, templates, and assignments.
- [ ] Assemble dashboards for admins and department managers.
- [ ] Add `Export Center` form for report generation preferences.

## Phase 3 – Automations

- [ ] Configure monthly task generation bot and test with sample data.
- [ ] Set up reminder and escalation notifications.
- [ ] Implement PDF and XLSX export bots.
- [ ] Validate Google Drive folder permissions.

## Phase 4 – Launch Preparation

- [ ] Translate prompts and guidance as needed for local languages.
- [ ] Produce training materials and run pilot with 2–3 departments.
- [ ] Collect feedback and refine UX/automations.
- [ ] Document support process and escalation path.

## Phase 5 – Expansion & Maintenance

- [ ] Onboard remaining departments in waves.
- [ ] Review audit logs weekly for sync errors.
- [ ] Update templates quarterly to reflect new compliance requirements.
- [ ] Back up data monthly and archive exports.
