import {Badge, Button, Checkbox, Code, Collapse, Group, Popover, ScrollArea, Stack, Table} from '@mantine/core'
import {useLocalStorage} from '@mantine/hooks'
import {useEffect, useRef, useState} from 'react'
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

interface ColumnConfig {
	key: keyof ParsedEventRecord | 'expand'
	label: string
	defaultVisible: boolean
}

const ALL_COLUMNS: ColumnConfig[] = [
	{key: 'recordId', label: 'Record ID', defaultVisible: true},
	{key: 'timestamp', label: 'Time Created', defaultVisible: true},
	{key: 'provider', label: 'Provider', defaultVisible: true},
	{key: 'eventId', label: 'Event ID', defaultVisible: true},
	{key: 'level', label: 'Level', defaultVisible: true},
	{key: 'task', label: 'Task', defaultVisible: false},
	{key: 'opcode', label: 'Opcode', defaultVisible: false},
	{key: 'keywords', label: 'Keywords', defaultVisible: false},
	{key: 'version', label: 'Version', defaultVisible: false},
	{key: 'channel', label: 'Channel', defaultVisible: true},
	{key: 'computer', label: 'Computer', defaultVisible: false},
	{key: 'processId', label: 'Process ID', defaultVisible: false},
	{key: 'threadId', label: 'Thread ID', defaultVisible: false},
	{key: 'securityUserId', label: 'Security UserID', defaultVisible: false},
	{key: 'activityId', label: 'Activity ID', defaultVisible: false},
	{key: 'relatedActivityId', label: 'Related Activity ID', defaultVisible: false},
	{key: 'eventData', label: 'Event Data', defaultVisible: true}
]

const DEFAULT_VISIBLE: (keyof ParsedEventRecord | "expand")[] = ALL_COLUMNS.filter((col: ColumnConfig) => col.defaultVisible).map((col: ColumnConfig) => col.key)

