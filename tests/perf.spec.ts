import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {expect, test } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, 'data')
const TRACE_DIR = path.resolve(__dirname, 'traces')

const TEST_FILES = [
	{name: 'Cadwell.evtx', type: 'evtx'},
	{name: 'Application.evtx', type: 'evtx'},
	{name: 'ForSeb.evtx', type: 'evtx'},
	{name: 'System.evtx', type: 'evtx'},
	{name: 'MHXPS01 2026-02-09.sysinfozip.zip', type: 'zip'},
]

// Only chromium supports CDP tracing
test.describe('Performance profiling', () => {
	test.beforeAll(() => {
		fs.mkdirSync(TRACE_DIR, {recursive: true})
	})

	for (const file of TEST_FILES) {
		const filePath = path.join(DATA_DIR, file.name)
		if (!fs.existsSync(filePath)) continue

		test(`profile: ${file.name}`, async ({page}) => {
			test.setTimeout(120_000)
			const cdp = await page.context().newCDPSession(page)

			await page.goto('/')
			await page.waitForLoadState('networkidle')

			// Start CDP trace
			await cdp.send('Tracing.start', {
				categories: [
					'devtools.timeline',
					'v8.execute',
					'disabled-by-default-devtools.timeline',
					'disabled-by-default-v8.cpu_profiler',
				].join(','),
				transferMode: 'ReturnAsStream',
			})

			// Mark start and upload
			await page.evaluate(() => performance.mark('upload-start'))
			const input = page.locator('input[type="file"]')
			await input.setInputFiles(filePath)

			if (file.type === 'zip') {
				await page.waitForURL(/\/archive\//, {timeout: 60_000})
				await page.waitForLoadState('networkidle')
				// Wait for file list to render
				await page.waitForSelector('table tbody tr, a[href*="file="]', {timeout: 30_000}).catch(() => {})
				await page.waitForTimeout(2000)
			} else {
				await page.waitForURL(/\/archive\//, {timeout: 60_000})
				// Wait for events table to render rows
				await page.waitForSelector('table tbody tr', {timeout: 30_000}).catch(() => {})
				await page.waitForTimeout(1000)
			}

			// Mark end and measure
			const totalMs = await page.evaluate(() => {
				performance.mark('render-done')
				performance.measure('upload-to-render', 'upload-start', 'render-done')
				return performance.getEntriesByName('upload-to-render')[0]?.duration
			})

			// Stop trace and read stream
			const streamPromise = new Promise<string>(resolve => {
				cdp.on('Tracing.tracingComplete', (p: {stream?: string}) => resolve(p.stream ?? ''))
			})
			await cdp.send('Tracing.end')
			const streamHandle = await streamPromise

			const chunks: string[] = []
			if (streamHandle) {
				let eof = false
				while (!eof) {
					const r = await cdp.send('IO.read', {handle: streamHandle})
					chunks.push(r.data)
					eof = r.eof
				}
				await cdp.send('IO.close', {handle: streamHandle})
			}

			// Save trace file (loadable in chrome://tracing or DevTools Performance tab)
			const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
			const tracePath = path.join(TRACE_DIR, `${safeName}.trace.json`)
			fs.writeFileSync(tracePath, chunks.join(''))

			// Analyze trace: extract key durations from trace events
			const traceData = JSON.parse(chunks.join(''))
			const events = traceData.traceEvents ?? traceData
			const summary = analyzeTrace(events)

			// Report
			const _sizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2)
			if (summary.scriptingMs > 0)
			if (summary.longTasks.length > 0) {
				for (const _lt of summary.longTasks.slice(0, 5)) {
				}
				if (summary.longTasks.length > 5)
			}

			expect(totalMs).toBeGreaterThan(0)
		})
	}
})

interface LongTask {
	name: string
	dur: number // ms
}

interface TraceSummary {
	scriptingMs: number
	longTasks: LongTask[]
}

function analyzeTrace(events: {ph?: string; cat?: string; name?: string; dur?: number; ts?: number}[]): TraceSummary {
	let scriptingUs = 0
	const longTasks: LongTask[] = []

	for (const e of events) {
		if (!(e.dur && e.name)) continue
		const durMs = e.dur / 1000

		// Collect long tasks (>50ms) from the main thread
		if (e.ph === 'X' && durMs > 50 && (e.cat?.includes('devtools.timeline') || e.cat?.includes('v8'))) {
				longTasks.push({name: e.name, dur: durMs})
			}

		// Sum scripting time
		if (e.ph === 'X' && (e.name === 'EvaluateScript' || e.name === 'v8.compile' || e.name === 'FunctionCall')) {
			scriptingUs += e.dur
		}
	}

	longTasks.sort((a, b) => b.dur - a.dur)

	return {
		scriptingMs: scriptingUs / 1000,
		longTasks,
	}
}
