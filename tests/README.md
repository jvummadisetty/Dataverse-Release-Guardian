# Development checks

The extension remains plain JavaScript with no build step or added runtime dependencies.

Run the dependency-name regression suite with Node:

```sh
node --test tests/dependency-display-names.test.cjs tests/runtime-component-identities.test.cjs tests/release-diff.test.cjs tests/release-diff-review.test.cjs
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

## Release Diff

Reload the unpacked extension **and refresh both Dynamics tabs** after installing this version: the manifest now loads the shared comparison engine and snapshot collector in each authenticated tab. Choose/analyse the source solution, choose a target solution in Readiness, and open Release Diff. Both headers show actual source → target hostnames and solution versions; environment roles are not guessed from names.

Release Diff is read-only and independent of prerequisite readiness. It takes nontransactional live snapshots of each selected solution's membership and current effective definitions, not original exported ZIPs or reconstructed managed layers. It expands include-all table subcomponents and preserves explicit membership. Four tables are processed concurrently per snapshot; IDs are batched and definition fingerprints keep raw XML out of the messaging payload. Failed reads, table shells, unsupported settings, unresolved identities, and ambiguous name-only candidates stay Not compared.

Tables match by logical name, columns by parent table + logical name, forms by unique name or preserved ID, and views by preserved ID. Different-ID forms/views sharing only a display name are not guessed matches. Source only/Target only describe solution membership; neither means absent from the environment nor predicts an import deletion. Changed is a subset of Matched; matching identity is not proof of equality. No covered differences refers only to the properties listed in the UI's scope disclosure.

Regression checks cover stable identities, ambiguous and partial inventories, definition coverage, include-all inheritance, subtype read failures, unsupported attributes, source/target membership, table shells, and bounded concurrency. The browser runner also exercises real FormXML/FetchXML canonicalization and SHA-256 fingerprints through the actual collector, tab state/reset/failure handling, five result categories, escaped names, direction/version labels, and 320/420/700px layouts. No live Dynamics organization was contacted by these tests.

Live smoke check: compare a familiar UAT/PROD solution in Release Diff, verify direction/versions, expand a known changed column/form/view, and confirm one-sided membership against the selected packages. An unreadable definition must never appear as unchanged; switching the source or target must clear the diff. Re-run Readiness separately to check prerequisites.

### Reviewing large diffs

Changed now summarizes Description only, Labels and text only, Settings / structure only, XML only, and Mixed changes. These are property categories, not deployment-risk ratings. Filter by table, component type, changed property, or name/ID search. Group by table, component type, or an exact combination of changed properties so multi-property entries are never duplicated across groups.

Not compared summarizes primary coverage reasons: table shells, unsupported type-specific settings, metadata not returned, incomplete covered definitions, and identity/inventory gaps. Each entry belongs to one primary reason, with source/target coverage details retained when expanded. Old snapshots with combined unsupported/unavailable messages remain in the broader incomplete category instead of guessing a cause. Run a fresh comparison to collect the new structured reason details.

Filtering and grouping run locally against the existing result. They never issue more Dataverse requests or modify readiness, identity matches, definition hashes, category totals, or component IDs. The UI reports shown/filtered/category counts separately and paginates without silently dropping records. Localized label/description previews are displayed as language-tagged text rather than JSON; the hashed definition data is unchanged.

Review tests include 669 changed and 1,320 not-compared fixture entries, disjoint reason/change summaries, combined filters, search focus/caret preservation, pagination, primary-reason grouping, readable previews, and narrow layouts. Those fixture breakdowns are not a diagnosis of a user's live 1,320 entries.

Expanded Release Diff coverage smoke check:
- Reload the extension and refresh both Dynamics tabs. Compare a flow solution: published process XAML/cloud-flow client data is compared by preserved component ID (names alone never pair flows).
- Compare connection-reference logical names and connector definitions. A source-only reference means selected-solution membership differs; use Readiness for target prerequisite checks and verify connection authentication/permissions in the target maker portal.
- Verify web resources and environment-variable definition settings appear. Environment-variable values, connections, credentials and secret values are not collected by the new variable/reference comparisons. Flow/resource payload previews are suppressed.
- Compare a role-only solution: roles must appear under Not compared, with privilege/access-depth coverage explicitly unavailable. No privilege equality is claimed.
- Other inventory component types must remain visible under Not compared, rather than disappearing into zero results. Unsupported definitions are not confirmed missing.
