#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RELEASE_PARENT_SHA:?RELEASE_PARENT_SHA is required}"

RELEASE_SHA256='6564cd2c397c307d17425fbabf911231de59fbdb4be546a19c9f1d421865eb53'
RELEASE_BASE_SHA='98ae8357feece1ff502fce1ec33bed98ba99a2d6'
RELEASE_DIR='/tmp/yk-pets-release'
REPORT_DIR='/tmp/yk-pets-release-report'
mkdir -p "$RELEASE_DIR" "$REPORT_DIR"

test "$(git rev-parse HEAD)" = "$RELEASE_PARENT_SHA"
git diff --exit-code "$RELEASE_BASE_SHA" HEAD -- . \
  ':(exclude).github/workflows/agent-export-snapshot.yml' \
  ':(exclude).github/workflows/agent-inspect-blobs.yml' \
  ':(exclude).github/workflows/agent-debug-release.yml' \
  ':(exclude).github/workflows/agent-resume-phases-de.yml' \
  ':(exclude)scripts/agent-publish-de.sh'

python - <<'PY_RELEASE'
import base64
import hashlib
import json
import os
import tarfile
import urllib.request
from pathlib import Path

parts = [
    ('22ac16e805f41a5e4dbfd26240d8f0152d154b73', 10000),
    ('314c0cb3a878741f61ce8f64f2a59c5d658b24dc', 10000),
    ('d18486d5bc96259d6741e24e0bb201f45861c09a', 4000),
    ('b997cf9a42b4e68d9cadb1923c9f5005c329909b', 4000),
    ('b2af1c27142ad16bb603f03621a30a059e00fa1c', 4000),
    ('34762286177f77e56414037ead0477017a18489f', 3000),
    ('6bf5b00a163b5a937e64a3ef56b64155d4fa19cc', 6000),
    ('9b2470b7b8929b18a4a6898ab2b0825af826f241', 6000),
    ('1fd342e0c1ac7768cbf25cd0b02ce23d792a4a3d', 6000),
    ('d36239696b1392f5dc72973d405002d39589e1df', 3000),
    ('6351643c7b2c74a3bc92dc59d776c3b3d95eb9d3', 3000),
    ('bfcfd9a2504cea790acbc2867d00150aea0a33ce', 3000),
    ('40b8619da2609cf835e96b7f1bc503ca65319428', 3000),
    ('047b903d791b9305b0559e0c8e8a22710fb622be', 2000),
    ('24b390af8f379a4c6bea06e4c592ca329f343726', 2000),
    ('bcd9ee2daca7dcfa970ea3e6f15c26f27aa2c29c', 2000),
    ('8dcf4e604a0e6b6d281c638eb0fcc4ff430e3ff7', 2000),
    ('28705d111884d97e0fcfe52c32e0e42cb85f517f', 2000),
    ('b9348142eca9ff34f8c5fb7fd595765a20ed0403', 2000),
    ('5dccecd207456452b7cb5eab532c3d268725e8e5', 2000),
    ('aac1d1566128bfc71ee1e3d5d9b61fb05671d2d4', 2000),
    ('cbdbd098cb838451dd8af9d1a74bf0b92e6f8e18', 2000),
    ('e0dc30bd5aced62e83c130bfc520454501122a6a', 2000),
    ('0b6ba89582abeb4d4aa3e49ffc3278451e5d2bab', 2000),
    ('a02e8e8e92bb06e3f8858598439d8e34887ebfd3', 2000),
    ('d0290f50a85a2c400e6eeb54efea772a932e01db', 2000),
    ('0b8c9b9dc120042d0c07a05df69252a26aae7ae9', 2000),
    ('0106276521819b3be759a7f9a05ab651d1552e3c', 2000),
    ('fd0aaebd9f465826565b3011907a6bc40e1e5f3c', 2000),
    ('0b0dfd1fa655ed4b9c1788ca707bcd7f525bfd63', 2000),
    ('15f4a68024633db29b749bbd9b81eb8d18957039', 2000),
    ('91a3b4448c11823e8ff18f5f615354f8a377b8e7', 2000),
    ('f2441f58431322dbe635fcbec5b1bcca019c8947', 2000),
    ('1870f5d56b352b048958f04a70df83775efd9ad9', 2000),
    ('03071da154b7c9b58c8428434be4060aff96c2d2', 2000),
    ('a9516c0206f37d5b951b48bbfad7f8ab516d007c', 2000),
    ('e80ed31acd09ff23a6f17710a4269e27286c0d70', 2000),
    ('49d60372f7e62013a3e3ea233fd66f9a0d93988d', 1000),
    ('ad2d401458c908afc387be01a0de32e333e739d4', 1000),
    ('435af163e9e5203f758426936cfb6723125986a9', 1000),
    ('91308592bbf6b99cf0b4dfed0d70f0e031df2bd1', 1000),
    ('1f3a3f1636167d8fc9592927fda710318cc0686a', 1000),
    ('29ff5598eb18bb83cb4dae5cebd64b126be751a2', 1000),
    ('240e4cbb83a158361d1db49b713a1c6f260499c8', 1000),
    ('b514c982aa17a06324497d2fe365373ef6ddac64', 1000),
    ('89a0618a540fe74faf7e53dc70bb5e927a22d05d', 1000),
    ('76a91df1a7feba5fae21627376e38ff653f21a89', 1000),
    ('2064f882bc4072db5ab5c63dc382fa1469357144', 1000),
    ('5b9dc25db85a8c75c59cab22bbb1a3dcd0b2d592', 1000),
    ('d6fd6c7dbb5eb3327b0c1e0b1d1c8c2729a64092', 1000),
    ('d9e1e607b1488f82ac3a2dbf2494a2725bce2f70', 1000),
    ('da7f6bc8eba601a099aaa894cb4f9f3f7d5999e9', 930),
]
headers = {
    'Authorization': f"Bearer {os.environ['GH_TOKEN']}",
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
}
archive = bytearray()
repository = os.environ['GITHUB_REPOSITORY']
for index, (sha, expected_size) in enumerate(parts, start=1):
    request = urllib.request.Request(
        f'https://api.github.com/repos/{repository}/git/blobs/{sha}',
        headers=headers,
    )
    with urllib.request.urlopen(request) as response:
        payload = json.load(response)
    chunk = base64.b64decode(payload['content'])
    if len(chunk) != expected_size:
        raise RuntimeError(f'chunk {index} {sha} expected {expected_size} bytes, got {len(chunk)}')
    archive.extend(chunk)
