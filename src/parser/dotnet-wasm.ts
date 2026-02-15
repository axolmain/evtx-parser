import type {EvtxParseResult, ParsedEventRecord} from './types'

interface DotnetExports {
	EvtxParserWasm: {
		Browser: {
			EvtxInterop: {
				ParseEvtxToJson: (data: Uint8Array) => string
			}
		}
	}
}

interface DotnetRuntime {
	getAssemblyExports: (assemblyName: string) => Promise<DotnetExports>
	getConfig: () => {mainAssemblyName: string}
	runMain: () => Promise<void>
}

let runtimePromise: Promise<DotnetRuntime> | null = null

async function getRuntime(): Promise<DotnetRuntime> {
	if (!runtimePromise) {
		runtimePromise = (async () => {
			// @ts-expect-error — loaded from _framework at runtime
			const {dotnet} = await import('/_framework/dotnet.js')
			const runtime = await dotnet.create()
			await runtime.runMain()
			return runtime as DotnetRuntime
		})()
	}
	return runtimePromise
}

export async function parseEvtxWasm(
	buffer: ArrayBuffer,
	onBatch?: (records: ParsedEventRecord[], progress: number) => void
): Promise<EvtxParseResult> {
	const runtime = await getRuntime()
	const exports = await runtime.getAssemblyExports(
		runtime.getConfig().mainAssemblyName
	)

	const json = exports.EvtxParserWasm.Browser.EvtxInterop.ParseEvtxToJson(
		new Uint8Array(buffer)
	)
	const parsed = JSON.parse(json) as {
		totalRecords: number
		numChunks: number
		records: ParsedEventRecord[]
		warnings: string[]
	}

	// Deliver all records as a single batch
	if (onBatch) {
		onBatch(parsed.records, 1)
	}

	return {
		records: parsed.records,
		totalRecords: parsed.totalRecords,
		numChunks: parsed.numChunks,
		warnings: parsed.warnings,
		tplStats: {
			definitionCount: 0,
			referenceCount: 0,
			missingCount: 0,
			parseErrorCount: 0
		}
	}
}
