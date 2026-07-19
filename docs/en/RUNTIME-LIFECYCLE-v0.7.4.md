# v0.7.4 Runtime lifecycle

The default lifecycle suspends animation when the site is paused, the user pauses manually, the document is hidden, the page is frozen or leaving through `pagehide`, or the pet is outside the viewport. Hidden mode also hides the renderer; an initially hidden site mounts no renderer at all.

Renderers may implement `start`, `stop`, and `setVisible`. `stop` must preserve recoverable scene state, while `dispose` performs final resource cleanup.

`BrowserLifecycleMonitor` binds visibility, freeze/resume, pagehide/pageshow, and intersection signals. Idle prefetch may warm the 3D module without replacing the healthy 2D renderer on failure.
