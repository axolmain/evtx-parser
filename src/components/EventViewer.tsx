import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Code,
	Divider,
	Group,
	Paper,
	ScrollArea,
	Stack,
	Tabs,
	Text,
	Title,
	Tooltip
} from '@mantine/core'
import {useClipboard} from '@mantine/hooks'
import {
	IconAlertCircle,
	IconAlertTriangle,
	IconCheck,
	IconCopy,
	IconInfoCircle,
	IconX
} from '@tabler/icons-react'
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
	1: <IconX color='var(--mantine-color-red-6)' size={18} />,
	2: <IconAlertCircle color='var(--mantine-color-orange-6)' size={18} />,
	3: <IconAlertTriangle color='var(--mantine-color-yellow-6)' size={18} />,
	4: <IconInfoCircle color='var(--mantine-color-blue-6)' size={18} />,
	5: <IconInfoCircle color='var(--mantine-color-gray-6)' size={18} />
}

function formatRelativeTime(timestamp: string): string {
	const date = new Date(timestamp)
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMins = Math.floor(diffMs / 60_000)
	const diffHours = Math.floor(diffMs / 3_600_000)
	const diffDays = Math.floor(diffMs / 86_400_000)

	if (diffMins < 1) return 'Just now'
	if (diffMins < 60) return `${diffMins}m ago`
	if (diffHours < 24) return `${diffHours}h ago`
	if (diffDays < 7) return `${diffDays}d ago`

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	})
}

interface DetailField {
	label: string
	value: string
	mono?: boolean
}
interface DetailSection {
	divider?: string
	fields: DetailField[]
}

function parseEventData(eventData: string): {
	fields: DetailField[]
	message: string
} {
	const fields: DetailField[] = []
	const messageLines: string[] = []

	for (const line of eventData.split('\n')) {
		const trimmed = line.trim()
		if (!trimmed) continue
		// Match "Key: Value" pattern (key has no spaces or is a known multi-word key)
		const match = trimmed.match(/^([A-Za-z][\w\s]{0,30}?)\s*:\s+(.+)$/)
		if (match) {
			fields.push({label: match[1]!, value: match[2]!})
		} else {
			messageLines.push(trimmed)
		}
	}

	return {fields, message: messageLines.join('\n')}
}

function prettyXml(xml: string): string {
	let indent = 0
	const lines: string[] = []
	// Split on tag boundaries, keeping the tags
	const tokens = xml.replace(/>\s*</g, '>\n<').split('\n')
	for (const raw of tokens) {
		const token = raw.trim()
		if (!token) continue
		// Closing tag: dedent then print
		if (token.startsWith('</')) {
			indent = Math.max(0, indent - 1)
			lines.push('  '.repeat(indent) + token)
		}
		// Self-closing tag or processing instruction: print at current indent
		else if (token.endsWith('/>') || token.startsWith('<?')) {
			lines.push('  '.repeat(indent) + token)
		}
		// Opening tag: print then indent
		else if (token.startsWith('<')) {
			lines.push('  '.repeat(indent) + token)
			indent++
		}
		// Text content
		else {
			lines.push('  '.repeat(indent) + token)
		}
	}
	return lines.join('\n')
}

function getDetailSections(e: ParsedEventRecord): DetailSection[] {
	const sections: DetailSection[] = [
		{
			fields: [
				{label: 'Event ID', value: e.eventId},
				{label: 'Level', value: e.levelText},
				{label: 'Time Created', value: e.timestamp, mono: true},
				{label: 'Source', value: e.provider},
				{label: 'Computer', value: e.computer},
				{label: 'Channel', value: e.channel}
			]
		},
		{
			divider: 'Execution',
			fields: [
				{label: 'Process ID', value: e.processId},
				{label: 'Thread ID', value: e.threadId}
			]
		},
		{
			divider: 'Additional Info',
			fields: [
				{label: 'Task', value: e.task},
				{label: 'Opcode', value: e.opcode},
				{label: 'Keywords', value: e.keywords, mono: true},
				{label: 'Version', value: e.version},
				{label: 'Record ID', value: e.recordId.toString()}
			]
		}
	]

	if (e.securityUserId) {
		sections.push({
			divider: 'Security',
			fields: [{label: 'User ID', value: e.securityUserId, mono: true}]
		})
	}

	if (e.activityId || e.relatedActivityId) {
		sections.push({
			divider: 'Correlation',
			fields: [
				...(e.activityId
					? [{label: 'Activity ID', value: e.activityId, mono: true}]
					: []),
				...(e.relatedActivityId
					? [
							{
								label: 'Related Activity ID',
								value: e.relatedActivityId,
								mono: true
							}
						]
					: [])
			]
		})
	}

	return sections
}

