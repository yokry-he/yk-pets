<!--
  文件职责 / File responsibility
  页面审计、定位和修复能力的回归测试页。
  Regression test page for auditing, navigation, and repairs.
-->
<script setup lang="ts">
useHead({
  // 本页有意不设置 description，供 NOVA 审计演示。 / The description is intentionally omitted for the NOVA audit demo.
  title: 'NOVA Audit Lab',
})

const email = ref('')
</script>

<template>
  <main class="lab-shell">
    <header>
      <NuxtLink to="/">← 返回 NOVA</NuxtLink>
      <span>INTENTIONAL AUDIT FIXTURE</span>
    </header>

    <section class="lab-hero">
      <div>
        <p>NOVA BROWSER AGENT</p>
        <h1>网页审计实验室</h1>
        <h3>这个页面故意保留了一组可检测、可预览、可生成源码补丁的问题。</h3>
      </div>
      <!-- 故意缺少 alt、width、height，方便验证浏览器扩展与本地 Agent。 / Intentionally missing alt, width, and height for extension and Local Agent validation. -->
      <img class="lab-hero-image" src="/audit-lab-hero.png">
    </section>

    <section class="lab-form">
      <h2>测试表单</h2>
      <!-- 故意缺少 label/aria-label。 / Intentionally missing label and aria-label. -->
      <input id="email" v-model="email" name="email" placeholder="you@example.com">
      <!-- 故意只有图标，没有可访问名称。 / Intentionally icon-only with no accessible name. -->
      <button id="send-email" type="button">↗</button>
    </section>

    <section class="lab-duplicates">
      <div id="duplicate-card">重复 ID A</div>
      <div id="duplicate-card">重复 ID B</div>
    </section>

    <section class="lab-below-fold">
      <h2>首屏以下资源</h2>
      <!-- 故意未设置 loading=lazy。 / Intentionally missing loading=lazy. -->
      <img class="lab-gallery-image" src="/audit-lab-hero.png" alt="NOVA 审计实验图">
    </section>
  </main>
</template>

<style scoped>
.lab-shell { min-height: 100vh; padding: 24px; background: #090b14; color: #f0f2ff; }
header { display: flex; justify-content: space-between; color: #7d85aa; font: 12px ui-monospace, monospace; }
header a { color: #76dfd0; }
.lab-hero { max-width: 980px; margin: 80px auto 0; }
.lab-hero p { color: #5fe0cf; letter-spacing: .16em; }
h1 { margin: 12px 0; font-size: clamp(48px, 8vw, 96px); }
h3 { max-width: 720px; color: #9aa2c2; font-weight: 400; line-height: 1.6; }
.lab-hero-image, .lab-gallery-image { width: 100%; margin-top: 38px; border-radius: 24px; display: block; }
.lab-form, .lab-duplicates, .lab-below-fold { max-width: 980px; margin: 120px auto 0; }
.lab-form { display: grid; grid-template-columns: 1fr auto; gap: 12px; }
.lab-form h2 { grid-column: 1 / -1; }
input, button { min-height: 48px; border: 1px solid #303756; border-radius: 12px; background: #111526; color: white; }
input { padding: 0 14px; }
button { width: 52px; cursor: pointer; }
.lab-duplicates { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.lab-duplicates div { padding: 40px; border: 1px solid #303756; border-radius: 18px; }
.lab-below-fold { padding-bottom: 120px; }
</style>
