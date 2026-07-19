import { VerificationRunner } from '@yk-pets/pet-verification-runner'

// Lighthouse and Playwright adapters are implemented by the extension host or CI process.
const runner = new VerificationRunner({ allowedOrigins: ['https://app.example'] })
const plan = {
  lighthouse: true,
  scenarios: [{
    id: 'save-profile',
    title: 'Save profile',
    steps: [
      { action: 'click' as const, selector: '#save' },
      { action: 'expect-text' as const, selector: '[role="status"]', text: 'Saved' },
    ],
  }],
}

console.log({ runner, plan })