actual = hashlib.sha256(archive).hexdigest()
expected = '6564cd2c397c307d17425fbabf911231de59fbdb4be546a19c9f1d421865eb53'
if len(archive) != 127930 or actual != expected:
    raise RuntimeError(f'release mismatch: bytes={len(archive)} sha256={actual}')
release_dir = Path('/tmp/yk-pets-release')
archive_path = release_dir / 'phases-BE.tar.gz'
archive_path.write_bytes(archive)
with tarfile.open(archive_path, 'r:gz') as bundle:
    names = sorted(bundle.getnames())
    if names != ['phase-B.patch', 'phase-C.patch', 'phase-D.patch', 'phase-E.patch']:
        raise RuntimeError(f'unexpected bundle entries: {names}')
    bundle.extractall(release_dir)
print(f'Reconstructed {len(archive)} bytes with SHA-256 {actual}.')
PY_RELEASE

corepack enable
corepack prepare pnpm@11.13.1 --activate
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
: > "$REPORT_DIR/phase-commits.txt"
printf '%s %s\n' B '9d700572eac9c5acff7fbbf4ae305ecd5974fec5' >> "$REPORT_DIR/phase-commits.txt"
printf '%s %s\n' C "$RELEASE_BASE_SHA" >> "$REPORT_DIR/phase-commits.txt"

