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
	Tooltip,
} from '@mantine/core'
import { IconCheck, IconCopy, IconDownload } from '@tabler/icons-react'

interface TextViewerProps {
	content: string
	fileName: string
}

function downloadFile(content: string, fileName: string) {
	const blob = new Blob([content], { type: 'text/plain' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = fileName
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(url)
}

export function TextViewer({ content, fileName }: TextViewerProps) {
	return (
		<Stack gap="md" style={{ width: '100%', height: '100%' }}>
			<Group justify="space-between">
				<Title order={3}>{fileName}</Title>
				<Group gap="xs">
					<CopyButton value={content} timeout={2000}>
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
						onClick={() => downloadFile(content, fileName)}
					>
						Download
					</Button>
				</Group>
			</Group>

			<Paper withBorder p="md" style={{ flex: 1 }}>
				<ScrollArea h={600}>
					<Text
						component="pre"
						ff="monospace"
						size="sm"
						style={{
							whiteSpace: 'pre-wrap',
							wordBreak: 'break-word',
							margin: 0,
						}}
					>
						{content}
					</Text>
				</ScrollArea>
			</Paper>
		</Stack>
	)
}
