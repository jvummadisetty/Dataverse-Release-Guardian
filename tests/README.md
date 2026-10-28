# Development checks

The extension remains plain JavaScript with no build step or added runtime dependencies.

Run the dependency-name regression suite with Node:

```sh
node --test tests/dependency-display-names.test.cjs tests/runtime-component-identities.test.cjs
```

Run the guided UI checks with Playwright and Chromium installed in your development environment:

```sh
node tests/workflow.browser.cjs
```

The browser runner defaults to `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installed binary. It serves the actual extension HTML, scripts, and styles on a temporary loopback port and mocks Chrome messaging and Dynamics responses. It does not contact a live Dataverse organization.

The UI checks cover automatic setup, loading and analysis navigation, error recovery, source-tab pinning, target selection and retries, stale-response handling, READY/REVIEW/BLOCKED presentation, evidence tabs, solution changes, source-analysis failure, unique DOM IDs, and layouts at 320, 420, and 700 pixels. Test screenshots are written under `/tmp`.

For a live smoke check, reload the unpacked extension and refresh the authenticated Dynamics DEV tab. Choose a solution, analyse it, open a component, and switch between Definition references and Dataverse graph. Open an authenticated target environment in another tab, select it in Readiness, and run the check. Verify the source and target shown are correct. Changing either selection must clear the previous target result. The splash and author credit should behave as before.

Readiness clarity checks also reproduce 344 prerequisites (335 verified and 9 unverified), assert a single findings list and hidden duplicate summary, verify collapsed technical coverage, exercise all 335 verified entries through pagination, and check the result layout at narrow and wide widths. Unverified types retain their technical IDs and are never relabeled as confirmed missing.

Runtime component identity tests cover the reported types 10078, 10252, 10254, 10255, 10256, and 10302 as fixtures, not fixed mappings. Discovery uses each organization's filtered EntityDefinitions/ObjectTypeCode metadata, exact record IDs, and Solution Component Configuration registrations. UAT table/type codes are discovered independently by logical name. Changed-ID matches require a matching active unique key in both organizations; display names alone are never match keys. Zero visible records or denied access remain unverified because custom table row security can hide records.

Metadata references: [Microsoft Solution Component Configuration reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/solutioncomponentconfiguration), [Microsoft entity reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/entity). Runtime mappings and the actual nine component names still require an authenticated live DEV/target check; fixture tests do not establish those names.
