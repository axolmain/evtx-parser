import {Button, Container, Divider, Group, Stack, Text, Title} from '@mantine/core'
import {Dropzone} from '@mantine/dropzone'
import {IconLayoutList, IconTable} from '@tabler/icons-react'
import {useMemo, useState} from 'react'
import {useEvtxParser} from '@/hooks/useEvtxParser'
import {usePagination} from '@/hooks/usePagination'
import {CopyButton} from './CopyButton'
import {DownloadButton} from './DownloadButton'
import {EventFilters} from './EventFilters'
import {EventSummary} from './EventSummary'
import {EventViewer} from './EventViewer'
import {EventsTable} from './EventsTable'
import {PaginationBar} from './PaginationBar'
import {ProgressBar} from './ProgressBar'
import {StatsDisplay} from './StatsDisplay'
import {StatusMessage} from './StatusMessage'
import {WarningsPanel} from './WarningsPanel'

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


type ViewMode = 'viewer' | 'table'

export function EvtxParser() {
	const {state, parseFile} = useEvtxParser()
	const [viewMode, setViewMode] = useState<ViewMode>('viewer')
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3, 4, 5])

	// Filter records based on search and level filters
	const filteredRecords = useMemo(() => {
		if (state.status !== 'done') return []

		let filtered = state.result.records

		// Filter by level
		filtered = filtered.filter(r => selectedLevels.includes(r.level))

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			filtered = filtered.filter(r =>
				r.eventData?.toLowerCase().includes(query) ||
				r.provider.toLowerCase().includes(query) ||
				r.eventId.toLowerCase().includes(query) ||
				r.computer.toLowerCase().includes(query) ||
				r.channel.toLowerCase().includes(query)
			)
		}

		return filtered
	}, [state, searchQuery, selectedLevels])

	// Calculate level counts for all records (before filtering)
	const levelCounts = useMemo(() => {
		if (state.status !== 'done') return {}
		const counts: Record<number, number> = {}
		for (const record of state.result.records) {
			counts[record.level] = (counts[record.level] || 0) + 1
		}
		return counts
	}, [state])

	const totalRecords = filteredRecords.length
	const pagination = usePagination(totalRecords)

	const displayRecords = useMemo(() => {
		return filteredRecords.slice(pagination.start, pagination.end)
	}, [filteredRecords, pagination.start, pagination.end])

	const isWorking = state.status === 'reading' || state.status === 'parsing'

	return (
		<Container size="xl" style={{minHeight: '100vh', padding: '2rem'}}>
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

				<Stack gap="md" style={{width: '100%'}} align="center">
					<ProgressBar progress={getProgress(state.status)} />
					<StatusMessage
						message={getStatusMessage(state)}
						type={getStatusType(state)}
					/>

					{state.status === 'done' && (
						<>
							{/* Summary Bar */}
							<EventSummary records={state.result.records} />

							<Divider style={{width: '100%'}} />

							{/* Search and Filters */}
							<Group justify="space-between" style={{width: '100%'}}>
								<EventFilters
									searchQuery={searchQuery}
									onSearchChange={setSearchQuery}
									selectedLevels={selectedLevels}
									onLevelsChange={setSelectedLevels}
									levelCounts={levelCounts}
								/>

								<Group gap="sm">
									<Button
										variant={viewMode === 'viewer' ? 'filled' : 'default'}
										leftSection={<IconLayoutList size={18} />}
										onClick={() => setViewMode('viewer')}
										size="sm"
									>
										Viewer
									</Button>
									<Button
										variant={viewMode === 'table' ? 'filled' : 'default'}
										leftSection={<IconTable size={18} />}
										onClick={() => setViewMode('table')}
										size="sm"
									>
										Table
									</Button>
								</Group>
							</Group>

							{/* Actions Row */}
							<Group gap="sm" style={{width: '100%'}}>
								<WarningsPanel warnings={state.result.warnings} />
								<CopyButton disabled={false} text={state.result.xml} />
								<DownloadButton disabled={false} fileName={state.fileName} text={state.result.xml} />
								<Text size="sm" c="dimmed" ml="auto">
									Showing {displayRecords.length} of {filteredRecords.length} events
								</Text>
							</Group>

							<Divider style={{width: '100%'}} />

							{/* Viewer/Table Content */}
							{viewMode === 'viewer' && <EventViewer records={displayRecords} />}
							{viewMode === 'table' && <EventsTable records={displayRecords} />}

							{/* Stats and Pagination Row */}
							<Group justify="space-between" style={{width: '100%'}}>
								<StatsDisplay
									fileSize={state.fileSize}
									numChunks={state.result.numChunks}
									parseTime={state.parseTime}
									totalRecords={state.result.totalRecords}
									tplStats={state.result.tplStats}
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
							</Group>
						</>
					)}
				</Stack>
			</Stack>
		</Container>
	)
}
