/**
 * 文件职责 / File responsibility
 * 编排网络规则新增、更新、复制、删除和测试用例。
 * Orchestrates network-rule create, update, duplicate, delete, and test use cases.
 */
import type { NetworkRule } from '@nova/shared/network'
import { cloneNetworkValue } from '../domain/network-value-clone'
import type { NetworkRuleRepository } from '../infrastructure/chrome-network-repository'

/**
 * Application Service / Command Facade：统一保存、删除、启停等用例。
 * Application Service / Command Facade: centralizes save, delete and toggle use cases.
 */
export class NetworkRuleApplicationService {
  constructor(private readonly repository: NetworkRuleRepository) {}

  async save(currentRules: NetworkRule[], rule: NetworkRule): Promise<NetworkRule[]> {
    const nextRules = currentRules.slice()
    const index = nextRules.findIndex(item => item.id === rule.id)
    const now = new Date().toISOString()
    const nextRule = {
      ...cloneNetworkValue(rule),
      updatedAt: now,
      createdAt: rule.createdAt || now,
    }
    if (index >= 0) nextRules.splice(index, 1, nextRule)
    else nextRules.push(nextRule)
    await this.repository.saveRules(nextRules)
    return nextRules
  }

  async remove(currentRules: NetworkRule[], ruleId: string): Promise<NetworkRule[]> {
    const nextRules = currentRules.filter(rule => rule.id !== ruleId)
    await this.repository.saveRules(nextRules)
    return nextRules
  }

  async toggle(currentRules: NetworkRule[], ruleId: string, enabled: boolean): Promise<NetworkRule[]> {
    const rule = currentRules.find(item => item.id === ruleId)
    if (!rule) return currentRules
    return this.save(currentRules, { ...rule, enabled })
  }
}
