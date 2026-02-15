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
	Tooltip
} from '@mantine/core'
import {
	IconAlertCircle,
	IconCheck,
	IconCopy,
	IconDownload
} from '@tabler/icons-react'
import {useMemo} from 'react'

interface JsonViewerProps {
	content: unknown
	fileName: string
}

function downloadFile(content: string, fileName: string) {
	const blob = new Blob([content], {type: 'application/json'})
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = fileName
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(url)
}

export function JsonViewer({content, fileName}: JsonViewerProps) {
	const formatted = useMemo(() => {
		try {
			return JSON.stringify(content, null, 2)
		} catch {
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
			<Stack gap='md' style={{width: '100%'}}>
				<Title order={3}>{fileName}</Title>
				<Alert
					color='red'
					icon={<IconAlertCircle size={16} />}
					title='JSON Parse Error'
				>
					{parseError}
				</Alert>
			</Stack>
		)
	}

	return (
		<Stack
			gap='md'
			style={{
				width: '100%',
				maxHeight: 'calc(100vh - 4rem)',
				position: 'sticky',
				top: '2rem'
			}}
		>
			{/* Sticky Header */}
			<Group justify='space-between'>
				<Group gap='xs'>
					<Title order={3}>{fileName}</Title>
					<Text c='dimmed' size='sm'>
						{formatted?.split('\n').length} lines
					</Text>
				</Group>
				<Group gap='xs'>
					<CopyButton timeout={2000} value={formatted!}>
						{({copied, copy}) => (
							<Tooltip
								label={copied ? 'Copied' : 'Copy to clipboard'}
								withArrow={true}
							>
								<ActionIcon
									color={copied ? 'teal' : 'gray'}
									onClick={copy}
									variant='subtle'
								>
									{copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
								</ActionIcon>
							</Tooltip>
						)}
					</CopyButton>
					<Button
						leftSection={<IconDownload size={16} />}
						onClick={() => downloadFile(formatted!, fileName)}
						size='xs'
						variant='light'
					>
						Download
					</Button>
				</Group>
			</Group>

			{/* Scrollable Content */}
			<Paper
				p='md'
				style={{
					overflow: 'hidden',
					display: 'flex',
					flexDirection: 'column',
					height: 'calc(100vh - 11rem - 20px)'
				}}
				withBorder={true}
			>
				<ScrollArea h='100%'>
					<Code block={true} style={{fontSize: '0.875rem'}}>
						{formatted}
					</Code>
				</ScrollArea>
			</Paper>
		</Stack>
	)
}
