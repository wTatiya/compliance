# AppSheet Configuration Guide

This guide details how to implement the Compliance Document Hub inside AppSheet
using the data model provided in `data/`.

## 1. Data Source Setup

1. Create a new Google Sheet and add worksheets for each table described in
   `data_model.md`, or import the CSV templates.
2. In AppSheet, create an app from the Google Sheet (or SQL data source).
3. For each table, set the key column and label column as follows:
   * `Departments`: key = `DepartmentID`, label = `Name`
   * `Assignees`: key = `AssigneeID`, label = `FullName`
   * `DepartmentAssignees`: key = `DepartmentAssigneeID`
   * `ComplianceTemplates`: key = `TemplateID`, label = `Title`
   * `ComplianceItems`: key = `ItemID`, label = `Prompt`
   * `DepartmentTemplate`: key = `DepartmentTemplateID`
   * `AssignmentRules`: key = `AssignmentRuleID`
   * `MonthlyTasks`: key = `TaskID`, label = expression `CONCATENATE([DepartmentID]," - ",[TemplateID]," - ",TEXT([Month],"MMM YYYY"))`
   * `TaskResponses`: key = `ResponseID`
   * `Attachments`: key = `AttachmentID`

## 2. Security Filters

Use security filters to enforce per-user visibility:

* **MonthlyTasks filter**
  ```
  OR(
    USERROLE()="ComplianceAdmin",
    IN(USEREMAIL(), SELECT(Assignees[AssigneeID], [Role]="DepartmentManager"))
      AND IN([DepartmentID], SELECT(DepartmentAssignees[DepartmentID], [AssigneeID]=USEREMAIL())),
    [AssigneeID]=USEREMAIL()
  )
  ```
* **TaskResponses filter**
  ```
  IN([TaskID], MonthlyTasks[TaskID])
  ```
* **Departments filter**
  ```
  OR(
    USERROLE()="ComplianceAdmin",
    IN([DepartmentID], SELECT(DepartmentAssignees[DepartmentID], [AssigneeID]=USEREMAIL()))
  )
  ```

Define AppSheet roles under **Users > Users** to match `Role` values. For
Department Managers, assign the AppSheet role `DepartmentManager`. For
Compliance Admins, assign `ComplianceAdmin`.

## 3. UX Views

### Assignee Interface

* **My Tasks Deck View**
  * Data: `MonthlyTasks` slice `MyTasks`
  * Primary header: `[TemplateID].[Title]`
  * Subheader: `TEXT([Month], "MMM YYYY")`
  * Status indicator: format rules for `Overdue`
  * Actions:
    * `Open Task Detail`: navigate to detail view.
    * `Quick Complete`: grouped action to set status to `Submitted` and timestamp
      if all responses answered.

* **Task Detail View**
  * Type: Form (read-only fields for department, template, due date).
  * Embedded inline view of `TaskResponses` with quick-edit enabled for mobile.
  * Show dynamic instructions using `[TemplateID].[Description]`.

* **Task Responses Inline View**
  * Enable quick edit for `Response` with enum buttons `1`, `0`, `NA` (icons and
    color coding to help low-literacy users).
  * Add action buttons for attaching photos or adding comments.

### Admin Console

* **Departments, Assignees, Templates**: table views restricted to admins via
  show-if expression `USERROLE()="ComplianceAdmin"`.
* **Assignment Planner**: deck view based on `DepartmentTemplate` slice showing
  which templates apply to each department, with inline related assignment rules.
* **Template Builder**: detail view with nested `ComplianceItems` quick edit.

### Dashboards

Create interactive dashboards composed of:

1. **Department Progress** (Chart): `MonthlyTasks` aggregated by department with
   % submitted.
2. **Compliance Heatmap** (Table): pivot view of templates vs. months showing
   average score.
3. **Overdue Tasks** (Deck): filtered slice `MonthlyTasks` where `Status="Overdue"`.

Enable `Interactive Mode` so selecting a department filters the other charts.
Share dashboard views with department managers by setting `Show if` expression to
include their role.

## 4. Automations

### Monthly Task Generation

1. Create a bot `Monthly Compliance Generator` with an event schedule running on
   the first day of each month.
2. Process steps:
   * **For each `DepartmentTemplate` where `Active=TRUE`**:
     * Evaluate assignment rules to determine assignees effective for the month.
     * Create a `MonthlyTask` per assignee with columns:
       * `TaskID = CONCATENATE([DepartmentID],"-",[TemplateID],"-",TEXT(TODAY(),"YYYYMM"),"-",[_ThisRow].[AssigneeID])`
       * `Month = EOMONTH(TODAY(),-1)+1` (first day of current month)
       * `DueDate = EOMONTH([Month],0)`
       * `Status = "Not Started"`
     * For each `ComplianceItem` on the template, create a `TaskResponse` child
       row linked to the task with `Response=""`.

3. Include conditional check to avoid duplicates using a `SELECT` statement that
   looks for existing tasks with same `TaskID`.

### Notifications

* **Reminder Bot**: runs daily, selects tasks where `Status<"Submitted"` and
  `DueDate-TODAY()<=2`. Sends push/email to `AssigneeID` with deep link to task.
* **Escalation Bot**: triggers when `Status` changes to `Overdue`; notify
  department manager (looked up through `DepartmentAssignees[Primary=TRUE]`).

## 5. Data Entry Enhancements

* Enable `Delayed Sync` and `Offline use` for mobile reliability.
* Use enum buttons with icons and colors: `1` (green check), `0` (red X),
  `NA` (grey minus).
* Add helper text summarizing responses: virtual column `CompletionRate =
  NUMBER(COUNT(SELECT(TaskResponses[ResponseID], [TaskID]=[_THISROW].[TaskID] AND
  [Response]<>""))) / COUNT(SELECT(TaskResponses[ResponseID], [TaskID]=[_THISROW].[TaskID]))`.
* Provide `Contextual Help` by showing `[TemplateID].[GuidanceURL]` (optional
  column) via a link action.

## 6. Export Workflows

See `reporting_export.md` for details, but configure AppSheet automation tasks
that render PDF/XLSX documents based on user-selected checkboxes (`ExportPDF`,
`ExportXLSX`). Attach the generated files to emails or save to Google Drive.

## 7. Governance & Deployment

* Use AppSheet `Team` plans to manage user access centrally.
* Version the Google Sheet schema by exporting backups monthly.
* Monitor automation performance via AppSheet audit logs and error reports.
