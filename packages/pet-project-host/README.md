# @yk-pets/pet-project-host

A fixed `yk-pets.workspace-host/v1` request protocol for extension Background and CI/local-agent transports. Only revision, read, compare-and-swap write, and compare-and-swap delete commands exist. Every host request passes an explicit authorization callback; unknown commands, oversized content, path traversal, project mismatches, malformed responses, timeouts, and aborts are rejected.