validate_phase() {
  local phase="$1"
  echo "::group::Phase $phase dependency install"
  pnpm install --frozen-lockfile
  echo "::endgroup::"
  echo "::group::Phase $phase brand and Studio contracts"
  pnpm check:brand
  pnpm check:cloud-fox-studio
  echo "::endgroup::"
  echo "::group::Phase $phase typecheck"
  pnpm typecheck
  echo "::endgroup::"
  echo "::group::Phase $phase tests"
  pnpm test
  echo "::endgroup::"
  echo "::group::Phase $phase Local Agent and extension build"
  pnpm build
  echo "::endgroup::"
  echo "::group::Phase $phase Playground build"
  pnpm build:playground
  echo "::endgroup::"
  git diff --exit-code
}

push_phase() {
  local phase="$1"
  local expected_remote="$2"
  local current_remote
  current_remote="$(git ls-remote origin refs/heads/agent/cloud-fox-studio-v0610 | cut -f1)"
  test "$current_remote" = "$expected_remote"
  local phase_sha
  phase_sha="$(git rev-parse HEAD)"
  git push origin HEAD:refs/heads/agent/cloud-fox-studio-v0610
  printf '%s %s\n' "$phase" "$phase_sha" | tee -a "$REPORT_DIR/phase-commits.txt"
}

cat > apps/playground/app/components/studio/ExtensionCloudFoxPropInstances.vue <<'EOF_PHASE_C_PROP'
<!--
  文件职责 / File responsibility
  在唯一正式云狐场景中渲染道具事件求值后的本地实例，支持挂点和世界空间而不创建第二个 WebGL 场景。
  Renders locally evaluated prop-event instances inside the sole production Cloud Fox scene, supporting mount and world space without a second WebGL scene.
-->
<script setup lang="ts">
import type { EvaluatedMotionPropInstance, MotionPropMountId } from '@yk-pets/pet-core'
import type { StudioPropAssetMetadata } from '~/domain/studio-workspace'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  instances?: readonly EvaluatedMotionPropInstance[]
  propAssets?: readonly StudioPropAssetMetadata[]
}>()
const assetById = computed(() => new Map((props.propAssets || []).map(asset => [asset.id, asset])))
const particleOffsets = [[-.12,.06,0],[.11,.12,.03],[0,.2,-.04],[-.07,.27,.02],[.09,.32,0],[.02,.4,.04]] as const

function mountPosition(id: MotionPropMountId): readonly [number, number, number] {
  const width = props.appearance.proportions.bodyWidth
  const height = props.appearance.proportions.bodyHeight
  const depth = props.appearance.proportions.bodyDepth
  const map: Record<MotionPropMountId, readonly [number, number, number]> = {
    world: [0, 0, 0], 'pet-root': [0, 0, 0], 'head-top': [0, 1.62 * height, .02], muzzle: [0, 1.04 * height, .72 * depth],
    'left-front-paw': [-.62 * width, .04, .5 * depth], 'right-front-paw': [.62 * width, .04, .5 * depth],
    'left-hind-paw': [-.55 * width, -.72 * height, .22 * depth], 'right-hind-paw': [.55 * width, -.72 * height, .22 * depth], 'tail-tip': [-1.5 * width, .18, -.35 * depth],
  }
  return map[id]
}
function position(instance: EvaluatedMotionPropInstance): readonly [number, number, number] {
  const base = instance.space === 'mount' ? mountPosition(instance.mountId) : [0, 0, 0] as const
  return [base[0] + instance.transform.position[0], base[1] + instance.transform.position[1], base[2] + instance.transform.position[2]]
}
function asset(instance: EvaluatedMotionPropInstance) { return assetById.value.get(instance.propId) }
</script>

