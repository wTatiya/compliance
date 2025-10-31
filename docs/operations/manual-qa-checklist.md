# Manual QA Checklist (Low-Literacy Focus)

This checklist ensures usability and accessibility for users who benefit from
plain language, visual cues, and limited technical jargon. Execute it after the
automated test suite and QA seeding script (`npm run prisma:seed:qa --workspace
apps/api`).

## 1. Authentication & onboarding

- [ ] Log in as `frontline.qa@example.com` / `Compliance123!`
  - Confirm the login screen uses short sentences (max 12 words) and labels the
    password field with everyday language.
  - Ensure error states show a friendly, specific message (e.g., “Check your
    email or password”) without codes or acronyms.
- [ ] After login, verify the welcome banner explains the next action in
  two sentences or less (e.g., “Review the tasks due this week.”).
- [ ] Confirm the global navigation highlights the current page using both
  colour and an icon so it is recognisable at a glance.

## 2. Admin flow (Ada Quinn)

- [ ] Sign in as `admin.qa@example.com` and open the department templates page.
  - Confirm table headers use concrete nouns (“Task name”, “Due day”) and every
    row has a short description column.
- [ ] Trigger monthly automation manually (if UI supports it) and ensure the
  confirmation modal summarises the impact with bullet points.
- [ ] Export the compliance report in both PDF and XLSX formats.
  - Confirm the download buttons use verbs (“Download PDF report”) and show a
    spinner or progress text while generating.
  - Open the exported files to ensure titles and section headings match the UI
    labels so users can cross-reference easily.
- [ ] Visit the audit log view and check that each entry contains:
  - A plain-language action (“Task assigned to Lina Rivera”).
  - A timestamp formatted as “Mar 8, 2024 • 14:35 UTC”.

## 3. Department manager flow (Micah Ford)

- [ ] Sign in as `manager.qa@example.com` and confirm only Field Operations
  tasks are visible.
- [ ] Update a task status. Verify the confirmation toast tells the user the
  next recommended step (“Tell Lina about the change”).
- [ ] Add a new assignee:
  - Ensure the form requests only essential details (name, email, department).
  - Check helper text explains why each field matters using everyday language.
- [ ] Confirm the dashboard card descriptions summarise what the number means
  (“Tasks finished this month”) rather than referencing internal metrics.

## 4. Frontline assignee flow (Lina Rivera)

- [ ] Sign in as `frontline.qa@example.com` and open an assigned task.
  - Confirm instructions are broken into short bullet points with verbs first
    (“Upload inspection photos”).
  - Ensure buttons use verbs rather than nouns (“Mark as done”, “Ask for help”).
- [ ] Upload a document and check the success state repeats what happened
  (“Photo evidence uploaded”) and the next step (“Wait for Micah to review”).
- [ ] Attempt to access another department’s assignments and verify the message
  explains the restriction without security jargon (“You can only view Field
  Operations tasks”).

## 5. General usability sweep

- [ ] Confirm every screen has a clearly labelled “Help” or “Need support?” link
  that opens concise guidance or contact details.
- [ ] Check that icons always pair with text labels; no icon-only buttons should
  remain.
- [ ] Review mobile breakpoints at 320px and 414px widths to ensure headings
  wrap cleanly and buttons stay at least 44px tall.
- [ ] Spot-check colour contrast with a contrast tool (target 4.5:1 or higher)
  for primary text and controls.

Document findings in the QA run notes and capture screenshots of any confusing
wording so the content team can revise copy quickly.
