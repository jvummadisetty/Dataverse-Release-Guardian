# Dynamics Release Guardian — team demo

## Prepare

1. Reload the extension at `chrome://extensions` and refresh the source and destination Dynamics tabs.
2. Open the panel: verify the light splash and header show Dynamics Release Guardian without author attribution.
3. Choose a familiar source solution. Keep the matching destination solution available in the other tab.
4. Check the panel at a narrow width and a wider presentation width. Confirm keyboard focus remains visible.

## Walkthrough

- **Setup:** automatic environment detection and solution selection; Analyse opens Overview.
- **Overview:** component counts and analysis status.
- **Explore:** open a table/column; inspect deployment analysis, definition references and Dataverse dependencies separately. Check connection-reference counts for a Processes solution.
- **Release Diff:** choose the destination; run comparison; demonstrate search, table/type filters, changed properties and expandable evidence. Show why unsupported entries remain Not compared.
- **Readiness:** run the target check; explain Verified, Not verified and Confirmed missing. Expand an unresolved finding and its technical evidence.

## Explain the scope accurately

This demo uses live environment definitions and prerequisite evidence. Matched identities do not imply identical definitions. Source/target-only means selected-solution membership, not environment-wide absence or deletion predictions. Connection-reference identity is separate from connection authentication. Security-role privileges are not yet compared. Managed-layer conflicts, upgrade deletions and guaranteed import success are not covered by READY.

The automated browser checks use mocked Dynamics data. Validate the intended source/destination pair in your authenticated tabs before the presentation.