<template>
  <TresGroup v-for="instance in instances || []" :key="instance.instanceId" :visible="instance.visible" :position="position(instance)" :rotation="instance.transform.rotation" :scale="instance.transform.scale">
    <template v-if="asset(instance)?.kind === 'effect'">
      <TresMesh><TresIcosahedronGeometry :args="[.2,2]" /><TresMeshStandardMaterial :color="instance.style.color" :emissive="instance.style.color" :emissive-intensity="instance.style.glow" transparent :opacity="instance.style.opacity" /></TresMesh>
      <TresPointLight :color="instance.style.color" :intensity="instance.style.glow * .8" :distance="2" />
      <TresMesh v-for="(offset,index) in particleOffsets.slice(0, Math.ceil(instance.style.particleRate / 40))" :key="index" :position="offset"><TresSphereGeometry :args="[.035,10,10]" /><TresMeshBasicMaterial :color="instance.style.color" transparent :opacity="instance.style.opacity * .7" /></TresMesh>
    </template>
    <template v-else>
      <TresMesh cast-shadow><TresBoxGeometry :args="[.34,.2,.18]" /><TresMeshStandardMaterial :color="instance.style.color" :emissive="instance.style.color" :emissive-intensity="instance.style.glow" :metalness=".2" :roughness=".28" transparent :opacity="instance.style.opacity" /></TresMesh>
      <TresMesh :rotation="[Math.PI/2,0,0]"><TresTorusGeometry :args="[.13,.025,12,24]" /><TresMeshStandardMaterial :color="instance.style.color" :emissive="instance.style.color" :emissive-intensity="instance.style.glow * .5" /></TresMesh>
    </template>
  </TresGroup>
</template>
EOF_PHASE_C_PROP
git add apps/playground/app/components/studio/ExtensionCloudFoxPropInstances.vue
git apply --check "$RELEASE_DIR/phase-D.patch"
git apply --index --whitespace=error-all "$RELEASE_DIR/phase-D.patch"
cp apps/playground/app/components/studio/StudioPropModel.vue /tmp/phase-D-StudioPropModel.vue

python - <<'PY_FIX_D'
from pathlib import Path

path = Path('apps/playground/app/components/studio/ExtensionCloudFoxPropInstances.vue')
source = path.read_text()
replacements = [
    (
        "import type { EvaluatedMotionPropInstance, MotionPropMountId, StudioPropAssetV2 } from '@yk-pets/pet-core'\n",
        "import type { EvaluatedMotionPropInstance, MotionPropMountId, StudioPropAssetV2 } from '@yk-pets/pet-core'\nimport { Euler, Vector3 } from 'three'\n",
    ),
    (
        "function position(instance: EvaluatedMotionPropInstance): readonly [number, number, number] {\n  const base = instance.space === 'mount' ? mountPosition(instance.mountId) : [0, 0, 0] as const\n  return [base[0] + instance.transform.position[0], base[1] + instance.transform.position[1], base[2] + instance.transform.position[2]]\n}\n",
        "function position(instance: EvaluatedMotionPropInstance): Vector3 {\n  const base = instance.space === 'mount' ? mountPosition(instance.mountId) : [0, 0, 0] as const\n  return new Vector3(base[0] + instance.transform.position[0], base[1] + instance.transform.position[1], base[2] + instance.transform.position[2])\n}\nfunction rotation(instance: EvaluatedMotionPropInstance): Euler { return new Euler(...instance.transform.rotation) }\nfunction scaleVector(instance: EvaluatedMotionPropInstance): Vector3 { return new Vector3(...instance.transform.scale) }\n",
    ),
    (
        ':rotation="instance.transform.rotation" :scale="instance.transform.scale"',
        ':rotation="rotation(instance)" :scale="scaleVector(instance)"',
    ),
]
for old, new in replacements:
    if source.count(old) != 1:
        raise RuntimeError(f'phase D prop-instance marker count for {old!r}: {source.count(old)}')
    source = source.replace(old, new, 1)
path.write_text(source)

path = Path('apps/playground/app/components/studio/StudioPropComponentNode.vue')
source = path.read_text()
old = "import type { MotionPropStyle, StudioPropComponent } from '@yk-pets/pet-core'\n"
new = old + "import { Euler, Vector3 } from 'three'\n"
if source.count(old) != 1:
    raise RuntimeError('phase D component import marker mismatch')
