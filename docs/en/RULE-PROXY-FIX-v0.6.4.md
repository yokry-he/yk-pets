# NOVA v0.6.4: Nested Rule-Editor Proxy Fix

## Root cause

The Side Panel stores the pending rule in Vue reactive navigation state. The rule, its `action`, and other child structures can become separate nested proxies. v0.6.3 only attempted to unwrap the editor's top-level value, so a nested proxy could still reach `structuredClone` and fail while opening the editor.

## Fix

- Added `cloneNetworkValue`, which clones rules and drafts through JSON serialization and recursively unwraps proxies at every depth.
- The rule factory, application service, draft repository, matcher, Network Lab navigation, and editor now use the same safe clone path.
- No Network Lab business source directly calls `structuredClone` anymore.
- The stale hard-coded `0.5.0` Side Panel footer now displays the actual `0.6.4` version.

## Regression strategy

The new test no longer passes a plain object directly to the editor. It builds parent-component reactive navigation state with nested proxies, first proves native `structuredClone` fails on that input, and then verifies both manual and request-derived rules can open, validate, and build saveable results.
