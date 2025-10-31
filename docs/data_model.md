# Data Model

The Compliance Document Hub uses a relational structure that works with Google
Sheets (one worksheet per table) or a SQL database. Column names below match the
CSV templates in `../data/`.

## Entity Relationship Diagram

```
Department 1---* DepartmentAssignee *---1 Assignee
Department 1---* DepartmentTemplate *---1 ComplianceTemplate
ComplianceTemplate 1---* ComplianceItem
DepartmentTemplate 1---* AssignmentRule
AssignmentRule 1---* MonthlyTask
MonthlyTask 1---* TaskResponse
```

## Tables

### Departments

| Column | Type | Notes |
| --- | --- | --- |
| `DepartmentID` | TEXT (key) | Unique identifier, e.g., `WARD-ICU`. |
| `Name` | TEXT | Display name shown in the app. |
| `Category` | TEXT | Optional grouping (e.g., "Clinical", "Administrative"). |
| `Active` | YES/NO | Hide inactive departments without deleting history. |

### Assignees

| Column | Type | Notes |
| --- | --- | --- |
| `AssigneeID` | TEXT (key) | Unique identifier, e.g., email. |
| `FullName` | TEXT | Display name. |
| `PreferredLanguage` | TEXT | Supports low-literacy staff by tailoring instructions. |
| `Role` | ENUM | Values: `Assignee`, `DepartmentManager`, `ComplianceAdmin`. |
| `Active` | YES/NO | Soft delete.

### DepartmentAssignees (bridge)

| Column | Type | Notes |
| --- | --- | --- |
| `DepartmentAssigneeID` | TEXT (key) | Unique. |
| `DepartmentID` | REF -> Departments | |
| `AssigneeID` | REF -> Assignees | |
| `Primary` | YES/NO | Indicates primary contact. |

### ComplianceTemplates

| Column | Type | Notes |
| --- | --- | --- |
| `TemplateID` | TEXT (key) | Unique identifier. |
| `Title` | TEXT | E.g., "Medication Storage". |
| `Description` | LONGTEXT | Instructions shown to assignees. |
| `Category` | TEXT | Optional grouping for dashboards. |
| `Frequency` | ENUM | Default `Monthly`, but future-proof for `Weekly`, `Quarterly`. |
| `Active` | YES/NO | Toggle availability. |

### ComplianceItems

| Column | Type | Notes |
| --- | --- | --- |
| `ItemID` | TEXT (key) | Unique per row. |
| `TemplateID` | REF -> ComplianceTemplates | |
| `Prompt` | LONGTEXT | Question/instruction answered with 1/0/NA. |
| `Guidance` | LONGTEXT | Optional tip or checklist. |
| `Order` | NUMBER | Controls display order. |

### DepartmentTemplate (bridge)

| Column | Type | Notes |
| --- | --- | --- |
| `DepartmentTemplateID` | TEXT (key) | Unique. |
| `DepartmentID` | REF -> Departments | Departments using the template. |
| `TemplateID` | REF -> ComplianceTemplates | |
| `DefaultAssigneeID` | REF -> Assignees | Optional fallback when no rule exists. |

### AssignmentRules

Defines who receives tasks for a given department/template combination. Supports
multiple assignees per department.

| Column | Type | Notes |
| --- | --- | --- |
| `AssignmentRuleID` | TEXT (key) | Unique. |
| `DepartmentTemplateID` | REF -> DepartmentTemplate | |
| `AssigneeID` | REF -> Assignees | |
| `StartDate` | DATE | Optional. |
| `EndDate` | DATE | Optional. |
| `Active` | YES/NO | Toggle without deleting. |

### MonthlyTasks

| Column | Type | Notes |
| --- | --- | --- |
| `TaskID` | TEXT (key) | Unique identifier (`DEPT-TEMPLATE-YYYYMM`). |
| `DepartmentID` | REF -> Departments | Denormalized for filtering. |
| `TemplateID` | REF -> ComplianceTemplates | Denormalized. |
| `AssigneeID` | REF -> Assignees | Current owner. |
| `Month` | DATE | First day of the month (e.g., `2024-06-01`). |
| `Status` | ENUM | `Not Started`, `In Progress`, `Submitted`, `Overdue`. |
| `DueDate` | DATE | Automatically calculated (e.g., `EOMONTH`). |
| `SubmittedAt` | DATETIME | Timestamp when responses finalized. |
| `Score` | NUMBER | Calculated: `%` of items with response `1`. |

### TaskResponses

| Column | Type | Notes |
| --- | --- | --- |
| `ResponseID` | TEXT (key) | Unique. |
| `TaskID` | REF -> MonthlyTasks | |
| `ItemID` | REF -> ComplianceItems | |
| `Response` | ENUM | `1`, `0`, `NA`. |
| `Comment` | LONGTEXT | Optional explanation. |
| `Photo` | IMAGE | Optional proof capture. |
| `UpdatedBy` | REF -> Assignees | Captured via AppSheet USEREMAIL(). |
| `UpdatedAt` | DATETIME | Auto timestamp. |

### Attachments (optional)

Store uploaded documents and link them to tasks or departments.

| Column | Type | Notes |
| --- | --- | --- |
| `AttachmentID` | TEXT (key) | |
| `TaskID` | REF -> MonthlyTasks | Nullable. |
| `DepartmentID` | REF -> Departments | Nullable. |
| `FileURL` | TEXT | Provided by AppSheet file store. |
| `Description` | TEXT | |
| `UploadedAt` | DATETIME | |

## Slices & Views

Create AppSheet slices for filtered subsets:

* `MyTasks`: MonthlyTasks where `AssigneeID = USEREMAIL()`.
* `MyResponses`: TaskResponses filtered by tasks in `MyTasks`.
* `AdminDashboard`: All tables for admin role, secured by security filters.
* `DepartmentTasks`: MonthlyTasks where `DepartmentID` matches manager's scope.

These slices drive UX views and security filters (described in
`appsheet_configuration.md`).