source = source.replace(old, new, 1)
old = "const particleOffsets = computed(() => Array.from({ length: Math.min(48, props.component.geometry.particleCount) }, (_, index) => {\n"
new = "function vector(value: readonly [number, number, number]): Vector3 { return new Vector3(...value) }\nfunction rotation(value: readonly [number, number, number]): Euler { return new Euler(...value) }\nfunction crystalScale(): Vector3 { return new Vector3(props.component.geometry.width, props.component.geometry.height, props.component.geometry.depth) }\nfunction textFrontPosition(): Vector3 { return new Vector3(0, 0, Math.min(props.component.geometry.depth, .06) * .55) }\n" + old
if source.count(old) != 1:
    raise RuntimeError('phase D component helper marker mismatch')
source = source.replace(old, new, 1)
replacements = [
    (':position="component.transform.position" :rotation="component.transform.rotation" :scale="component.transform.scale"', ':position="vector(component.transform.position)" :rotation="rotation(component.transform.rotation)" :scale="vector(component.transform.scale)"'),
    (':scale="[component.geometry.width,component.geometry.height,component.geometry.depth]"', ':scale="crystalScale()"'),
    (':position="offset"', ':position="vector(offset)"'),
    (':position="[0,0,Math.min(component.geometry.depth,.06)*.55]"', ':position="textFrontPosition()"'),
]
for old, new in replacements:
    if source.count(old) != 1:
        raise RuntimeError(f'phase D component marker count for {old!r}: {source.count(old)}')
    source = source.replace(old, new, 1)
path.write_text(source)

path = Path('apps/playground/app/components/studio/StudioPropModel.vue')
source = path.read_text()
old = '<script setup lang="ts">\n'
new = old + "import { Euler, Vector3 } from 'three'\n"
if source.count(old) != 1:
    raise RuntimeError('phase D model import marker mismatch')
source = source.replace(old, new, 1)
old = "const modelPosition = computed(() => [-display.value.position[0], -display.value.position[1], -display.value.position[2]] as const)\nconst modelRotation = computed(() => [-display.value.rotation[0], -display.value.rotation[1], -display.value.rotation[2]] as const)\nconst modelScale = computed(() => display.value.scale.map(value => 1 / Math.max(.01, value)) as [number, number, number])"
new = "const modelPosition = computed(() => new Vector3(-display.value.position[0], -display.value.position[1], -display.value.position[2]))\nconst modelRotation = computed(() => new Euler(-display.value.rotation[0], -display.value.rotation[1], -display.value.rotation[2]))\nconst modelScale = computed(() => new Vector3(...display.value.scale.map(value => 1 / Math.max(.01, value)) as [number, number, number]))"
if source.count(old) != 1:
    raise RuntimeError('phase D model transform marker mismatch')
path.write_text(source.replace(old, new, 1))
PY_FIX_D

git add \
  apps/playground/app/components/studio/ExtensionCloudFoxPropInstances.vue \
  apps/playground/app/components/studio/StudioPropComponentNode.vue \
  apps/playground/app/components/studio/StudioPropModel.vue
git diff --cached --check
git commit -m 'feat(props): complete parametric prop entity editor'
validate_phase D
push_phase D "$RELEASE_PARENT_SHA"

cp /tmp/phase-D-StudioPropModel.vue apps/playground/app/components/studio/StudioPropModel.vue
git add apps/playground/app/components/studio/StudioPropModel.vue
git apply --check "$RELEASE_DIR/phase-E.patch"
git apply --index --whitespace=error-all "$RELEASE_DIR/phase-E.patch"

python - <<'PY_FIX_E'
from pathlib import Path

path = Path('apps/playground/app/components/studio/StudioPropModel.vue')
source = path.read_text()
old = '<script setup lang="ts">\n'
new = old + "import { Euler, Vector3 } from 'three'\n"
if source.count(old) != 1:
    raise RuntimeError('phase E model import marker mismatch')
