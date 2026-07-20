/**
 * 文件职责 / File responsibility
 * 集中定义 YK-PETS 品牌与宠物身份，明确区分产品品牌、宠物物种和宠物名字。
 * Centralizes the YK-PETS brand and pet identity, keeping product brand, species, and pet name distinct.
 */

export interface LocalizedLabel {
  'zh-CN': string
  en: string
}

export interface PetIdentity {
  /** Stable identity used by storage, events, and future multi-pet registries. */
  id: string
  /** Stable species key; it must not be derived from the pet's display name. */
  speciesId: string
  species: LocalizedLabel
  name: LocalizedLabel
}

export const YK_PETS_BRAND = Object.freeze({
  id: 'yk-pets',
  name: 'YK-PETS',
  productName: 'YK-PETS Browser Agent',
  storagePrefix: 'yk-pets',
  legacyStoragePrefix: 'nova',
})

/**
 * 当前默认宠物：物种是云狐，名字是云灵，英文名为 Zeph。
 * Current default pet: species Cloud Fox, named 云灵 / Zeph.
 */
export const ZEPH_CLOUD_FOX_IDENTITY: Readonly<PetIdentity> = Object.freeze({
  id: 'zeph',
  speciesId: 'cloud-fox',
  species: Object.freeze({
    'zh-CN': '云狐',
    en: 'Cloud Fox',
  }),
  name: Object.freeze({
    'zh-CN': '云灵',
    en: 'Zeph',
  }),
})

export function resolvePetIdentity(identity?: PetIdentity): Readonly<PetIdentity> {
  return identity || ZEPH_CLOUD_FOX_IDENTITY
}

export function formatPetName(identity: PetIdentity = ZEPH_CLOUD_FOX_IDENTITY, locale: 'zh-CN' | 'en' = 'zh-CN') {
  return identity.name[locale]
}

export function formatPetIdentity(identity: PetIdentity = ZEPH_CLOUD_FOX_IDENTITY, locale: 'zh-CN' | 'en' = 'zh-CN') {
  return `${identity.name[locale]} · ${identity.species[locale]}`
}
