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
import './EventsTable.css'

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
	relatedActivityId: false,
	channel: false, // Hide channel by default - less critical
	eventData: false // Hide event data - better viewed in detail panel
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
			{
				accessorKey: 'recordId',
				header: 'Record ID',
				size: 90,
				minSize: 90,
				mantineTableBodyCellProps: {fz: 'sm', c: 'dimmed'}
			},
			{
				accessorKey: 'timestamp',
				header: 'Time',
				size: 160,
				minSize: 120,
				mantineTableBodyCellProps: {ff: 'monospace', fz: 'sm'}
			},
			{
				accessorKey: 'level',
				header: 'Level',
				size: 100,
				minSize: 85,
				Cell: ({row}) => (
					<Badge
						color={LEVEL_COLORS[row.original.level] ?? 'gray'}
						size='sm'
						variant='light'
					>
						{row.original.levelText}
					</Badge>
				)
			},
			{
				accessorKey: 'eventId',
				header: 'Event ID',
				size: 85,
				minSize: 90,
				mantineTableBodyCellProps: {fz: 'sm', fw: 500}
			},
			{
				accessorKey: 'provider',
				header: 'Provider',
				size: 200,
				minSize: 120,
				mantineTableBodyCellProps: {fz: 'sm'}
			},
			{
				accessorKey: 'channel',
				header: 'Channel',
				size: 140,
				minSize: 100,
				mantineTableBodyCellProps: {fz: 'sm', c: 'dimmed'}
			},
			{
				accessorKey: 'task',
				header: 'Task',
				size: 80,
				minSize: 70,
				mantineTableBodyCellProps: {fz: 'sm'}
			},
			{
				accessorKey: 'opcode',
				header: 'Opcode',
				size: 90,
				minSize: 90,
				mantineTableBodyCellProps: {fz: 'sm'}
			},
			{
				accessorKey: 'keywords',
				header: 'Keywords',
				size: 140,
				minSize: 100,
				mantineTableBodyCellProps: {ff: 'monospace', fz: 'xs', c: 'dimmed'}
			},
			{
				accessorKey: 'version',
				header: 'Ver',
				size: 60,
				minSize: 50,
				mantineTableBodyCellProps: {fz: 'sm', c: 'dimmed'}
			},
			{
				accessorKey: 'computer',
				header: 'Computer',
				size: 140,
				minSize: 100,
				mantineTableBodyCellProps: {fz: 'sm'}
			},
			{
				accessorKey: 'processId',
				header: 'PID',
				size: 75,
				minSize: 60,
				mantineTableBodyCellProps: {ff: 'monospace', fz: 'xs', c: 'dimmed'}
			},
			{
				accessorKey: 'threadId',
				header: 'TID',
				size: 75,
				minSize: 60,
				mantineTableBodyCellProps: {ff: 'monospace', fz: 'xs', c: 'dimmed'}
			},
			{
				accessorKey: 'securityUserId',
				header: 'User ID',
				size: 180,
				minSize: 100,
				mantineTableBodyCellProps: {ff: 'monospace', fz: 'xs', c: 'dimmed'}
			},
			{
				accessorKey: 'activityId',
				header: 'Activity ID',
				size: 140,
				minSize: 110,
				mantineTableBodyCellProps: {ff: 'monospace', fz: 'xs', c: 'dimmed'}
			},
			{
				accessorKey: 'relatedActivityId',
				header: 'Related Activity',
				size: 140,
				minSize: 130,
				mantineTableBodyCellProps: {ff: 'monospace', fz: 'xs', c: 'dimmed'}
			},
			{
				accessorKey: 'eventData',
				header: 'Event Data',
				size: 250,
				minSize: 120,
				mantineTableBodyCellProps: {
					fz: 'xs',
					c: 'dimmed',
					style: {whiteSpace: 'pre-wrap' as const}
				}
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
			striped: 'odd',
			highlightOnHover: true,
			withTableBorder: true,
			withColumnBorders: false // Remove column borders for cleaner look
		},
		mantineTableHeadCellProps: {
			// Smaller, more compact header styling
			style: {fontSize: '0.8rem'},
			className: 'compact-table-header'
		},
		mantineTableContainerProps: {style: {maxHeight: '600px'}},
		renderDetailPanel: ({row}) => (
			<Code block={true} fz='xs' mah={400} style={{overflow: 'auto'}}>
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