source = source.replace(old, new, 1)
old = "const modelPosition = computed(() => [-display.value.position[0], -display.value.position[1], -display.value.position[2]] as const)\nconst modelRotation = computed(() => [-display.value.rotation[0], -display.value.rotation[1], -display.value.rotation[2]] as const)\nconst modelScale = computed(() => display.value.scale.map(value => 1 / Math.max(.01, value)) as [number, number, number])"
new = "const modelPosition = computed(() => new Vector3(-display.value.position[0], -display.value.position[1], -display.value.position[2]))\nconst modelRotation = computed(() => new Euler(-display.value.rotation[0], -display.value.rotation[1], -display.value.rotation[2]))\nconst modelScale = computed(() => new Vector3(...display.value.scale.map(value => 1 / Math.max(.01, value)) as [number, number, number]))"
if source.count(old) != 1:
    raise RuntimeError('phase E model transform marker mismatch')
path.write_text(source.replace(old, new, 1))

path = Path('apps/playground/app/components/studio/ExtensionCloudFoxMotionGuides.vue')
source = path.read_text()
old = "import type { EvaluatedCloudFoxPose } from '@yk-pets/pet-core'\n"
new = old + "import { Vector3 } from 'three'\n"
if source.count(old) != 1:
    raise RuntimeError('phase E guide import marker mismatch')
source = source.replace(old, new, 1)
old = "function markers(pose:EvaluatedCloudFoxPose){const w=props.appearance.proportions.bodyWidth;const h=props.appearance.proportions.bodyHeight;return[\n  [pose.values['root.position.x'],pose.values['root.position.y'],pose.values['root.position.z']],\n  [pose.values['root.position.x']+pose.values['head.position.x'],pose.values['root.position.y']+1.05*h+pose.values['head.position.y'],pose.values['root.position.z']+pose.values['head.position.z']],\n  [-.62*w+pose.values['frontPaw.left.rotation.z']*.18,-.05+pose.values['root.position.y'],.25],\n  [.62*w-pose.values['frontPaw.right.rotation.z']*.18,-.05+pose.values['root.position.y'],.25],\n] as const}"
new = "function vector(value:readonly [number,number,number]):Vector3{return new Vector3(...value)}\nfunction markers(pose:EvaluatedCloudFoxPose){const w=props.appearance.proportions.bodyWidth;const h=props.appearance.proportions.bodyHeight;return[\n  new Vector3(pose.values['root.position.x'],pose.values['root.position.y'],pose.values['root.position.z']),\n  new Vector3(pose.values['root.position.x']+pose.values['head.position.x'],pose.values['root.position.y']+1.05*h+pose.values['head.position.y'],pose.values['root.position.z']+pose.values['head.position.z']),\n  new Vector3(-.62*w+pose.values['frontPaw.left.rotation.z']*.18,-.05+pose.values['root.position.y'],.25),\n  new Vector3(.62*w-pose.values['frontPaw.right.rotation.z']*.18,-.05+pose.values['root.position.y'],.25),\n]}"
if source.count(old) != 1:
    raise RuntimeError('phase E guide marker block mismatch')
source = source.replace(old, new, 1)
old = ':position="point"><TresSphereGeometry :args="[.025,8,8]"'
new = ':position="vector(point)"><TresSphereGeometry :args="[.025,8,8]"'
if source.count(old) != 1:
    raise RuntimeError('phase E guide path marker mismatch')
path.write_text(source.replace(old, new, 1))
PY_FIX_E

git add \
  apps/playground/app/components/studio/StudioPropModel.vue \
  apps/playground/app/components/studio/ExtensionCloudFoxMotionGuides.vue
git diff --cached --check
git commit -m 'feat(motion): complete advanced animation tools'
validate_phase E
push_phase E "$(awk '$1 == "D" {print $2}' "$REPORT_DIR/phase-commits.txt")"

{
  echo "release_parent=$RELEASE_PARENT_SHA"
  echo "release_head=$(git rev-parse HEAD)"
  cat "$REPORT_DIR/phase-commits.txt"
} | tee "$REPORT_DIR/phase-release-report.txt"
