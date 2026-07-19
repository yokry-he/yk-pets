# YK Pets v0.7.5 Validation

- 13 TypeScript packages built successfully.
- 144/144 automated tests passed, including 56 new v0.7.5 tests.
- ESM, declarations, source maps, and declaration maps emitted for all packages.
- 13 npm tarballs produced.
- Fresh offline installation passed.
- 13/13 umbrella exports resolved.
- Installation audit reported 0 vulnerabilities.
- Browser extension baseline remains 0.6.10.

The release validates adapter contracts and simulated host flows. It does not claim a real-site Lighthouse or Playwright run because the source bundle does not include the user's original browser extension runtime, target site, Chrome debugging authorization, or browser/CI binaries.

The v0.7.4 to v0.7.5 Git patch passed `git apply --check`, and the patched filtered tree matched the filtered v0.7.5 source tree byte-for-byte. No source files are deleted by this release.
