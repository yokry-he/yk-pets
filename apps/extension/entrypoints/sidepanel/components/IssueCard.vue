<!--
  文件职责 / File responsibility
  单个审计问题的摘要、定位和操作入口。
  Summary, navigation, and actions for a single audit issue.
-->
<script setup lang="ts">
import type { AuditIssue } from '@nova/shared/audit'

const props = defineProps<{
  issue: AuditIssue
  previewing: boolean
  agentConnected: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  highlight: [issue: AuditIssue]
  preview: [issue: AuditIssue]
  rollbackPreview: [issue: AuditIssue]
  remember: [issue: AuditIssue]
  patch: [issue: AuditIssue]
}>()

const severityLabel = {
  high: '高',
  medium: '中',
  low: '低',
} as const

const categoryLabel: Record<AuditIssue['category'], string> = {
  performance: '性能',
  accessibility: '无障碍',
  seo: 'SEO',
  'best-practice': '最佳实践',
  dom: 'DOM / 结构',
}
</script>

<template>
  <article class="issue-card" :data-severity="issue.severity">
    <header>
      <span class="severity">{{ severityLabel[issue.severity] }}</span>
      <span class="category">{{ categoryLabel[issue.category] }}</span>
      <code>{{ issue.code }}</code>
    </header>
    <h3>{{ issue.title }}</h3>
    <p>{{ issue.description }}</p>
    <div v-if="issue.selector" class="selector">{{ issue.selector }}</div>
    <footer>
      <button type="button" @click="emit('highlight', issue)">定位</button>
      <button
        v-if="issue.preview"
        type="button"
        :class="{ active: previewing }"
        @click="previewing ? emit('rollbackPreview', issue) : emit('preview', issue)"
      >
        {{ previewing ? '撤销预览' : '预览修改' }}
      </button>
      <button type="button" @click="emit('remember', issue)">记住</button>
      <button type="button" :disabled="!agentConnected || busy" @click="emit('patch', issue)">
        源码补丁
      </button>
    </footer>
  </article>
</template>
