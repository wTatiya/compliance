# Reporting & Export Workflows

This document outlines dashboard configuration and export automation for PDF/XLSX
reports from the Compliance Document Hub.

## Dashboards

### 1. Compliance Overview Dashboard

Components (Interactive Mode enabled):

1. **KPIs (Card View)**
   * Total tasks this month: `COUNT(SELECT(MonthlyTasks[TaskID], [Month]=EOMONTH(TODAY(),-1)+1))`
   * Completion rate: `AVERAGE(SELECT(MonthlyTasks[Score], [Month]=EOMONTH(TODAY(),-1)+1))`
   * Overdue count: `COUNT(SELECT(MonthlyTasks[TaskID], [Status]="Overdue"))`
2. **Department Progress Chart**
   * Chart view grouped by `DepartmentID`, series = `% Submitted`
3. **Template Heatmap**
   * Table view pivoted by Template (rows) and Month (columns) with `Score`
4. **Recent Submissions**
   * Deck view showing last 10 tasks submitted.

Restrict dashboard visibility to admins and department managers using `Show If`
expressions tied to roles.

### 2. My Department Dashboard

For department managers:

* Filtered to `DepartmentID` values linked to the manager via `DepartmentAssignees`.
* Include charts for compliance rate, overdue tasks, and historical trend line.
* Add detail views for each template with inline history of responses.

### 3. Assignee Self-Check

A simple deck or table summarizing each assignee's completion status and average
score. Useful for coaching conversations.

## Export Options

### Export Settings Table

Add columns to `MonthlyTasks`:

* `ExportPDF` (Yes/No)
* `ExportXLSX` (Yes/No)
* `ExportLastRun` (DateTime)

Assignees or managers can toggle export preferences before running automation.

### PDF Export Workflow

1. Create a bot `Generate Task PDF` triggered by data change when `ExportPDF`
   switches from `FALSE` to `TRUE`.
2. Process steps:
   * Task 1: Run a report using an AppSheet template (Google Doc) that includes:
     * Task metadata (department, template, month, status)
     * Table of responses with icons or color-coded results (`1`, `0`, `NA`)
     * Comments and photos (if any)
   * Task 2: Save the PDF to Google Drive folder `Compliance/Exports/${Month}`.
   * Task 3: Email the PDF to the requester and optional CC addresses.
   * Task 4: Update the `ExportPDF` flag back to `FALSE` and set `ExportLastRun`
     to `NOW()`.

### XLSX Export Workflow

1. Create a scheduled bot `Monthly XLSX Bundle` running on demand or monthly.
2. Use a process that calls a Task `Create new file` with an AppSheet template in
   Google Sheets format.
3. Use a grouped action or parent-child process to iterate through selected
   tasks/templates (based on checkboxes) and append rows to the export sheet.
4. Save the generated XLSX file to Google Drive and email the download link.

### Custom Export Selection View

Create a form view `Export Center` with the following fields:

* `DepartmentID` (enumlist of departments user can access)
* `TemplateID` (enumlist filtered to selected departments)
* `MonthRangeStart` / `MonthRangeEnd`
* `IncludeAttachments` (Yes/No)
* `OutputFormat` (Enum: PDF, XLSX, Both)

Upon submission, trigger an AppSheet Task that:

1. Creates a log record in `ExportRequests` table (add to schema if needed).
2. Launches a bot that reads the selections and produces the appropriate files.
3. Sends email with links plus a summary table.

### Google Drive Organization

```
Compliance/
  Exports/
    2024/
      2024-06_MonthlySummary.pdf
      2024-06_Department-ICU.xlsx
  Attachments/
    TaskID_xxx/photo_001.jpg
```

Use AppSheet `Default app folder` to segregate attachments and exports. Grant
view-only access to managers by sharing the relevant Drive folders.

## Analytics

* Enable AppSheet `Usage Statistics` to monitor adoption.
* Optionally connect the data source to Looker Studio or BigQuery for advanced
  analytics.
