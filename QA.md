# Raintrace QA and release handoff

Checked 18 October 2026 UTC / 17 October Colombia. Local prototype; no publication or submission by this agent.

## Completed checks

- Node 24.16.0 on Windows: **18/18 automated tests passed**; see `test-results.txt` and `tests.mjs`. No dependencies installed.
- Six real-source arithmetic comparisons against a separate Python `Decimal` implementation passed. `independent-reference.json` records values and its methodological limits.
- Both original NASA source fingerprints match the catalog; 12,784 records in each 1991–2025 snapshot.
- CLI round-trip: `node verify.mjs example-evidence.json` returns `valid: true`, source Santa Marta, target 662.4 mm, baseline 366.029333 mm, difference 80.969103%.
- Chrome live UI: positive claim; change direction to produce contrary verdict; delete one daily value in explicitly labeled test copy; observe no verdict and disabled export; restore original; verify current report successfully.
- Desktop 1280×900, tablet 768×1024 and mobile 375×812 viewport checks showed no horizontal document overflow. Desktop and full mobile screenshots inspected. Chart rendering was corrected to retain readable text at mobile width; the exact monthly table is also accessible.
- Semantic buttons/selects, explicit labels, visible keyboard focus styles, reduced-motion handling, source limitations adjacent to conclusions, empty/import/error states are present. This is not a formal accessibility certification.
- No account, wallet, AI inference or third-party runtime dependency. Data requests occurred only during preparation (one full-range request per place plus one seven-day dependency probe).

## Still required before submission

1. Independent reviewer should inspect calculation, completeness rules, integrity guarantees and UI claims; author self-review is not independent review.
2. Publish source and static app through the parent's authorized workflow. Verify HTTPS access without login and the same deployed source/data hashes.
3. Record a real 3–5 minute demo following `DEMO.md`, including actual export and file re-import. `example-evidence.json` is a valid fixture and `example-tampered.json` a deliberately altered fixture; label the latter honestly.
4. Parent should test actual browser file selection/download on the deployed site. Current-report browser verification and CLI file verification passed, but this agent has not exercised OS file picking or the final hosting environment.
5. Recheck event registration constraints and terms at the exact submission step, complete the parent-owned Devpost registration and project form, then preserve the receipt. Do not call this entry submitted before that receipt.

## Limits and claims

No real-user study, local-station cross-validation, environmental impact measurement, trustless source authentication, trusted timestamp or on-chain anchoring was performed. The runtime uses deterministic statistics; AI helped author the code but is not presented as an on-device inference engine. The portal's scope is two places and 2021–2025 comparisons against one fixed baseline.

The development server remains bound to `127.0.0.1:4179`; start with `node server.mjs`. For deployment copy the public runtime files listed in README. Retain source snapshots and evidence. Avoid bundling a mutable cache as a fresh live measurement.

