# v0.7.4 Browser extension integration

Keep the content bootstrap small. Ship Canvas 2D as the immediate renderer, and split Three.js/TresJS, audit collection, and optional Agent tools into separate dynamic modules.

Create `ExtensionPetRuntime` with a 2D factory plus dynamic 3D and audit loaders, call `start`, and attach browser lifecycle signals. The fixed command protocol supports status, policy refresh, manual pause, site policy changes, renderer selection, and audit execution without reflective method access or arbitrary command execution.

Call `navigate(location.href)` after SPA route changes. The stable browser extension reference remains `0.6.10` while this SDK integration is validated.
