# Developer Maintenance and Code Comment Guide

## 1. Goal

A new maintainer should quickly understand a file's architectural layer, the purpose of each major block, non-obvious constraints, security/compatibility boundaries, and required validation.

Comments do not need to repeat every line, but every major module and non-obvious logic block should be explained.

## 2. Layers

```text
Domain          Pure rules, entities, and value objects
Application     Use-case orchestration independent of UI
Infrastructure  Chrome, DOM, WebSocket, and file-system adapters
Presentation    Vue pages, components, and composables
Shared          Cross-package protocols and data structures
```

Dependencies point inward. Domain code must not depend on Vue, Chrome APIs, or the DOM.

## 3. File headers

Every handwritten source file should contain a bilingual responsibility header. Vue files should document state and responsibilities after `<script setup>`, while major template regions use bilingual HTML comments.

## 4. Block comments

Add comments around state definitions, lifecycles/listeners, matching and sorting, cross-world messaging, sanitization, animation phases, recovery paths, file writes and hash protection, complex template regions, and large CSS sections.

Explain why rather than restating syntax.

## 5. Vue and CSS

Use template comments such as:

```vue
<!-- Current site and master switch / 当前网站与总开关 -->
```

Use CSS section comments for top status areas, request waterfalls, editors, and responsive behavior.

## 6. Change workflow

Identify the affected layer, update domain/application logic before adapters and UI, update both language documents, refresh comments, add validation, and run all checks.

## 7. Required commands

```bash
pnpm check:bilingual
pnpm typecheck
pnpm test
pnpm test:network-domain
pnpm test:network-workbench
pnpm build:extension
```

## 8. Review checklist

- [ ] File responsibility is clear.
- [ ] Every major block has a bilingual explanation.
- [ ] Comments explain intent and constraints.
- [ ] Chinese and English are semantically aligned.
- [ ] Comments are current.
- [ ] Domain code has no infrastructure dependency.
- [ ] Network master-switch and sensitive-data boundaries remain intact.
- [ ] User documentation is updated.

## 9. Documentation responsibilities and naming

- `README.en.md` provides product positioning, quick start, and primary navigation.
- `TECH-STACK.md` explains dependency purpose, version baselines, and selection boundaries.
- `ARCHITECTURE.md` explains modules, dependency direction, and data flow.
- `DEVELOPMENT.md` defines commands, change locations, and the validation matrix.
- `PROJECT-STATUS.md` tracks completed, incomplete, and next-phase work.
- Feature guides remain focused on their feature, data, operations, or acceptance criteria.

Chinese documents under `docs/zh-CN/` use Chinese filenames; ADRs retain their four-digit number and use a Chinese topic. English documents retain English filenames under `docs/en/`. Register new bilingual pairs in `scripts/check-documentation.mjs` and add them to `docs/README.md`.

Document renames must update README files, internal links, focused scripts, `.ai` state, and session handoff. Run:

```bash
pnpm check:documentation
```

The gate validates Chinese filenames, required sections, and local Markdown links. Do not retain empty legacy shells to hide broken references.

## 10. Technology-stack changes

Framework upgrades, new production dependencies, or build-tool changes require synchronized review of affected manifests, `pnpm-lock.yaml`, Node/pnpm baselines, `TECH-STACK.md`, architecture boundaries, development and release commands, type checks, tests, production builds, and real-browser acceptance.

A version-only edit without behavior, typing, bundle, and browser-compatibility verification is not a completed stack upgrade.