export function EventViewer({records, selectedRecordId}: Properties) {
	const [selectedEvent, setSelectedEvent] = useState<ParsedEventRecord | null>(
		records.length > 0 ? records[0]! : null
	)
	const clipboard = useClipboard({timeout: 2000})
	const eventRefs = useRef<Map<number, HTMLDivElement>>(new Map())

	useEffect(() => {
		if (selectedRecordId !== null && selectedRecordId !== undefined) {
			const event = records.find(r => r.recordId === selectedRecordId)
			if (event) {
				setSelectedEvent(event)
				eventRefs.current
					.get(selectedRecordId)
					?.scrollIntoView({behavior: 'smooth', block: 'center'})
			}
		}
	}, [selectedRecordId, records])

	if (records.length === 0) return null

	const copyEventAsJson = () => {
		if (!selectedEvent) return
		clipboard.copy(
			JSON.stringify(
				{
					recordId: selectedEvent.recordId,
					timestamp: selectedEvent.timestamp,
					eventId: selectedEvent.eventId,
					level: selectedEvent.levelText,
					provider: selectedEvent.provider,
					computer: selectedEvent.computer,
					channel: selectedEvent.channel,
					eventData: selectedEvent.eventData,
					xml: selectedEvent.xml
				},
				null,
				2
			)
		)
	}

	return (
		<Box
			style={{
				display: 'flex',
				gap: '1rem',
				height: '700px',
				width: '100%',
				maxWidth: '100%',
				overflow: 'hidden'
			}}
		>
			{/* Event List - Left Panel */}
			<Paper
				style={{
					flex: '0 0 400px',
					minWidth: 0,
					display: 'flex',
					flexDirection: 'column'
				}}
				withBorder={true}
			>
				<Box
					p='md'
					style={{borderBottom: '1px solid var(--mantine-color-dark-4)'}}
				>
					<Title order={4}>Events ({records.length})</Title>
				</Box>
				<ScrollArea style={{flex: 1, overflow: 'auto'}}>
					<Stack gap={0}>
						{records.map(record => (
							<EventListItem
								isSelected={selectedEvent?.recordId === record.recordId}
								key={record.recordId}
								onSelect={setSelectedEvent}
								record={record}
								refCallback={el => {
									if (el) eventRefs.current.set(record.recordId, el)
									else eventRefs.current.delete(record.recordId)
								}}
							/>
						))}
					</Stack>
				</ScrollArea>
			</Paper>

			{/* Event Details - Right Panel */}
			<Paper
				style={{
					flex: 1,
					minWidth: 0,
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden'
				}}
				withBorder={true}
			>
				{selectedEvent ? (
					<EventDetail
						clipboard={clipboard}
						event={selectedEvent}
						onCopyJson={copyEventAsJson}
						onCopyXml={() => clipboard.copy(selectedEvent.xml)}
					/>
				) : (
					<Box p='xl' ta='center'>
						<Text c='dimmed'>Select an event to view details</Text>
					</Box>
				)}
			</Paper>
		</Box>
	)
}

function EventListItem({
	record,
	isSelected,
	onSelect,
	refCallback
}: {
	record: ParsedEventRecord
	isSelected: boolean
	onSelect: (r: ParsedEventRecord) => void
	refCallback: (el: HTMLDivElement | null) => void
}) {
	const levelColor = LEVEL_COLORS[record.level] || 'gray'

	return (
		<Paper
			onClick={() => onSelect(record)}
			onMouseEnter={e => {
				if (!isSelected)
					e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-7)'
			}}
			onMouseLeave={e => {
				if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
			}}
			p='md'
			ref={refCallback}
			style={{
				cursor: 'pointer',
				borderBottom: '1px solid var(--mantine-color-dark-4)',
				borderLeft: `4px solid var(--mantine-color-${levelColor}-6)`,
				backgroundColor: isSelected
					? 'var(--mantine-color-dark-6)'
					: 'transparent',
				transition: 'background-color 0.1s'
			}}
		>
			<Group align='flex-start' gap='sm' wrap='nowrap'>
				<Box mt={2} style={{flexShrink: 0}}>
					{LEVEL_ICONS[record.level] || LEVEL_ICONS[4]}
				</Box>
				<Stack gap={4} style={{flex: 1, minWidth: 0, overflow: 'hidden'}}>
					<Group gap='xs'>
						<Text fw={500} size='sm'>
							{record.eventId}
						</Text>
						<Badge color={levelColor} size='xs'>
							{record.levelText}
						</Badge>
					</Group>
					<Text c='dimmed' size='xs' truncate={true}>
						{record.provider}
					</Text>
					{record.eventData && (
						<Text c='dimmed' lh={1.4} lineClamp={2} size='xs'>
							{record.eventData}
						</Text>
					)}
					<Text c='dimmed' size='xs'>
						{formatRelativeTime(record.timestamp)}
					</Text>
				</Stack>
			</Group>
		</Paper>
	)
}

