# Compliance Document Hub Overview

This document summarizes the goals and capabilities of the AppSheet Compliance
Document Hub solution documented in this repository.

## Objectives

* **Department-specific task visibility:** Every assignee sees only the
  compliance checklist items relevant to the departments they support.
* **Centralized administration:** Compliance managers maintain departments,
  assignees, checklists, and monthly compliance templates from a single
  interface.
* **Automated task generation:** Monthly compliance tasks and assignments are
  generated automatically from templates, with optional reminders and escalations
  for overdue items.
* **Built-in data protection:** AppSheet security filters and role-based access
  control protect sensitive information without relying on manual spreadsheet
  protections.
* **Dashboards and exports:** Managers can monitor progress via dashboards and
  export ad-hoc reports in PDF or XLSX format.

## Key Concepts

| Concept | Description |
| --- | --- |
| **Department** | A hospital ward or administrative unit with recurring compliance requirements. |
| **Assignee** | A staff member responsible for completing compliance tasks. Some assignees support multiple departments and vice versa. |
| **Compliance Template** | A reusable checklist representing one compliance requirement (e.g., "Medication Storage Audit"). |
| **Monthly Task** | An automatically generated record that pairs an assignee with a compliance template for a given month. |
| **Response** | The answer provided by an assignee: `1` = compliant, `0` = not compliant, `NA` = not applicable. |

## User Roles

* **Compliance Admin:** Full access to manage departments, templates, schedules,
  assignments, and reporting.
* **Department Manager:** Read-only dashboards for their departments, including
  exports and history.
* **Assignee:** Mobile-friendly task list with simplified data entry and
  context-sensitive help.

Refer to the remaining documents in this directory for technical setup details
and AppSheet configuration guidance.
