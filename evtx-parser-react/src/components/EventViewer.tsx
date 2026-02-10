import {ActionIcon, Badge, Box, Button, Code, Divider, Group, Paper, ScrollArea, Stack, Tabs, Text, Title, Tooltip} from '@mantine/core'
import {useClipboard} from '@mantine/hooks'
import {IconAlertCircle, IconAlertTriangle, IconCheck, IconCopy, IconInfoCircle, IconX} from '@tabler/icons-react'
import {useEffect, useRef, useState} from 'react'
import type {ParsedEventRecord} from '@/parser'

interface Properties {
	records: ParsedEventRecord[]
	selectedRecordId: number | null
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

function formatRelativeTime(timestamp: string): string {
	const date = new Date(timestamp)
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMs / 3600000)
	const diffDays = Math.floor(diffMs / 86400000)

	if (diffMins < 1) return 'Just now'
	if (diffMins < 60) return `${diffMins}m ago`
	if (diffHours < 24) return `${diffHours}h ago`
	if (diffDays < 7) return `${diffDays}d ago`

	return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})
}

export function EventViewer({records, selectedRecordId}: Properties) {
	const [selectedEvent, setSelectedEvent] = useState<ParsedEventRecord | null>(
		records.length > 0 ? records[0]! : null
	)
	const clipboard = useClipboard({timeout: 2000})
	const eventRefs = useRef<Map<number, HTMLDivElement>>(new Map())

	// Scroll to and select event when selectedRecordId changes
	useEffect(() => {
		if (selectedRecordId !== null && selectedRecordId !== undefined) {
			const event = records.find(r => r.recordId === selectedRecordId)
			if (event) {
				setSelectedEvent(event)
				// Scroll to the event
				const element = eventRefs.current.get(selectedRecordId)
				if (element) {
					element.scrollIntoView({ behavior: 'smooth', block: 'center' })
				}
			}
		}
	}, [selectedRecordId, records])

	if (records.length === 0) {
		return null
	}

	const copyEventAsJson = () => {
		if (!selectedEvent) return
		const json = JSON.stringify({
			recordId: selectedEvent.recordId,
			timestamp: selectedEvent.timestamp,
			eventId: selectedEvent.eventId,
			level: selectedEvent.levelText,
			provider: selectedEvent.provider,
			computer: selectedEvent.computer,
			channel: selectedEvent.channel,
			eventData: selectedEvent.eventData,
			xml: selectedEvent.xml
		}, null, 2)
		clipboard.copy(json)
	}

	const copyEventXml = () => {
		if (!selectedEvent) return
		clipboard.copy(selectedEvent.xml)
	}

	return (
		<Box style={{display: 'flex', gap: '1rem', height: '700px', width: '100%', maxWidth: '100%', overflow: 'hidden'}}>
			{/* Event List - Left Panel */}
			<Paper withBorder style={{flex: '0 0 400px', minWidth: 0, display: 'flex', flexDirection: 'column'}}>
				<Box p="md" style={{borderBottom: '1px solid var(--mantine-color-dark-4)'}}>
					<Title order={4}>Events ({records.length})</Title>
				</Box>
				<ScrollArea style={{flex: 1, overflow: 'auto'}}>
					<Stack gap={0}>
						{records.map(record => {
							const isSelected = selectedEvent?.recordId === record.recordId
							const levelColor = LEVEL_COLORS[record.level] || 'gray'

							return (
								<Paper
									key={record.recordId}
									ref={(el) => {
										if (el) {
											eventRefs.current.set(record.recordId, el)
										} else {
											eventRefs.current.delete(record.recordId)
										}
									}}
									p="md"
									style={{
										cursor: 'pointer',
										borderBottom: '1px solid var(--mantine-color-dark-4)',
										borderLeft: `4px solid var(--mantine-color-${levelColor}-6)`,
										backgroundColor: isSelected ? 'var(--mantine-color-dark-6)' : 'transparent',
										transition: 'background-color 0.1s'
									}}
									onMouseEnter={(e) => {
										if (!isSelected) {
											e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-7)'
										}
									}}
									onMouseLeave={(e) => {
										if (!isSelected) {
											e.currentTarget.style.backgroundColor = 'transparent'
										}
									}}
									onClick={() => setSelectedEvent(record)}
								>
									<Group gap="sm" wrap="nowrap" align="flex-start">
										<Box style={{flexShrink: 0}} mt={2}>
											{LEVEL_ICONS[record.level] || LEVEL_ICONS[4]}
										</Box>
										<Stack gap={4} style={{flex: 1, minWidth: 0, overflow: 'hidden'}}>
											<Group gap="xs">
												<Text size="sm" fw={500}>
													{record.eventId}
												</Text>
												<Badge size="xs" color={levelColor}>
													{record.levelText}
												</Badge>
											</Group>
											<Text size="xs" c="dimmed" truncate>
												{record.provider}
											</Text>
											{record.eventData && (
												<Text size="xs" c="dimmed" lineClamp={2} lh={1.4}>
													{record.eventData}
												</Text>
											)}
											<Text size="xs" c="dimmed">
												{formatRelativeTime(record.timestamp)}
											</Text>
										</Stack>
									</Group>
								</Paper>
							)
						})}
					</Stack>
				</ScrollArea>
			</Paper>

			{/* Event Details - Right Panel */}
			<Paper withBorder style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
				{selectedEvent ? (
					<>
						<Box p="md" style={{borderBottom: '1px solid var(--mantine-color-dark-4)'}}>
							<Group justify="space-between" wrap="wrap">
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
								<Group gap="xs">
									<Tooltip label={clipboard.copied ? 'Copied!' : 'Copy as JSON'}>
										<ActionIcon
											variant="default"
											onClick={copyEventAsJson}
											{...(clipboard.copied && { color: 'green' })}
										>
											{clipboard.copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
										</ActionIcon>
									</Tooltip>
									<Button
										size="xs"
										variant="default"
										leftSection={<IconCopy size={14} />}
										onClick={copyEventXml}
									>
										Copy XML
									</Button>
								</Group>
							</Group>
						</Box>

						<Tabs defaultValue="eventdata" style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
							<Tabs.List px="md">
								<Tabs.Tab value="eventdata">Event Data</Tabs.Tab>
								<Tabs.Tab value="general">General</Tabs.Tab>
								<Tabs.Tab value="xml">XML</Tabs.Tab>
							</Tabs.List>

							<Box style={{flex: 1, overflow: 'hidden'}}>
								<Tabs.Panel value="eventdata" h="100%">
									<ScrollArea h="100%" p="md">
										{selectedEvent.eventData ? (
											<Code block style={{maxWidth: '100%', overflowWrap: 'break-word'}}>{selectedEvent.eventData}</Code>
										) : (
											<Text c="dimmed">No event data</Text>
										)}
									</ScrollArea>
								</Tabs.Panel>

								<Tabs.Panel value="general" h="100%">
									<ScrollArea h="100%" p="md">
										<Stack gap="md">
											{selectedEvent.eventData && (
												<>
													<Box>
														<Text size="sm" fw={500} mb="xs">
															Description:
														</Text>
														<Paper withBorder p="sm" bg="dark.6">
															<Text size="sm" style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
																{selectedEvent.eventData}
															</Text>
														</Paper>
													</Box>
													<Divider />
												</>
											)}

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

								<Tabs.Panel value="xml" h="100%">
									<ScrollArea h="100%" p="md">
										<Code block style={{maxWidth: '100%', overflowWrap: 'break-word'}}>{selectedEvent.xml}</Code>
									</ScrollArea>
								</Tabs.Panel>
							</Box>
						</Tabs>
					</>
				) : (
					<Box p="xl" ta="center">
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
		<Group gap="xs" wrap="nowrap" align="flex-start">
			<Text size="sm" fw={500} miw={140}>
				{label}:
			</Text>
			<Text size="sm" {...(mono && { ff: 'monospace' })} style={{wordBreak: 'break-word', flex: 1}}>
				{value}
			</Text>
		</Group>
	)
}
