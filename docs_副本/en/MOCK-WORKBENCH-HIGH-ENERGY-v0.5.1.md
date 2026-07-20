# NOVA v0.5.1: Mock Workbench and High-Energy Motions

## Goals

v0.5.1 completes the rule-creation workflow and adds high-intensity pet motions. Users can Mock endpoints before they exist, generate a rule from a captured request, and use one full-page Side Panel editor for create, edit, duplicate, and from-request flows.

## Mock Workbench

The Network Lab remains a single Side Panel application:

```text
Overview / Requests / Rules
                    ↓
             Full-page editor
                    ↓
             Focused JSON editor
```

Supported flows:

- New manual rule for an arbitrary path or URL.
- Generate from a captured request with prefilled URL, method, status, and preview.
- Edit an existing rule while preserving its ID.
- Duplicate to a new disabled rule to avoid immediate conflicts.

The editor supports scope, priority, Glob/regex URL matching, method, query conditions, full Mock, real-response transforms, delay, JSON/text body, test URL, conflict detection, focused JSON editing, and draft recovery.

A full Mock executes before the real request. When matched, NOVA constructs the Fetch Response or XHR completion and never calls the real endpoint, so undeployed endpoints are supported.

## Patterns and structure

- Factory for manual, from-request, and duplicate creation.
- Strategy for URL, method, query, and transform logic.
- Repository for settings, rules, and drafts.
- Application Service for create/update/duplicate/delete/test orchestration.
- Adapter for page-main-world interception and isolated-world communication.
- Presentation/Composable separation for a maintainable Side Panel UI.

## High-energy motions

- Backflip landing: charge, jump, flip, landing squash, and impact ring.
- Tail tornado: tail charge, sweeping rotation, trail amplification, and settle.
- Diving catch: ball tracking, launch, catch with both paws, and stable landing.
- Energy burst: paw charge, core brightness, multiple energy rings, and recovery.

User-triggered motions have priority. Idle high-energy playback is rare, pauses while busy/menu-open/backgrounded, and degrades under reduced-motion preference.
