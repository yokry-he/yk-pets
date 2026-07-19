# Read-only DevTools / CDP bridge

`RestrictedCdpClient` binds a session to one tab and origin, validates every command, limits command count and duration, buffers selected diagnostic events, and redacts credentials.

Arbitrary script execution, DOM writes, input synthesis, navigation, downloads, cookies, response bodies, request-header injection, and startup-script injection are permanently denied.
