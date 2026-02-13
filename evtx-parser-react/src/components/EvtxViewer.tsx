import {Button, Divider, Group, Stack, Text} from '@mantine/core'
import {IconLayoutList, IconTable} from '@tabler/icons-react'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useEvtxParser} from '@/hooks/useEvtxParser'
import {usePagination} from '@/hooks/usePagination'
import type {EvtxParseResult, ParsedEventRecord} from '@/parser'
import {CopyButton} from './CopyButton'
import {DownloadButton} from './DownloadButton'
import {EventFilters} from './EventFilters'
import {EventSummary} from './EventSummary'
import {EventsTable} from './EventsTable'
import {EventViewer} from './EventViewer'
import {PaginationBar} from './PaginationBar'
import {ProgressBar} from './ProgressBar'
import {StatsDisplay} from './StatsDisplay'
import {StatusMessage} from './StatusMessage'
import {WarningsPanel} from './WarningsPanel'

interface EvtxViewerProps {
	file?: File
	parsedResult?: EvtxParseResult
	fileName?: string
	fileSize?: number
	parseTime?: number
	onParseComplete?: (result: EvtxParseResult, fileName: string) => void
	selectedRecordId: number | null
}

type StatusType = 'error' | 'info' | 'success'
type ViewMode = 'viewer' | 'table'

