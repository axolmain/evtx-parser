import {Badge, Code} from '@mantine/core'

import {
	MantineReactTable,
	type MRT_ColumnDef,
	type MRT_VisibilityState,
	useMantineReactTable
} from 'mantine-react-table'
import {useEffect, useMemo} from 'react'
import type {ParsedEventRecord} from '@/parser'

interface Properties {
	records: ParsedEventRecord[]
	selectedRecordId: number | null
}

const LEVEL_COLORS: Record<number, string> = {
	0: 'violet',
	1: 'red',
	2: 'orange',
	3: 'yellow',
	4: 'blue',
	5: 'gray'
}

const DEFAULT_HIDDEN: MRT_VisibilityState = {
	recordId: false,
	eventId: false,
	channel: false,
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

const mono = {ff: 'monospace', fz: 'xs', c: 'dimmed'} as const
const dim = {fz: 'sm', c: 'dimmed'} as const
const sm = {fz: 'sm'} as const

const col = (
	accessorKey: keyof ParsedEventRecord & string,
	header: string,
	cellProps: Record<string, unknown> = sm,
	extra?: Partial<MRT_ColumnDef<ParsedEventRecord>>
): MRT_ColumnDef<ParsedEventRecord> =>
	({
		accessorKey,
		header,
		mantineTableBodyCellProps: cellProps,
		...extra
	}) as MRT_ColumnDef<ParsedEventRecord>

export function EventsTable({records, selectedRecordId}: Properties) {
	const columns = useMemo<MRT_ColumnDef<ParsedEventRecord>[]>(
		() => [
			col('recordId', 'Record ID', dim, {enableColumnFilter: false}),
			col(
				'timestamp',
				'Time',
				{ff: 'monospace', fz: 'sm'},
				{enableColumnFilter: false}
			),
			{
				accessorKey: 'levelText',
				header: 'Level',
				filterVariant: 'multi-select',
				sortingFn: (a, b) => a.original.level - b.original.level,
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
			col(
				'eventId',
				'Event ID',
				{fz: 'sm', fw: 500},
				{filterVariant: 'multi-select'}
			),
			col('provider', 'Provider', sm, {filterVariant: 'multi-select'}),
			col('channel', 'Channel', dim, {filterVariant: 'multi-select'}),
			col('task', 'Task'),
			col('opcode', 'Opcode'),
			col('keywords', 'Keywords', mono),
			col('version', 'Ver', dim),
			col('computer', 'Computer', sm, {filterVariant: 'multi-select'}),
			col('processId', 'PID', mono),
			col('threadId', 'TID', mono),
			col('securityUserId', 'User ID', mono),
			col('activityId', 'Activity ID', mono),
			col('relatedActivityId', 'Related Activity', mono),
			col(
				'eventData',
				'Event Data',
				{
					fz: 'xs',
					c: 'dimmed',
					style: {whiteSpace: 'pre-wrap' as const, maxWidth: 400}
				},
				{size: 400, enableColumnFilter: false}
			)
		],
		[]
	)

	const table = useMantineReactTable({
		columns,
		data: records,
		enableFacetedValues: true,
		enableColumnResizing: true,
		enableDensityToggle: true,
		enableFullScreenToggle: true,
		paginationDisplayMode: 'pages',
		mantinePaginationProps: {radius: 'md', size: 'sm'},
		initialState: {
			density: 'xs',
			showGlobalFilter: true,
			columnVisibility: DEFAULT_HIDDEN
		},
		mantineSearchTextInputProps: {placeholder: 'Search events...'},
		mantinePaperProps: {
			style: {
				width: '100%',
				height: '100%'
			}
		},
		mantineTableProps: {
			striped: 'odd',
			highlightOnHover: true,
			withTableBorder: true
		},
		mantineTableHeadCellProps: {
			style: {fontSize: '0.8rem', whiteSpace: 'nowrap'},
			className: 'compact-table-header'
		},
		mantineTableBodyCellProps: {style: {whiteSpace: 'nowrap'}},
		mantineTableContainerProps: {style: {maxHeight: '600px'}},
		renderDetailPanel: ({row}) => (
			<Code block={true} fz='xs' mah={400} style={{overflow: 'auto'}}>
				{row.original.xml}
			</Code>
		),
		mantineTableBodyRowProps: {style: {cursor: 'pointer'}}
	})

	useEffect(() => {
		if (selectedRecordId === null) return
		const rowIndex = records.findIndex(r => r.recordId === selectedRecordId)
		if (rowIndex === -1) return
		table.setExpanded({[rowIndex]: true})
		requestAnimationFrame(() => {
			document
				.querySelector(`[data-index="${rowIndex}"]`)
				?.scrollIntoView({behavior: 'smooth', block: 'center'})
		})
	}, [selectedRecordId, records, table.setExpanded])

	if (records.length === 0) return null

	return <MantineReactTable table={table} />
}
