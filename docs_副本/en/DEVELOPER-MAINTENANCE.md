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