export function EvtxViewer({
	file,
	parsedResult,
	fileName: propFileName,
	fileSize: propFileSize,
	parseTime: propParseTime,
	onParseComplete,
	selectedRecordId,
}: EvtxViewerProps) {
	const {state, records: parserRecords, recordCount: parserRecordCount, parseFile} = useEvtxParser()
	const [viewMode, setViewMode] = useState<ViewMode>('viewer')
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedLevels, setSelectedLevels] = useState<number[]>([
		0, 1, 2, 3, 4, 5
	])

	const isParsedMode = parsedResult !== undefined

	useEffect(() => {
		if (file && !isParsedMode) {
			parseFile(file)
		}
	}, [file, isParsedMode, parseFile])

	// Fire onParseComplete once when parsing finishes (not on every state change)
	const notifiedRef = useRef(false)
	useEffect(() => {
		if (state.status === 'done' && onParseComplete && !isParsedMode && !notifiedRef.current) {
			notifiedRef.current = true
			onParseComplete(state.result, state.fileName)
		}
	}, [state.status, state.result, state.fileName, onParseComplete, isParsedMode])

	const records: ParsedEventRecord[] = isParsedMode
		? parsedResult.records
		: parserRecords
	const recordCount = isParsedMode ? parsedResult.records.length : parserRecordCount

	const result: EvtxParseResult | null = isParsedMode
		? parsedResult
		: state.status === 'done' ? state.result : null
	const effectiveFileName = isParsedMode ? (propFileName || 'unknown') : (state.status === 'done' ? state.fileName : '')
	const effectiveFileSize = isParsedMode ? (propFileSize || 0) : (state.status === 'done' ? state.fileSize : 0)
	const effectiveParseTime = isParsedMode ? (propParseTime || 0) : (state.status === 'done' ? state.parseTime : 0)
	const isDone = isParsedMode || state.status === 'done'
	const hasRecords = recordCount > 0

	const progress =
		state.status === 'reading' ? 5
		: state.status === 'parsing' ? 5 + state.progress * 90
		: state.status === 'done' ? 100
		: 0

	const statusMessage =
		state.status === 'reading' ? 'Reading file...'
		: state.status === 'parsing' ? `Parsing... ${state.recordCount.toLocaleString()} records`
		: state.status === 'done' ? `Parsed ${state.result.totalRecords.toLocaleString()} event records`
		: state.status === 'error' ? state.error
		: ''

	const statusType: StatusType =
		state.status === 'error' ? 'error'
		: state.status === 'done' && state.result.warnings.length === 0 && state.result.tplStats.missingCount === 0 ? 'success'
		: 'info'

	const buildXml = useCallback(() => {
		if (records.length === 0) return ''
		let xml = '<?xml version="1.0" encoding="utf-8"?>\n<Events>\n'
		for (const r of records) {
			xml += r.xml + '\n\n'
		}
		xml += '</Events>'
		return xml
	}, [records])

	// eslint-disable-next-line react-hooks/exhaustive-deps -- recordCount tracks mutation of records ref
	const filteredRecords = useMemo(() => {
		const t0 = performance.now()
		if (records.length === 0) return records

		const levelsSet = new Set(selectedLevels)
		let filtered = records.filter(r => levelsSet.has(r.level))

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			filtered = filtered.filter(
				r =>
					r.eventData?.toLowerCase().includes(query) ||
					r.provider.toLowerCase().includes(query) ||
					r.eventId.toLowerCase().includes(query) ||
					r.computer.toLowerCase().includes(query) ||
					r.channel.toLowerCase().includes(query)
			)
		}

		console.log(`[render] filteredRecords: ${records.length} → ${filtered.length} in ${(performance.now() - t0).toFixed(1)}ms`)
		return filtered
	}, [records, recordCount, searchQuery, selectedLevels])

	// eslint-disable-next-line react-hooks/exhaustive-deps -- recordCount tracks mutation of records ref
	const levelCounts = useMemo(() => {
		const t0 = performance.now()
		const counts: Record<number, number> = {}
		for (const record of records) {
			counts[record.level] = (counts[record.level] || 0) + 1
		}
		console.log(`[render] levelCounts: ${records.length} records in ${(performance.now() - t0).toFixed(1)}ms`)
		return counts
	}, [records, recordCount])

	const totalRecords = filteredRecords.length
	const pagination = usePagination(totalRecords)

	const displayRecords = useMemo(
		() => filteredRecords.slice(pagination.start, pagination.end),
		[filteredRecords, pagination.start, pagination.end]
	)

	// Render timing — fires after React commits to DOM
	useEffect(() => {
		console.log(`[render] EvtxViewer committed — ${recordCount} records, isDone=${isDone}`)
	})

	return (
		<Stack align='center' gap='md'>
			{!isParsedMode && state.status !== 'idle' && (
				<ProgressBar progress={progress} />
			)}
			{!isParsedMode && statusMessage && (
				<StatusMessage
					message={statusMessage}
					type={statusType}
				/>
			)}

			{hasRecords && (
				<>
					<EventSummary records={records} />

					<Divider style={{width: '100%'}} />

					<Group justify='space-between' style={{width: '100%'}}>
						<EventFilters
							levelCounts={levelCounts}
							onLevelsChange={setSelectedLevels}
							onSearchChange={setSearchQuery}
							searchQuery={searchQuery}
							selectedLevels={selectedLevels}
						/>

						<Group gap='sm'>
							<Button
								leftSection={<IconLayoutList size={18} />}
								onClick={() => setViewMode('viewer')}
								size='sm'
								variant={viewMode === 'viewer' ? 'filled' : 'default'}
							>
								Viewer
							</Button>
							<Button
								leftSection={<IconTable size={18} />}
								onClick={() => setViewMode('table')}
								size='sm'
								variant={viewMode === 'table' ? 'filled' : 'default'}
							>
								Table
							</Button>
						</Group>
					</Group>

					{isDone && result && (
						<Group gap='sm' style={{width: '100%'}}>
							<WarningsPanel warnings={result.warnings} />
							<CopyButton disabled={false} getText={buildXml} />
							<DownloadButton
								disabled={false}
								fileName={effectiveFileName}
								getText={buildXml}
							/>
							<Text c='dimmed' ml='auto' size='sm'>
								{filteredRecords.length} of {records.length} events
							</Text>
						</Group>
					)}

					<Divider style={{width: '100%'}} />

					{viewMode === 'viewer' && (
						<EventViewer
							records={displayRecords}
							selectedRecordId={selectedRecordId}
						/>
					)}
					{viewMode === 'table' && (
						<EventsTable
							records={filteredRecords}
							selectedRecordId={selectedRecordId}
						/>
					)}

					<Group justify='space-between' style={{width: '100%'}}>
						{isDone && result && (
							<StatsDisplay
								fileSize={effectiveFileSize}
								numChunks={result.numChunks}
								parseTime={effectiveParseTime}
								totalRecords={result.totalRecords}
								tplStats={result.tplStats}
							/>
						)}
						{viewMode === 'viewer' && pagination.showPagination && (
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
