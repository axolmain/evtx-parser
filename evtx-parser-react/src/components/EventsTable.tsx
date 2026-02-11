import {Badge, Code} from '@mantine/core'
import {useLocalStorage} from '@mantine/hooks'
import type {ExpandedState} from '@tanstack/react-table'
import {
	MantineReactTable,
	type MRT_ColumnDef,
	type MRT_VisibilityState,
	useMantineReactTable
} from 'mantine-react-table'
import {useEffect, useMemo, useState} from 'react'
import type {ParsedEventRecord} from '@/parser'

interface Properties {
	records: ParsedEventRecord[]
	selectedRecordId: number | null
}

const LEVEL_COLORS: Record<number, string> = {
	1: 'red', // Critical
	2: 'orange', // Error
	3: 'yellow', // Warning
	4: 'blue', // Information
	5: 'gray' // Verbose
}

const DEFAULT_HIDDEN: MRT_VisibilityState = {
	task: false,
	opcode: false,
	keywords: false,
	version: false,
	computer: false,
	processId: false,
	threadId: false,
	securityUserId: false,
	activityId: false,
	relatedActivityId: false
}

export function EventsTable({records, selectedRecordId}: Properties) {
	const [columnVisibility, setColumnVisibility] =
		useLocalStorage<MRT_VisibilityState>({
			key: 'evtx-column-visibility',
			defaultValue: DEFAULT_HIDDEN
		})
	const [expanded, setExpanded] = useState<ExpandedState>({})

	// Scroll to and expand row when selectedRecordId changes
	useEffect(() => {
		if (selectedRecordId === null || selectedRecordId === undefined) return
		const rowIndex = records.findIndex(r => r.recordId === selectedRecordId)
		if (rowIndex === -1) return
		setExpanded({[rowIndex]: true})
		// Wait for render then scroll to the row
		requestAnimationFrame(() => {
			const tableContainer = document.querySelector(
				'.mrt-table-container, [class*="TableContainer"]'
			)
			const rows = tableContainer?.querySelectorAll('tbody tr')
			if (rows) {
				for (const row of rows) {
					if (row.textContent?.includes(String(selectedRecordId))) {
						row.scrollIntoView({behavior: 'smooth', block: 'center'})
						break
					}
				}
			}
		})
	}, [selectedRecordId, records])

	const columns = useMemo<MRT_ColumnDef<ParsedEventRecord>[]>(
		() => [
			{accessorKey: 'recordId', header: 'Record ID', size: 100},
			{
				accessorKey: 'timestamp',
				header: 'Time Created',
				size: 200,
				mantineTableBodyCellProps: {ff: 'monospace', fz: '0.8rem'}
			},
			{accessorKey: 'provider', header: 'Provider', size: 220},
			{accessorKey: 'eventId', header: 'Event ID', size: 100},
			{
				accessorKey: 'level',
				header: 'Level',
				size: 110,
				Cell: ({row}) => (
					<Badge color={LEVEL_COLORS[row.original.level] ?? 'gray'} size='sm'>
						{row.original.levelText}
					</Badge>
				)
			},
			{accessorKey: 'task', header: 'Task', size: 80},
			{accessorKey: 'opcode', header: 'Opcode', size: 90},
			{
				accessorKey: 'keywords',
				header: 'Keywords',
				size: 140,
				mantineTableBodyCellProps: {ff: 'monospace', fz: '0.8rem'}
			},
			{accessorKey: 'version', header: 'Version', size: 80},
			{accessorKey: 'channel', header: 'Channel', size: 140},
			{accessorKey: 'computer', header: 'Computer', size: 140},
			{accessorKey: 'processId', header: 'Process ID', size: 100},
			{accessorKey: 'threadId', header: 'Thread ID', size: 100},
			{
				accessorKey: 'securityUserId',
				header: 'Security UserID',
				size: 200,
				mantineTableBodyCellProps: {ff: 'monospace', fz: '0.75rem'}
			},
			{
				accessorKey: 'activityId',
				header: 'Activity ID',
				size: 140,
				mantineTableBodyCellProps: {ff: 'monospace', fz: '0.75rem'}
			},
			{
				accessorKey: 'relatedActivityId',
				header: 'Related Activity ID',
				size: 160,
				mantineTableBodyCellProps: {ff: 'monospace', fz: '0.75rem'}
			},
			{
				accessorKey: 'eventData',
				header: 'Event Data',
				size: 300,
				mantineTableBodyCellProps: {style: {whiteSpace: 'pre-wrap' as const}}
			}
		],
		[]
	)

	const table = useMantineReactTable({
		columns,
		data: records,
		enablePagination: false,
		enableGlobalFilter: false,
		enableColumnFilters: false,
		enableColumnOrdering: true,
		enableColumnResizing: true,
		enableStickyHeader: true,
		enableDensityToggle: true,
		enableFullScreenToggle: true,
		state: {columnVisibility, expanded},
		onColumnVisibilityChange: setColumnVisibility,
		onExpandedChange: setExpanded,
		initialState: {density: 'xs'},
		mantineTableProps: {
			striped: true,
			highlightOnHover: true,
			withTableBorder: true,
			withColumnBorders: true
		},
		mantineTableContainerProps: {style: {maxHeight: '600px'}},
		renderDetailPanel: ({row}) => (
			<Code block={true} fz='0.75rem' mah={400} style={{overflow: 'auto'}}>
				{row.original.xml}
			</Code>
		),
		mantineTableBodyRowProps: () => ({
			style: {cursor: 'pointer'}
		})
	})

	if (records.length === 0) {
		return null
	}

	return <MantineReactTable table={table} />
}
