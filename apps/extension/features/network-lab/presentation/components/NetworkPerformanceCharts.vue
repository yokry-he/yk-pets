<!--
  文件职责 / File responsibility
  将性能分析结果绘制为排行、体积分布和瀑布图。
  Renders performance results as rankings, size distribution, and waterfall charts.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { NetworkEntry, NetworkResourceKind } from '@nova/shared/network'
import type { NetworkResourceAggregate } from '../../application/network-analysis-service'
import { displayName, formatBytes } from '../../application/network-analysis-service'

// 图表组件只接收已聚合数据，不在模板中重新计算领域指标。 / Charts accept pre-aggregated data and do not recompute domain metrics in the template.
const props = defineProps<{
  entries: NetworkEntry[]
  topSlow: NetworkEntry[]
  resources: NetworkResourceAggregate[]
}>()

const maxDuration = computed(() => Math.max(1, ...props.topSlow.map(entry => entry.duration)))
const maxTransfer = computed(() => Math.max(1, ...props.resources.map(resource => resource.transferSize)))
const waterfall = computed(() => {
  const selected = props.entries.slice().sort((left, right) => left.startedAt - right.startedAt).slice(-40)
  const start = Math.min(...selected.map(entry => entry.startedAt), Date.now())
  const end = Math.max(...selected.map(entry => entry.startedAt + entry.duration), start + 1)
  const range = Math.max(1, end - start)
  return selected.map(entry => ({
    entry,
    left: Math.max(0, (entry.startedAt - start) / range * 100),
    width: Math.max(1.4, entry.duration / range * 100),
  }))
})

function resourceLabel(type: NetworkResourceAggregate['type']) {
  const labels: Record<NetworkResourceKind, string> = { fetch: 'Fetch', xhr: 'XHR', script: '脚本', style: '样式', image: '图片', font: '字体', media: '媒体', document: '文档', manifest: 'Manifest', socket: 'Socket', wasm: 'Wasm', other: '其他' }
  return labels[type]
}
</script>

<template>
  <div class="network-charts">
    <section class="chart-card">
      <header><div><span>SLOWEST REQUESTS</span><h3>最慢请求排行</h3></div><small>按总耗时</small></header>
      <div v-if="topSlow.length" class="bar-chart">
        <article v-for="entry in topSlow" :key="entry.id" :title="entry.url">
          <div class="bar-meta"><strong>{{ displayName(entry) }}</strong><span>{{ Math.round(entry.duration) }}ms</span></div>
          <div class="bar-track"><i :style="{ width: `${Math.max(2, entry.duration / maxDuration * 100)}%` }" /></div>
        </article>
      </div>
      <p v-else class="empty-chart">刷新网页后，这里会展示最慢的资源和接口。</p>
    </section>

    <section class="chart-card">
      <header><div><span>RESOURCE DISTRIBUTION</span><h3>资源体积分布</h3></div><small>按传输大小</small></header>
      <div v-if="resources.length" class="resource-chart">
        <article v-for="resource in resources" :key="resource.type">
          <div class="bar-meta"><strong>{{ resourceLabel(resource.type) }}</strong><span>{{ resource.count }} 次 · {{ formatBytes(resource.transferSize) }}</span></div>
          <div class="bar-track"><i :style="{ width: `${Math.max(2, resource.transferSize / maxTransfer * 100)}%` }" /></div>
        </article>
      </div>
      <p v-else class="empty-chart">当前还没有可统计的资源数据。</p>
    </section>

    <section class="chart-card waterfall-card">
      <header><div><span>REQUEST WATERFALL</span><h3>最近请求瀑布</h3></div><small>最多 40 条</small></header>
      <div v-if="waterfall.length" class="waterfall">
        <article v-for="item in waterfall" :key="item.entry.id" :title="`${item.entry.method} ${item.entry.url} · ${Math.round(item.entry.duration)}ms`">
          <span>{{ displayName(item.entry) }}</span>
          <div><i :class="{ error: item.entry.error || (item.entry.status || 0) >= 400, mocked: item.entry.mocked || item.entry.modified }" :style="{ left: `${item.left}%`, width: `${item.width}%` }" /></div>
          <b>{{ Math.round(item.entry.duration) }}ms</b>
        </article>
      </div>
      <p v-else class="empty-chart">暂无请求瀑布数据。</p>
    </section>
  </div>
</template>

<style scoped>
.network-charts { display: grid; gap: 10px; }
.chart-card { min-width: 0; padding: 12px; border: 1px solid #242b45; border-radius: 14px; background: #0a0e1a; }
.chart-card header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.chart-card header span { color: #727b9d; font: 700 8px/1 ui-monospace, monospace; letter-spacing: .12em; }
.chart-card h3 { margin: 5px 0 0; font-size: 12px; }
.chart-card header small { color: #5f6786; font-size: 8px; }
.bar-chart, .resource-chart { display: grid; gap: 9px; }
.bar-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.bar-meta strong { min-width: 0; overflow: hidden; color: #cfd4ed; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.bar-meta span { flex: 0 0 auto; color: #777f9f; font: 8px ui-monospace, monospace; }
.bar-track { height: 6px; overflow: hidden; border-radius: 999px; background: #151b2e; }
.bar-track i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #7066ff, #8d86ff); box-shadow: 0 0 10px rgba(112,102,255,.28); }
.resource-chart .bar-track i { opacity: .72; }
.waterfall { display: grid; gap: 4px; max-height: 270px; overflow-y: auto; }
.waterfall article { display: grid; grid-template-columns: 74px minmax(0,1fr) 44px; align-items: center; gap: 6px; min-height: 20px; }
.waterfall article > span { overflow: hidden; color: #8e96b6; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.waterfall article > div { position: relative; height: 7px; overflow: hidden; border-radius: 999px; background: #12172a; }
.waterfall i { position: absolute; top: 0; bottom: 0; min-width: 3px; border-radius: 999px; background: #7066ff; }
.waterfall i.mocked { background: #9d76ff; box-shadow: 0 0 8px rgba(157,118,255,.45); }
.waterfall i.error { background: #ff6f8f; }
.waterfall b { color: #6f789a; font: 7px ui-monospace, monospace; text-align: right; }
.empty-chart { margin: 0; padding: 18px 6px; color: #69718f; font-size: 9px; line-height: 1.5; text-align: center; }
</style>
