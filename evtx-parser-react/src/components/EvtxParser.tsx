import {Container, Stack, Text, Title} from '@mantine/core'
import {Dropzone} from '@mantine/dropzone'
import {useMemo} from 'react'
import {useEvtxParser} from '@/hooks/useEvtxParser'
import {usePagination} from '@/hooks/usePagination'
import {ControlBar} from './ControlBar'
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
		<Container size="md" style={{minHeight: '100vh', padding: '2rem'}}>
			<Stack gap="md" align="center">
				<Title order={1}>EVTX → Raw Byte Dump</Title>

				<Dropzone
					onDrop={(files) => files[0] && parseFile(files[0])}
					accept={['.evtx']}
					disabled={isWorking}
					style={{width: '100%', maxWidth: '700px'}}
				>
					<div style={{textAlign: 'center', padding: '3rem 2rem'}}>
						<Dropzone.Accept>
							<div style={{fontSize: '2.5rem', marginBottom: '0.5rem'}}>📄</div>
							<Text size="md" c="teal">
								Drop file here
							</Text>
						</Dropzone.Accept>
						<Dropzone.Reject>
							<div style={{fontSize: '2.5rem', marginBottom: '0.5rem'}}>❌</div>
							<Text size="md" c="red">
								Only .evtx files allowed
							</Text>
						</Dropzone.Reject>
						<Dropzone.Idle>
							<div style={{fontSize: '2.5rem', marginBottom: '0.5rem'}}>📄</div>
							<Text size="md" c="dimmed">
								Drop an .evtx file here or click to browse
							</Text>
						</Dropzone.Idle>
					</div>
				</Dropzone>

				<Stack gap="md" style={{width: '100%', maxWidth: '700px'}}>
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
				</Stack>
			</Stack>
		</Container>
	)
}
