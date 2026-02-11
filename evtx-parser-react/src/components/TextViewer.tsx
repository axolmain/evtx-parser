import {
	ActionIcon,
	Button,
	CopyButton,
	Group,
	Paper,
	ScrollArea,
	Stack,
	Text,
	Title,
	Tooltip
} from '@mantine/core'
import {IconCheck, IconCopy, IconDownload} from '@tabler/icons-react'

interface TextViewerProps {
	content: string
	fileName: string
}

function downloadFile(content: string, fileName: string) {
	const blob = new Blob([content], {type: 'text/plain'})
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = fileName
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(url)
}

export function TextViewer({content, fileName}: TextViewerProps) {
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
				<Title order={3}>{fileName}</Title>
				<Group gap='xs'>
					<CopyButton timeout={2000} value={content}>
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
						onClick={() => downloadFile(content, fileName)}
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
					<Text
						component='pre'
						ff='monospace'
						size='sm'
						style={{
							whiteSpace: 'pre-wrap',
							wordBreak: 'break-word',
							margin: 0
						}}
					>
						{content}
					</Text>
				</ScrollArea>
			</Paper>
		</Stack>
	)
}