function EventDetail({
	event,
	clipboard,
	onCopyJson,
	onCopyXml
}: {
	event: ParsedEventRecord
	clipboard: {copied: boolean}
	onCopyJson: () => void
	onCopyXml: () => void
}) {
	const levelColor = LEVEL_COLORS[event.level] ?? 'gray'

	return (
		<>
			<Box
				p='md'
				style={{borderBottom: '1px solid var(--mantine-color-dark-4)'}}
			>
				<Group justify='space-between' wrap='wrap'>
					<Group gap='sm'>
						{LEVEL_ICONS[event.level] || LEVEL_ICONS[4]}
						<div>
							<Group gap='xs'>
								<Title order={4}>Event {event.eventId}</Title>
								<Badge color={levelColor}>{event.levelText}</Badge>
							</Group>
							<Text c='dimmed' size='sm'>
								{event.provider}
							</Text>
						</div>
					</Group>
					<Group gap='xs'>
						<Tooltip label={clipboard.copied ? 'Copied!' : 'Copy as JSON'}>
							<ActionIcon
								onClick={onCopyJson}
								variant='default'
								{...(clipboard.copied && {color: 'green'})}
							>
								{clipboard.copied ? (
									<IconCheck size={18} />
								) : (
									<IconCopy size={18} />
								)}
							</ActionIcon>
						</Tooltip>
						<Button
							leftSection={<IconCopy size={14} />}
							onClick={onCopyXml}
							size='xs'
							variant='default'
						>
							Copy XML
						</Button>
					</Group>
				</Group>
			</Box>

			<Tabs
				defaultValue='eventdata'
				style={{flex: 1, display: 'flex', flexDirection: 'column'}}
			>
				<Tabs.List px='md'>
					<Tabs.Tab value='eventdata'>Event Data</Tabs.Tab>
					<Tabs.Tab value='general'>General</Tabs.Tab>
					<Tabs.Tab value='xml'>XML</Tabs.Tab>
				</Tabs.List>

				<Box style={{flex: 1, overflow: 'hidden'}}>
					<Tabs.Panel h='100%' value='eventdata'>
						<ScrollArea h='100%' p='md'>
							{event.eventData ? (
								<EventDataView eventData={event.eventData} />
							) : (
								<Text c='dimmed'>No event data</Text>
							)}
						</ScrollArea>
					</Tabs.Panel>

					<Tabs.Panel h='100%' value='general'>
						<ScrollArea h='100%' p='md'>
							<Stack gap='md'>
								{event.eventData && (
									<>
										<Box>
											<Text fw={500} mb='xs' size='sm'>
												Description:
											</Text>
											<Paper bg='dark.6' p='sm' withBorder={true}>
												<Text
													size='sm'
													style={{
														whiteSpace: 'pre-wrap',
														wordBreak: 'break-word'
													}}
												>
													{event.eventData}
												</Text>
											</Paper>
										</Box>
										<Divider />
									</>
								)}
								{getDetailSections(event).map((section, i) => (
									<DetailSection key={i} section={section} />
								))}
							</Stack>
						</ScrollArea>
					</Tabs.Panel>

					<Tabs.Panel h='100%' value='xml'>
						<ScrollArea h='100%' p='md'>
							<Code
								block={true}
								style={{maxWidth: '100%', overflowWrap: 'break-word'}}
							>
								{prettyXml(event.xml)}
							</Code>
						</ScrollArea>
					</Tabs.Panel>
				</Box>
			</Tabs>
		</>
	)
}

function EventDataView({eventData}: {eventData: string}) {
	const {fields, message} = parseEventData(eventData)

	// No structure detected — show as plain text
	if (fields.length === 0) {
		return (
			<Paper bg='dark.6' p='sm' withBorder={true}>
				<Text
					size='sm'
					style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}
				>
					{eventData}
				</Text>
			</Paper>
		)
	}

	return (
		<Stack gap='md'>
			{fields.map(f => (
				<Group align='flex-start' gap='xs' key={f.label} wrap='nowrap'>
					<Text fw={500} miw={140} size='sm'>
						{f.label}:
					</Text>
					<Text size='sm' style={{wordBreak: 'break-word', flex: 1}}>
						{f.value}
					</Text>
				</Group>
			))}
			{message && (
				<>
					<Divider />
					<Paper bg='dark.6' p='sm' withBorder={true}>
						<Text
							size='sm'
							style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}
						>
							{message}
						</Text>
					</Paper>
				</>
			)}
		</Stack>
	)
}

function DetailSection({section}: {section: DetailSection}) {
	return (
		<>
			{section.divider && <Divider label={section.divider} />}
			{section.fields.map(f =>
				f.value ? (
					<Group align='flex-start' gap='xs' key={f.label} wrap='nowrap'>
						<Text fw={500} miw={140} size='sm'>
							{f.label}:
						</Text>
						<Text
							size='sm'
							{...(f.mono && {ff: 'monospace'})}
							style={{wordBreak: 'break-word', flex: 1}}
						>
							{f.value}
						</Text>
					</Group>
				) : null
			)}
		</>
	)
}
