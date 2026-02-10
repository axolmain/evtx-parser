import {useMemo} from 'react'
import {useEvtxParser} from '@/hooks/useEvtxParser'
import {usePagination} from '@/hooks/usePagination'
import {ControlBar} from './ControlBar'
import {DropZone} from './DropZone'
import {PaginationBar} from './PaginationBar'
import {ProgressBar} from './ProgressBar'
import {StatusMessage} from './StatusMessage'
import {WarningsPanel} from './WarningsPanel'
import {XmlOutput} from './XmlOutput'

type StatusType = 'error' | 'info' | 'success'

const PROGRESS_MAP: Record<string, number> = {
	done: 100,
	parsing: 50,
	reading: 25
}

function getProgress(status: string): number {
	return PROGRESS_MAP[status] ?? 0
}

function getStatusType(
	state: ReturnType<typeof useEvtxParser>['state']
): StatusType {
	if (state.status === 'error') return 'error'
	if (
		state.status === 'done' &&
		state.result.warnings.length === 0 &&
		state.result.tplStats.missingCount === 0
	) {
		return 'success'
	}
	return 'info'
}

function getStatusMessage(
	state: ReturnType<typeof useEvtxParser>['state']
): string {
	if (state.status === 'reading') return 'Reading file...'
	if (state.status === 'parsing') return 'Parsing...'
	if (state.status === 'done')
		return `Parsed ${state.result.totalRecords} event records`
	if (state.status === 'error') return state.error
	return ''
}

function DoneControls({
	state,
	pagination,
	totalRecords
}: {
	pagination: ReturnType<typeof usePagination>
	state: Extract<ReturnType<typeof useEvtxParser>['state'], {status: 'done'}>
	totalRecords: number
}) {
	return (
		<>
			<WarningsPanel warnings={state.result.warnings} />
			<ControlBar
				disabled={false}
				fileName={state.fileName}
				fileSize={state.fileSize}
				numChunks={state.result.numChunks}
				parseTime={state.parseTime}
				totalRecords={state.result.totalRecords}
				tplStats={state.result.tplStats}
				xml={state.result.xml}
			/>
			{pagination.showPagination && (
				<PaginationBar
					currentPage={pagination.currentPage}
					end={pagination.end}
					hasNext={pagination.hasNext}
					hasPrev={pagination.hasPrev}
					onNext={pagination.goNext}
					onPageSizeChange={pagination.changePageSize}
					onPrev={pagination.goPrev}
					pageSize={pagination.pageSize}
					pageSizes={pagination.pageSizes}
					start={pagination.start}
					totalItems={totalRecords}
					totalPages={pagination.totalPages}
				/>
			)}
		</>
	)
}

export function EvtxParser() {
	const {state, parseFile} = useEvtxParser()

	const totalRecords =
		state.status === 'done' ? state.result.recordOutputs.length : 0
	const pagination = usePagination(totalRecords)

	const displayXml = useMemo(() => {
		if (state.status !== 'done') return ''
		const {summary, recordOutputs} = state.result
		const pageRecords = recordOutputs.slice(pagination.start, pagination.end)
		return `${summary}${pageRecords.join('\n\n')}\n\n</Events>`
	}, [state, pagination.start, pagination.end])

	const isWorking = state.status === 'reading' || state.status === 'parsing'

	return (
		<div className='flex min-h-screen flex-col items-center p-8'>
			<h1 className='mb-6 text-2xl text-[#c0c0c0]'>EVTX → Raw Byte Dump</h1>

			<DropZone disabled={isWorking} onFile={parseFile} />

			<div className='mt-6 w-full max-w-[700px] space-y-4'>
				<ProgressBar progress={getProgress(state.status)} />
				<StatusMessage
					message={getStatusMessage(state)}
					type={getStatusType(state)}
				/>

				{state.status === 'done' && (
					<DoneControls
						pagination={pagination}
						state={state}
						totalRecords={totalRecords}
					/>
				)}

				<XmlOutput value={displayXml} />
			</div>
		</div>
	)
}
