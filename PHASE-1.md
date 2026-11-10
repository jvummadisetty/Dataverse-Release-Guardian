# Dynamics Release Guardian — Phase 1

Developer Tools for Dataverse & Dynamics 365

## Purpose

Review a Dataverse solution before deployment using three connected views: complete inventory, component usage evidence, and source-to-destination checks. Keep findings readable and technical evidence expandable. Read-only analysis uses the authenticated Dynamics browser tabs; no extra runtime libraries or credentials are introduced.

## Included

- Guided connection, solution selection and analysis.
- Overview and a complete, collapsed-by-default inventory grouped by returned component type. Other opens its categories; unknown objects remain visible.
- Table and column exploration, inclusion explanations, search, definition usage and grouped Dataverse dependencies.
- Release Diff with search, grouping, coverage explanations and expandable source/destination evidence. Covered types include table/column settings, forms/views, process/flow definitions, connection references, web resources and environment-variable definition settings.
- Target prerequisite verification with Verified, Not verified and Confirmed missing findings. Readiness explicitly shows its coverage limits.
- Light Microsoft-inspired presentation, responsive controls, keyboard focus, tooltips and extension branding.

## Meaning of results

- Added individually: a column has its own solution-component record.
- Included in solution: the membership analysis includes the column directly or through its parent table.
- Matched: component identity matched, not necessarily an equal definition.
- Changed: a covered definition differs in the current environments; not a prediction of import changes.
- Source only / Target only: selected-solution membership; not environment-wide absence or a deletion prediction.
- Not compared: identity or definition coverage was insufficient.
- READY: no blocking prerequisite was detected by these checks; not a guarantee of import success.

## Not covered

Managed-layer conflicts, upgrade-removal prediction, exported ZIP/layer reconstruction, role privilege/access-depth comparison, connection authentication/permissions, flow execution, and definition comparison for every component type. These must not be presented as completed checks. Unknown runtime component codes are not assigned guessed identities.

## Remaining validation before team sign-off

1. Reload the extension and refresh the authenticated source/destination tabs.
2. Confirm source and destination names/versions throughout the workflow.
3. Verify representative inventory names, Other navigation, column inclusion help, filters and dependency evidence.
4. Compare an Entities solution and a Processes solution; inspect Changed and Not compared findings and rerun Readiness.
5. Check a connection reference with different source/target GUIDs. Verify a connector mismatch stays unresolved.
6. Confirm Readiness shows managed-layer and upgrade-removal coverage limits even for READY results.
7. Review the reported 107 versus 104 table-count discrepancy separately; Phase 1 does not assert count parity with Power Apps.
8. Verify keyboard navigation and a narrow side panel in Chrome.

Automated checks use fixtures, not authenticated production data. Phase 1 functionality is implemented; live acceptance and the unresolved count investigation remain pending. See DEMO-CHECKLIST.md for the presentation walkthrough.
