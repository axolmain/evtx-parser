import {
	ActionIcon,
	Alert,
	Button,
	Code,
	CopyButton,
	Group,
	Paper,
	ScrollArea,
	Stack,
	Text,
	Title,
	Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconCheck, IconCopy, IconDownload } from '@tabler/icons-react'
import { useMemo } from 'react'

interface JsonViewerProps {
	content: unknown
	fileName: string
}

function downloadFile(content: string, fileName: string) {
	const blob = new Blob([content], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = fileName
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(url)
}

export function JsonViewer({ content, fileName }: JsonViewerProps) {
	const formatted = useMemo(() => {
		try {
			return JSON.stringify(content, null, 2)
		} catch (error) {
			return null
		}
	}, [content])

	const parseError = useMemo(() => {
		if (formatted === null) {
			return 'Failed to format JSON content'
		}
		return null
	}, [formatted])

	if (parseError) {
		return (
			<Stack gap="md" style={{ width: '100%' }}>
				<Title order={3}>{fileName}</Title>
				<Alert
					icon={<IconAlertCircle size={16} />}
					title="JSON Parse Error"
					color="red"
				>
					{parseError}
				</Alert>
			</Stack>
		)
	}

	return (
		<Stack
			gap="md"
			style={{
				width: '100%',
				maxHeight: 'calc(100vh - 4rem)',
				position: 'sticky',
				top: '2rem',
			}}
		>
			{/* Sticky Header */}
			<Group justify="space-between">
				<Group gap="xs">
					<Title order={3}>{fileName}</Title>
					<Text size="sm" c="dimmed">
						{formatted!.split('\n').length} lines
					</Text>
				</Group>
				<Group gap="xs">
					<CopyButton value={formatted!} timeout={2000}>
						{({ copied, copy }) => (
							<Tooltip label={copied ? 'Copied' : 'Copy to clipboard'} withArrow>
								<ActionIcon
									color={copied ? 'teal' : 'gray'}
									variant="subtle"
									onClick={copy}
								>
									{copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
								</ActionIcon>
							</Tooltip>
						)}
					</CopyButton>
					<Button
						size="xs"
						variant="light"
						leftSection={<IconDownload size={16} />}
						onClick={() => downloadFile(formatted!, fileName)}
					>
						Download
					</Button>
				</Group>
			</Group>

			{/* Scrollable Content */}
			<Paper
				withBorder
				p="md"
				style={{
					overflow: 'hidden',
					display: 'flex',
					flexDirection: 'column',
					height: 'calc(100vh - 11rem - 20px)',
				}}
			>
				<ScrollArea h="100%">
					<Code block style={{ fontSize: '0.875rem' }}>
						{formatted}
					</Code>
				</ScrollArea>
			</Paper>
		</Stack>
	)
}
