# UI & Training Guidelines

Design the AppSheet UX with low-literacy staff in mind.

## Visual Design Tips

* Use large buttons with clear icons and minimal text.
* Color-code the response enum buttons:
  * `1` (Compliant) — green check icon.
  * `0` (Not compliant) — red warning icon.
  * `NA` (Not applicable) — grey circle icon.
* Provide short, two-line maximum prompts. Move long explanations to the
  `Guidance` column and display via `Show` type or info icon.
* Enable `Display prominently` for critical instructions at the top of forms.
* Add image-based instructions where possible (e.g., sample photos of correct
  storage setups).

## Navigation

* Landing view should be `My Tasks` with `Primary` button to start the next due
  task.
* Use `Grouped` actions to mark a task complete and return to the task list.
* Hide admin views from assignees using `Show If` expressions.

## Multilingual Support

* Translate key prompts via `Localized` expressions (`IFS(USERSETTINGS("Language")="Filipino", "..." , ...)`).
* Use the `PreferredLanguage` column to set default user locale with AppSheet
  `USERSETTINGS`.

## Training Materials

* Provide a one-page laminated quick start guide with screenshots of the mobile
  app.
* Offer short video walkthroughs hosted in Google Drive and linked via AppSheet
  info actions.
* Run supervised onboarding sessions where staff complete practice tasks.

## Support & Feedback

* Add a form view `Report an Issue` that logs into an `Issues` table.
* Include `Help` action linking to a Google Doc or FAQ.
* Monitor AppSheet audit logs weekly to catch sync errors or failed automations.
