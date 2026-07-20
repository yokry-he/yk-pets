/**
 * 文件职责 / File responsibility
 * 为网络实验室提供可复制 Vue Proxy 的 JSON 数据克隆。
 * Provides JSON-data cloning that safely accepts Vue proxies in Network Lab.
 */

/**
 * 网络规则和草稿都是 JSON 数据；序列化克隆可递归解除任意层级的响应式 Proxy。
 * Network rules and drafts are JSON data; serialization recursively unwraps reactive proxies at any depth.
 */
export function cloneNetworkValue<T>(value: T): T {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value)) as T
}
