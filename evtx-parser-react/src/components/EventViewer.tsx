import {Badge, Box, Code, Divider, Group, Paper, ScrollArea, Stack, Tabs, Text, Title} from '@mantine/core'
import {IconAlertCircle, IconAlertTriangle, IconInfoCircle, IconX} from '@tabler/icons-react'
import {useState} from 'react'
import type {ParsedEventRecord} from '@/parser'

interface Properties {
	records: ParsedEventRecord[]
}

const LEVEL_COLORS: Record<number, string> = {
	1: 'red',
	2: 'orange',
	3: 'yellow',
	4: 'blue',
	5: 'gray'
}

const LEVEL_ICONS: Record<number, React.ReactNode> = {
	1: <IconX size={18} color="var(--mantine-color-red-6)" />,
	2: <IconAlertCircle size={18} color="var(--mantine-color-orange-6)" />,
	3: <IconAlertTriangle size={18} color="var(--mantine-color-yellow-6)" />,
	4: <IconInfoCircle size={18} color="var(--mantine-color-blue-6)" />,
	5: <IconInfoCircle size={18} color="var(--mantine-color-gray-6)" />
}

export function EventViewer({records}: Properties) {
	const [selectedEvent, setSelectedEvent] = useState<ParsedEventRecord | null>(
		records.length > 0 ? records[0]! : null
	)

	if (records.length === 0) {
		return null
	}

	return (
		<Box style={{width: '100%', height: '700px', display: 'flex', gap: '1rem'}}>
			{/* Event List - Left Panel */}
			<Paper withBorder style={{flex: '0 0 400px', display: 'flex', flexDirection: 'column'}}>
				<Box p="md" style={{borderBottom: '1px solid var(--mantine-color-dark-4)'}}>
					<Title order={4}>Events ({records.length})</Title>
				</Box>
				<ScrollArea style={{flex: 1}}>
					<Stack gap={0}>
						{records.map(record => (
							<Paper
								key={record.recordId}
								p="sm"
								style={{
									cursor: 'pointer',
									borderBottom: '1px solid var(--mantine-color-dark-4)',
									backgroundColor:
										selectedEvent?.recordId === record.recordId
											? 'var(--mantine-color-dark-6)'
											: 'transparent',
									transition: 'background-color 0.1s'
								}}
								onMouseEnter={(e) => {
									if (selectedEvent?.recordId !== record.recordId) {
										e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-7)'
									}
								}}
								onMouseLeave={(e) => {
									if (selectedEvent?.recordId !== record.recordId) {
										e.currentTarget.style.backgroundColor = 'transparent'
									}
								}}
								onClick={() => setSelectedEvent(record)}
							>
								<Group gap="sm" wrap="nowrap">
									<Box style={{flexShrink: 0}}>
										{LEVEL_ICONS[record.level] || LEVEL_ICONS[4]}
									</Box>
									<Stack gap={4} style={{flex: 1, minWidth: 0}}>
										<Group gap="xs">
											<Text size="sm" fw={500}>
												{record.eventId}
											</Text>
											<Badge size="xs" color={LEVEL_COLORS[record.level] ?? 'gray'}>
												{record.levelText}
											</Badge>
										</Group>
										<Text size="xs" c="dimmed" truncate>
											{record.provider}
										</Text>
										<Text size="xs" c="dimmed" style={{fontFamily: 'monospace'}}>
											{record.timestamp.split('T')[0]} {record.timestamp.split('T')[1]?.substring(0, 8)}
										</Text>
									</Stack>
								</Group>
							</Paper>
						))}
					</Stack>
				</ScrollArea>
			</Paper>

			{/* Event Details - Right Panel */}
			<Paper withBorder style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
				{selectedEvent ? (
					<>
						<Box p="md" style={{borderBottom: '1px solid var(--mantine-color-dark-4)'}}>
							<Group gap="sm">
								{LEVEL_ICONS[selectedEvent.level] || LEVEL_ICONS[4]}
								<div>
									<Group gap="xs">
										<Title order={4}>Event {selectedEvent.eventId}</Title>
										<Badge color={LEVEL_COLORS[selectedEvent.level] ?? 'gray'}>
											{selectedEvent.levelText}
										</Badge>
									</Group>
									<Text size="sm" c="dimmed">
										{selectedEvent.provider}
									</Text>
								</div>
							</Group>
						</Box>

						<Tabs defaultValue="general" style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
							<Tabs.List px="md">
								<Tabs.Tab value="general">General</Tabs.Tab>
								<Tabs.Tab value="eventdata">Event Data</Tabs.Tab>
								<Tabs.Tab value="xml">XML</Tabs.Tab>
							</Tabs.List>

							<Box style={{flex: 1, overflow: 'hidden'}}>
								<Tabs.Panel value="general" style={{height: '100%'}}>
									<ScrollArea style={{height: '100%'}} p="md">
										<Stack gap="md">
											<DetailRow label="Event ID" value={selectedEvent.eventId} />
											<DetailRow label="Level" value={selectedEvent.levelText} />
											<DetailRow label="Time Created" value={selectedEvent.timestamp} mono />
											<DetailRow label="Source" value={selectedEvent.provider} />
											<DetailRow label="Computer" value={selectedEvent.computer} />
											<DetailRow label="Channel" value={selectedEvent.channel} />

											<Divider label="Execution" />
											<DetailRow label="Process ID" value={selectedEvent.processId} />
											<DetailRow label="Thread ID" value={selectedEvent.threadId} />

											<Divider label="Additional Info" />
											<DetailRow label="Task" value={selectedEvent.task} />
											<DetailRow label="Opcode" value={selectedEvent.opcode} />
											<DetailRow label="Keywords" value={selectedEvent.keywords} mono />
											<DetailRow label="Version" value={selectedEvent.version} />
											<DetailRow label="Record ID" value={selectedEvent.recordId.toString()} />

											{selectedEvent.securityUserId && (
												<>
													<Divider label="Security" />
													<DetailRow label="User ID" value={selectedEvent.securityUserId} mono />
												</>
											)}

											{(selectedEvent.activityId || selectedEvent.relatedActivityId) && (
												<>
													<Divider label="Correlation" />
													{selectedEvent.activityId && (
														<DetailRow label="Activity ID" value={selectedEvent.activityId} mono />
													)}
													{selectedEvent.relatedActivityId && (
														<DetailRow label="Related Activity ID" value={selectedEvent.relatedActivityId} mono />
													)}
												</>
											)}
										</Stack>
									</ScrollArea>
								</Tabs.Panel>

								<Tabs.Panel value="eventdata" style={{height: '100%'}}>
									<ScrollArea style={{height: '100%'}} p="md">
										{selectedEvent.eventData ? (
											<Code block style={{fontSize: '0.85rem'}}>
												{selectedEvent.eventData}
											</Code>
										) : (
											<Text c="dimmed">No event data</Text>
										)}
									</ScrollArea>
								</Tabs.Panel>

								<Tabs.Panel value="xml" style={{height: '100%'}}>
									<ScrollArea style={{height: '100%'}} p="md">
										<Code block style={{fontSize: '0.8rem'}}>
											{selectedEvent.xml}
										</Code>
									</ScrollArea>
								</Tabs.Panel>
							</Box>
						</Tabs>
					</>
				) : (
					<Box p="xl" style={{textAlign: 'center'}}>
						<Text c="dimmed">Select an event to view details</Text>
					</Box>
				)}
			</Paper>
		</Box>
	)
}

interface DetailRowProps {
	label: string
	value: string
	mono?: boolean
}

function DetailRow({label, value, mono}: DetailRowProps) {
	if (!value) return null

	return (
		<Group gap="xs" wrap="nowrap">
			<Text size="sm" fw={500} style={{minWidth: '140px'}}>
				{label}:
			</Text>
			<Text size="sm" style={{fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-word'}}>
				{value}
			</Text>
		</Group>
	)
}
