# YK-PETS Brand and Pet Identity

## 1. Three separate concepts

Starting from the `v0.6.10` platform branch, YK-PETS explicitly separates:

| Concept | Current value | Stable ID |
|---|---|---|
| Product brand | YK-PETS | `yk-pets` |
| Pet species | Cloud Fox / 云狐 | `cloud-fox` |
| Pet name | Zeph / 云灵 | `zeph` |

The product brand does not change when the pet changes. Future releases can add new species, multiple named pets of one species, or pet switching without another product rename.

## 2. Shared domain model

`packages/shared/src/brand.ts` is the single source of truth for brand and pet identity:

```ts
interface PetIdentity {
  id: string
  speciesId: string
  species: { 'zh-CN': string; en: string }
  name: { 'zh-CN': string; en: string }
}
```

The current default is `ZEPH_CLOUD_FOX_IDENTITY`.

## 3. Naming rules

- Product UI, the extension manifest, documentation, and the primary CLI use `YK-PETS`.
- Refer to the pet as “Zeph（云灵）” and to the species as “Cloud Fox（云狐）”.
- Do not use the product brand as the pet's name.
- Species-specific motions may exist, but core state and product protocols must not depend on a particular pet name.

## 4. v0.6.10 compatibility boundary

To avoid breaking upgrades, these legacy technical identifiers remain for one compatibility cycle:

- deprecated `Nova*` TypeScript aliases;
- existing `NOVA_*` wire-message values;
- the private `@nova/*` workspace scope;
- bidirectional mirroring between `nova:*` and `yk-pets:*` storage keys;
- migration from `.nova/agent.json` to `.yk-pets/agent.json`;
- `nova-agent` as a temporary alias for `yk-pets-agent`.

These are compatibility details, not user-facing branding, and new features must not extend them.

## 5. New-pet requirements

A new pet must declare at least:

1. stable pet and species IDs;
2. localized species and pet names;
3. supported generic states and motion capabilities;
4. fallbacks for unsupported motions;
5. lazy-loading entry points for assets, voices, and renderers.
