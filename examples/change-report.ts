import { ChangeReportBuilder, renderChangeReportMarkdown } from '@yk-pets/pet-change-report'

const report = new ChangeReportBuilder({
  project: 'Example Vue app',
  runId: 'fix-001',
  startedAt: Date.now(),
})
  .addIssue({
    category: 'accessibility',
    severity: 'high',
    title: 'Icon button has no accessible name',
    description: 'The selected button exposes no name to assistive technology.',
    selector: 'button.save-icon',
    recommendation: 'Add an aria-label or visible text.',
  })
  .addChange({
    file: 'src/components/SaveButton.vue',
    kind: 'modify',
    summary: 'Add localized aria-label.',
    linesAdded: 1,
    rollback: 'Revert the aria-label line.',
  })
  .build()

console.log(renderChangeReportMarkdown(report))
