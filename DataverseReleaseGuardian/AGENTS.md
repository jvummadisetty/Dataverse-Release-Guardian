# Dataverse Release Guardian — Development Handoff

You are continuing development of **Dataverse Release Guardian**, a Chrome Manifest V3 extension for Microsoft Dynamics 365 and Dataverse.

This is an existing, actively developed project. Do not rebuild it from scratch.

## Project Goal

Build a professional pre-deployment analysis tool that helps Dynamics 365 / Power Platform developers identify solution differences, missing dependencies, and deployment risks before importing solutions between DEV, UAT, and PROD.

The extension should provide actionable deployment intelligence, not simply display Dataverse metadata.

## Existing Architecture

- `manifest.json` — Chrome extension configuration
- `background.js` — side panel behavior
- `content.js` — Dataverse Web API operations
- `sidepanel.js` — application controllers, analysis logic, component resolvers, and UI rendering
- `sidepanel.html` — interface
- `styles.css` — visual design

During development, the extension communicates with authenticated Dynamics browser tabs using Chrome messaging and same-origin Dataverse Web API requests.

Do not extract browser access tokens or introduce client secrets.

## Implemented Features

1. Dynamics environment detection and WhoAmI connectivity.
2. Solution discovery and component inventory.
3. Table, column, form, view, relationship, and process exploration.
4. Solution membership analysis, including parent-table subcomponent behavior.
5. Column usage analysis using FormXML, FetchXML, LayoutXML, and business rule definitions.
6. Actual form-control detection, separated from FormXML-only references.
7. Dataverse dependency retrieval through Microsoft dependency APIs.
8. Component-name resolution for several dependency types.
9. Cross-environment source/target comparisons.
10. Deployment readiness classification.
11. UI V4 with expandable groups, compact summary cards, and collapsible technical metadata.

## Current Validated Example

Column: `avanade_serviceprovider` (Service Provider)

- 1 actual form placement
- 2 additional FormXML references
- 2 view references
- 1 business rule reference
- 9 Dataverse dependents
- 1 Dataverse prerequisite

The direct-reference counts and Dataverse dependency counts represent different kinds of evidence and must not be combined.

## Current Development Stage

**UI V4 — Component Intelligence**

The current UI is functional but needs further improvement in readability, navigation, and deployment insights.

### Next Task: UI V4.1

Improve the Column Inspector:

- Place deployment status near the component heading.
- Group Dataverse dependencies by component type.
- Display component names prominently.
- Keep technical IDs collapsed by default.
- Reduce repetitive labels and unnecessary scrolling.
- Preserve the distinction between direct definition references and Dataverse dependencies.
- Keep a polished, modern, compact Chrome side-panel design.
- Preserve all existing functionality and API behavior.

## Known Issues and Future Priorities

1. Resolve remaining generic dependency labels, including Component 36, Chart, and Plug-in Step.
2. Verify relationship schema-name resolution.
3. Fix solution table inventory discrepancies by investigating Dataverse `IsIntersect` metadata. Do not assume this fully explains the discrepancy until verified.
4. Implement stable-identity Release Diff showing Matched, Source Only, Target Only, and Changed components.
5. Improve readiness validation against actual target environments.
6. Extend the V4 visual language across Solution Explorer, Readiness, and comparison screens.

## Important Correctness Rules

- A field name appearing in FormXML does not prove that the field is placed on the form.
- Missing dependencies in the source solution do not automatically mean the target environment lacks those components.
- An unresolved component name is not proof that the component is missing.
- A column can be included through its parent table when subcomponents are included.
- READY means no confirmed blocking prerequisite was detected; it does not mean source and target packages are identical.
- Do not hard-code unknown Dataverse component types without validating their identities.

## Development Instructions

Before changing anything:

1. Inspect the entire existing codebase.
2. Identify the current implementation and relevant functions.
3. Explain the intended changes briefly.
4. Preserve existing functionality and avoid unnecessary refactoring.
5. Make focused changes to the actual project files.
6. Run syntax checks and available tests.
7. Report what changed, what was tested, and what remains unverified.

**Start with UI V4.1 — Dependency Grouping and Deployment Insights. Do not begin unrelated features until this milestone is validated.**

Use the existing UI V4 as the design baseline.

The product should look and behave like a professional Microsoft Power Platform developer tool.
