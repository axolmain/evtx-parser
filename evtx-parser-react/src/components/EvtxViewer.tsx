import { Button, Divider, Group, Stack, Text } from '@mantine/core'
import { IconLayoutList, IconTable } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import type { EvtxParseResult } from '@/parser'
import { useEvtxParser } from '@/hooks/useEvtxParser'
import { usePagination } from '@/hooks/usePagination'
import { CopyButton } from './CopyButton'
import { DownloadButton } from './DownloadButton'
import { EventFilters } from './EventFilters'
import { EventSummary } from './EventSummary'
import { EventViewer } from './EventViewer'
import { EventsTable } from './EventsTable'
import { PaginationBar } from './PaginationBar'
import { ProgressBar } from './ProgressBar'
import { StatsDisplay } from './StatsDisplay'
import { StatusMessage } from './StatusMessage'
import { WarningsPanel } from './WarningsPanel'

interface EvtxViewerProps {
	file?: File
	parsedResult?: EvtxParseResult
	fileName?: string
	fileSize?: number
	parseTime?: number
	onParseComplete?: (result: EvtxParseResult, fileName: string) => void
}

type StatusType = 'error' | 'info' | 'success'

const PROGRESS_MAP: Record<string, number> = {
	done: 100,
	parsing: 50,
	reading: 25,
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

export function EvtxViewer({
	file,
	parsedResult,
	fileName: propFileName,
	fileSize: propFileSize,
	parseTime: propParseTime,
	onParseComplete,
}: EvtxViewerProps) {
	const { state, parseFile } = useEvtxParser()
	const [viewMode, setViewMode] = useState<ViewMode>('viewer')
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3, 4, 5])

	// Determine if we're using pre-parsed results or parsing a file
	const isParsedMode = parsedResult !== undefined

	// Auto-parse file when prop changes (only in file mode)
	useEffect(() => {
		if (file && !isParsedMode) {
			parseFile(file)
		}
	}, [file, isParsedMode, parseFile])

	// Call onParseComplete callback when parsing is done
	useEffect(() => {
		if (state.status === 'done' && onParseComplete && !isParsedMode) {
			onParseComplete(state.result, state.fileName)
		}
	}, [state, onParseComplete, isParsedMode])

	// Use either parsed result or state result
	const effectiveState = isParsedMode
		? {
				status: 'done' as const,
				result: parsedResult,
				fileName: propFileName || 'unknown',
				fileSize: propFileSize || 0,
				parseTime: propParseTime || 0,
		  }
		: state

	// Filter records based on search and level filters
	const filteredRecords = useMemo(() => {
		if (effectiveState.status !== 'done') return []

		let filtered = effectiveState.result.records

		// Filter by level
		filtered = filtered.filter((r) => selectedLevels.includes(r.level))

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			filtered = filtered.filter(
				(r) =>
					r.eventData?.toLowerCase().includes(query) ||
					r.provider.toLowerCase().includes(query) ||
					r.eventId.toLowerCase().includes(query) ||
					r.computer.toLowerCase().includes(query) ||
					r.channel.toLowerCase().includes(query)
			)
		}

		return filtered
	}, [effectiveState, searchQuery, selectedLevels])

	// Calculate level counts for all records (before filtering)
	const levelCounts = useMemo(() => {
		if (effectiveState.status !== 'done') return {}
		const counts: Record<number, number> = {}
		for (const record of effectiveState.result.records) {
			counts[record.level] = (counts[record.level] || 0) + 1
		}
		return counts
	}, [effectiveState])

	const totalRecords = filteredRecords.length
	const pagination = usePagination(totalRecords)

	const displayRecords = useMemo(() => {
		return filteredRecords.slice(pagination.start, pagination.end)
	}, [filteredRecords, pagination.start, pagination.end])

	return (
		<Stack gap="md" align="center">
			{!isParsedMode && <ProgressBar progress={getProgress(effectiveState.status)} />}
			{!isParsedMode && (
				<StatusMessage
					message={getStatusMessage(effectiveState)}
					type={getStatusType(effectiveState)}
				/>
			)}

			{effectiveState.status === 'done' && (
				<>
					{/* Summary Bar */}
					<EventSummary records={effectiveState.result.records} />

					<Divider style={{ width: '100%' }} />

					{/* Search and Filters */}
					<Group justify="space-between" style={{ width: '100%' }}>
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
					<Group gap="sm" style={{ width: '100%' }}>
						<WarningsPanel warnings={effectiveState.result.warnings} />
						<CopyButton disabled={false} text={effectiveState.result.xml} />
						<DownloadButton
							disabled={false}
							fileName={effectiveState.fileName}
							text={effectiveState.result.xml}
						/>
						<Text size="sm" c="dimmed" ml="auto">
							Showing {displayRecords.length} of {filteredRecords.length} events
						</Text>
					</Group>

					<Divider style={{ width: '100%' }} />

					{/* Viewer/Table Content */}
					{viewMode === 'viewer' && <EventViewer records={displayRecords} />}
					{viewMode === 'table' && <EventsTable records={displayRecords} />}

					{/* Stats and Pagination Row */}
					<Group justify="space-between" style={{ width: '100%' }}>
						<StatsDisplay
							fileSize={effectiveState.fileSize}
							numChunks={effectiveState.result.numChunks}
							parseTime={effectiveState.parseTime}
							totalRecords={effectiveState.result.totalRecords}
							tplStats={effectiveState.result.tplStats}
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
	)
}