export function EventsTable({records, selectedRecordId}: Properties) {
	const [expandedRow, setExpandedRow] = useState<number | null>(null)
	const [visibleColumns, setVisibleColumns] = useLocalStorage<string[]>({
		key: 'evtx-visible-columns',
		defaultValue: DEFAULT_VISIBLE
	})
	const [popoverOpened, setPopoverOpened] = useState(false)
	const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())

	// Scroll to and expand row when selectedRecordId changes
	useEffect(() => {
		if (selectedRecordId !== null && selectedRecordId !== undefined) {
			setExpandedRow(selectedRecordId)
			// Scroll to the row
			const element = rowRefs.current.get(selectedRecordId)
			if (element) {
				element.scrollIntoView({ behavior: 'smooth', block: 'center' })
			}
		}
	}, [selectedRecordId])

	const toggleColumn = (columnKey: string) => {
		setVisibleColumns(prev =>
			prev.includes(columnKey)
				? prev.filter(k => k !== columnKey)
				: [...prev, columnKey]
		)
	}

	const isColumnVisible = (columnKey: string) => visibleColumns.includes(columnKey)

	if (records.length === 0) {
		return null
	}

	const visibleColumnCount = visibleColumns.length

	return (
		<Stack gap="sm" w="100%">
			<Group justify="flex-end">
				<Popover opened={popoverOpened} onChange={setPopoverOpened} width={300} position="bottom-end">
					<Popover.Target>
						<Button size="sm" variant="default" onClick={() => setPopoverOpened(o => !o)}>
							Choose Columns
						</Button>
					</Popover.Target>
					<Popover.Dropdown>
						<Stack gap="xs">
							{ALL_COLUMNS.map(col => (
								<Checkbox
									key={col.key}
									label={col.label}
									checked={isColumnVisible(col.key)}
									onChange={() => toggleColumn(col.key)}
								/>
							))}
						</Stack>
					</Popover.Dropdown>
				</Popover>
			</Group>

			<ScrollArea w="100%" h={600}>
				<Table striped highlightOnHover withTableBorder withColumnBorders stickyHeader>
					<Table.Thead>
						<Table.Tr>
							{isColumnVisible('recordId') && <Table.Th miw={80}>Record ID</Table.Th>}
							{isColumnVisible('timestamp') && <Table.Th miw={180}>Time Created</Table.Th>}
							{isColumnVisible('provider') && <Table.Th miw={200}>Provider</Table.Th>}
							{isColumnVisible('eventId') && <Table.Th miw={80}>Event ID</Table.Th>}
							{isColumnVisible('level') && <Table.Th miw={100}>Level</Table.Th>}
							{isColumnVisible('task') && <Table.Th miw={60}>Task</Table.Th>}
							{isColumnVisible('opcode') && <Table.Th miw={70}>Opcode</Table.Th>}
							{isColumnVisible('keywords') && <Table.Th miw={120}>Keywords</Table.Th>}
							{isColumnVisible('version') && <Table.Th miw={60}>Version</Table.Th>}
							{isColumnVisible('channel') && <Table.Th miw={120}>Channel</Table.Th>}
							{isColumnVisible('computer') && <Table.Th miw={120}>Computer</Table.Th>}
							{isColumnVisible('processId') && <Table.Th miw={80}>Process ID</Table.Th>}
							{isColumnVisible('threadId') && <Table.Th miw={80}>Thread ID</Table.Th>}
							{isColumnVisible('securityUserId') && <Table.Th miw={180}>Security UserID</Table.Th>}
							{isColumnVisible('activityId') && <Table.Th miw={120}>Activity ID</Table.Th>}
							{isColumnVisible('relatedActivityId') && <Table.Th miw={120}>Related Activity ID</Table.Th>}
							{isColumnVisible('eventData') && <Table.Th miw={200}>Event Data</Table.Th>}
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{records.map((record) => (
							<>
								<Table.Tr
									key={record.recordId}
									ref={(el) => {
										if (el) {
											rowRefs.current.set(record.recordId, el)
										} else {
											rowRefs.current.delete(record.recordId)
										}
									}}
									onClick={() =>
										setExpandedRow(expandedRow === record.recordId ? null : record.recordId)
									}
									style={{cursor: 'pointer'}}
								>
									{isColumnVisible('recordId') && <Table.Td>{record.recordId}</Table.Td>}
									{isColumnVisible('timestamp') && (
										<Table.Td ff="monospace" fz="0.8rem">
											{record.timestamp}
										</Table.Td>
									)}
									{isColumnVisible('provider') && <Table.Td fz="0.85rem">{record.provider}</Table.Td>}
									{isColumnVisible('eventId') && <Table.Td>{record.eventId}</Table.Td>}
									{isColumnVisible('level') && (
										<Table.Td>
											<Badge color={LEVEL_COLORS[record.level] ?? 'gray'} size="sm">
												{record.levelText}
											</Badge>
										</Table.Td>
									)}
									{isColumnVisible('task') && <Table.Td>{record.task}</Table.Td>}
									{isColumnVisible('opcode') && <Table.Td>{record.opcode}</Table.Td>}
									{isColumnVisible('keywords') && (
										<Table.Td ff="monospace" fz="0.8rem">
											{record.keywords}
										</Table.Td>
									)}
									{isColumnVisible('version') && <Table.Td>{record.version}</Table.Td>}
									{isColumnVisible('channel') && <Table.Td>{record.channel}</Table.Td>}
									{isColumnVisible('computer') && <Table.Td>{record.computer}</Table.Td>}
									{isColumnVisible('processId') && <Table.Td>{record.processId}</Table.Td>}
									{isColumnVisible('threadId') && <Table.Td>{record.threadId}</Table.Td>}
									{isColumnVisible('securityUserId') && (
										<Table.Td ff="monospace" fz="0.75rem">
											{record.securityUserId}
										</Table.Td>
									)}
									{isColumnVisible('activityId') && (
										<Table.Td ff="monospace" fz="0.75rem">
											{record.activityId}
										</Table.Td>
									)}
									{isColumnVisible('relatedActivityId') && (
										<Table.Td ff="monospace" fz="0.75rem">
											{record.relatedActivityId}
										</Table.Td>
									)}
									{isColumnVisible('eventData') && (
										<Table.Td style={{whiteSpace: 'pre-wrap'}}>
											{record.eventData}
										</Table.Td>
									)}
								</Table.Tr>
								{expandedRow === record.recordId && (
									<Table.Tr key={`${record.recordId}-expanded`}>
										<Table.Td colSpan={visibleColumnCount} p={0}>
											<Collapse in={expandedRow === record.recordId}>
												<Code block m="1rem" fz="0.75rem" mah={400} style={{overflow: 'auto'}}>
													{record.xml}
												</Code>
											</Collapse>
										</Table.Td>
									</Table.Tr>
								)}
							</>
						))}
					</Table.Tbody>
				</Table>
			</ScrollArea>
		</Stack>
	)
}
