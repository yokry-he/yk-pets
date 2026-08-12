# yk-3d-pet integration

The 3D pet authoring Skill is maintained in the independent repository:

- Repository: `yokry-he/yk-3d-pet`
- Pinned version and commit: [`source.json`](./source.json)
- YK-PETS integration preset: `yk-pets`

Do not restore a second complete copy under this repository. Update the pinned version deliberately after the independent repository passes its Linux, Windows, and macOS validation.

## Use from a local checkout

```bash
node ../yk-3d-pet/scripts/cli.mjs scaffold \
  --species cloud-cat \
  --name "Luma" \
  --preset yk-pets \
  --output apps/playground/app/components/pets/cloud-cat

node ../yk-3d-pet/scripts/cli.mjs validate \
  --root apps/playground/app/components/pets/cloud-cat
```

## Install Agent adapters into YK-PETS

```bash
node ../yk-3d-pet/scripts/cli.mjs install-adapters --target . --all
```

Generated pets still require repository CI and front/left/back/right WebGL visual acceptance.
