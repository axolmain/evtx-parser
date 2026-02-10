import {Badge, Button, Checkbox, Code, Collapse, Group, Popover, ScrollArea, Stack, Table} from '@mantine/core'
import {useLocalStorage} from '@mantine/hooks'
import {useState} from 'react'
import type {ParsedEventRecord} from '@/parser'

interface Properties {
	records: ParsedEventRecord[]
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

export function EventsTable({records}: Properties) {
	const [expandedRow, setExpandedRow] = useState<number | null>(null)
	const [visibleColumns, setVisibleColumns] = useLocalStorage<string[]>({
		key: 'evtx-visible-columns',
		defaultValue: DEFAULT_VISIBLE
	})
	const [popoverOpened, setPopoverOpened] = useState(false)

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
		<Stack gap="sm" style={{width: '100%'}}>
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

			<ScrollArea style={{width: '100%', height: '600px'}}>
				<Table striped highlightOnHover withTableBorder withColumnBorders stickyHeader>
					<Table.Thead>
						<Table.Tr>
							{isColumnVisible('recordId') && <Table.Th style={{minWidth: '80px'}}>Record ID</Table.Th>}
							{isColumnVisible('timestamp') && <Table.Th style={{minWidth: '180px'}}>Time Created</Table.Th>}
							{isColumnVisible('provider') && <Table.Th style={{minWidth: '200px'}}>Provider</Table.Th>}
							{isColumnVisible('eventId') && <Table.Th style={{minWidth: '80px'}}>Event ID</Table.Th>}
							{isColumnVisible('level') && <Table.Th style={{minWidth: '100px'}}>Level</Table.Th>}
							{isColumnVisible('task') && <Table.Th style={{minWidth: '60px'}}>Task</Table.Th>}
							{isColumnVisible('opcode') && <Table.Th style={{minWidth: '70px'}}>Opcode</Table.Th>}
							{isColumnVisible('keywords') && <Table.Th style={{minWidth: '120px'}}>Keywords</Table.Th>}
							{isColumnVisible('version') && <Table.Th style={{minWidth: '60px'}}>Version</Table.Th>}
							{isColumnVisible('channel') && <Table.Th style={{minWidth: '120px'}}>Channel</Table.Th>}
							{isColumnVisible('computer') && <Table.Th style={{minWidth: '120px'}}>Computer</Table.Th>}
							{isColumnVisible('processId') && <Table.Th style={{minWidth: '80px'}}>Process ID</Table.Th>}
							{isColumnVisible('threadId') && <Table.Th style={{minWidth: '80px'}}>Thread ID</Table.Th>}
							{isColumnVisible('securityUserId') && <Table.Th style={{minWidth: '180px'}}>Security UserID</Table.Th>}
							{isColumnVisible('activityId') && <Table.Th style={{minWidth: '120px'}}>Activity ID</Table.Th>}
							{isColumnVisible('relatedActivityId') && <Table.Th style={{minWidth: '120px'}}>Related Activity ID</Table.Th>}
							{isColumnVisible('eventData') && <Table.Th style={{minWidth: '200px'}}>Event Data</Table.Th>}
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{records.map((record) => (
							<>
								<Table.Tr
									key={record.recordId}
									onClick={() =>
										setExpandedRow(expandedRow === record.recordId ? null : record.recordId)
									}
									style={{cursor: 'pointer'}}
								>
									{isColumnVisible('recordId') && <Table.Td>{record.recordId}</Table.Td>}
									{isColumnVisible('timestamp') && (
										<Table.Td style={{fontFamily: 'monospace', fontSize: '0.8rem'}}>
											{record.timestamp}
										</Table.Td>
									)}
									{isColumnVisible('provider') && <Table.Td style={{fontSize: '0.85rem'}}>{record.provider}</Table.Td>}
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
										<Table.Td style={{fontFamily: 'monospace', fontSize: '0.8rem'}}>
											{record.keywords}
										</Table.Td>
									)}
									{isColumnVisible('version') && <Table.Td>{record.version}</Table.Td>}
									{isColumnVisible('channel') && <Table.Td>{record.channel}</Table.Td>}
									{isColumnVisible('computer') && <Table.Td>{record.computer}</Table.Td>}
									{isColumnVisible('processId') && <Table.Td>{record.processId}</Table.Td>}
									{isColumnVisible('threadId') && <Table.Td>{record.threadId}</Table.Td>}
									{isColumnVisible('securityUserId') && (
										<Table.Td style={{fontFamily: 'monospace', fontSize: '0.75rem'}}>
											{record.securityUserId}
										</Table.Td>
									)}
									{isColumnVisible('activityId') && (
										<Table.Td style={{fontFamily: 'monospace', fontSize: '0.75rem'}}>
											{record.activityId}
										</Table.Td>
									)}
									{isColumnVisible('relatedActivityId') && (
										<Table.Td style={{fontFamily: 'monospace', fontSize: '0.75rem'}}>
											{record.relatedActivityId}
										</Table.Td>
									)}
									{isColumnVisible('eventData') && (
										<Table.Td>
											<span style={{ whiteSpace: 'pre-wrap' }}>
											   {record.eventData}
											</span>
										</Table.Td>
									)}
								</Table.Tr>
								{expandedRow === record.recordId && (
									<Table.Tr key={`${record.recordId}-expanded`}>
										<Table.Td colSpan={visibleColumnCount} style={{padding: 0}}>
											<Collapse in={expandedRow === record.recordId}>
												<Code
													block
													style={{
														fontSize: '0.75rem',
														margin: '1rem',
														maxHeight: '400px',
														overflow: 'auto'
													}}
												>
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
