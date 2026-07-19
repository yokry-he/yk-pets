import {
  ChangeReportBuilder,
  ChromeDebuggerTransport,
  RestrictedCdpClient,
  SourceLocator,
  SourceMapRegistry,
  VerificationRunner,
  type ChromeDebuggerApi,
} from '@yk-pets/pet-platform-adaptive'

export async function analyzeSelectedElement(options: {
  chromeDebugger: ChromeDebuggerApi
  tabId: number
  pageUrl: string
  nodeId: number
}) {
  const origin = new URL(options.pageUrl).origin
  const cdp = new RestrictedCdpClient(
    new ChromeDebuggerTransport(options.chromeDebugger),
    { allowedOrigins: [origin], maxCommands: 50 },
  )
  await cdp.attach({ tabId: options.tabId, origin, url: options.pageUrl })
  try {
    await cdp.enableReadOnlyDomains()
    const element = await cdp.captureElementSnapshot(options.nodeId)

    const maps = new SourceMapRegistry()
    // Register trusted build maps explicitly:
    // maps.register('https://app.example/assets/app.js', appSourceMap)
    const locator = new SourceLocator({ sourceMaps: maps })
    const source = locator.locate({
      descriptor: {
        selector: '#selected-element',
        tagName: 'button',
        classes: [],
        attributes: {},
        nodeId: options.nodeId,
      },
    })

    const verification = new VerificationRunner({ allowedOrigins: [origin] })
    const report = new ChangeReportBuilder({
      project: 'YK Pets host project',
      runId: `analysis-${options.tabId}`,
      targetUrl: options.pageUrl,
      startedAt: Date.now(),
    })
      .addEvent({ at: Date.now(), type: 'analysis', message: 'Captured read-only CDP element snapshot.' })
      .addNote(`CDP snapshot captured: ${Boolean(element.node)}; verification adapter configured: ${Boolean(verification)}`)
      .build()

    return { element, source, report }
  }
  finally {
    await cdp.detach()
  }
}
