# Background / CI Workspace Host v0.7.6

The fixed protocol exposes only revision, read, CAS write, and CAS delete. It has no shell, dynamic method, arbitrary script, generic filesystem, or path traversal command. Every request passes a host authorization callback and is bound to one project ID.
