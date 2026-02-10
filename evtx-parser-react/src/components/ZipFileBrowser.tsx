import { Badge, Box, Group, Loader, Paper, Stack, Text, Title, Tooltip } from '@mantine/core'
import {
	IconFileText,
	IconFileTypography,
	IconJson,
	IconQuestionMark,
} from '@tabler/icons-react'
import type { ZipFileEntry } from '@/hooks/useFileViewer'

interface ZipFileBrowserProps {
	entries: ZipFileEntry[]
	currentFile: string | null
	onFileClick: (fileName: string) => void
	loadingFile?: string | null
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(type: string, size = 18) {
	switch (type) {
		case 'evtx':
			return <IconFileText size={size} />
		case 'json':
			return <IconJson size={size} />
		case 'txt':
			return <IconFileTypography size={size} />
		default:
			return <IconQuestionMark size={size} />
	}
}

function getFileColor(type: string): string {
	switch (type) {
		case 'evtx':
			return 'blue'
		case 'json':
			return 'green'
		case 'txt':
			return 'gray'
		default:
			return 'dark'
	}
}

interface FileListItemProps {
	entry: ZipFileEntry
	active: boolean
	onClick: () => void
	isLoading: boolean
}

function FileListItem({ entry, active, onClick, isLoading }: FileListItemProps) {
	return (
		<Paper
			p="sm"
			withBorder={active}
			style={{
				cursor: 'pointer',
				backgroundColor: active
					? 'var(--mantine-color-dark-6)'
					: 'transparent',
				borderColor: active ? 'var(--mantine-color-blue-6)' : 'transparent',
				transition: 'all 0.15s ease',
			}}
			onClick={onClick}
		>
			<Group gap="sm" wrap="nowrap">
				<Box c={getFileColor(entry.type)}>{getFileIcon(entry.type)}</Box>
				<Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
					<Tooltip label={entry.name} disabled={entry.name.length < 30}>
						<Text
							size="sm"
							fw={active ? 600 : 400}
							style={{
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
							}}
						>
							{entry.name}
						</Text>
					</Tooltip>
					<Text size="xs" c="dimmed">
						{formatFileSize(entry.size)}
					</Text>
				</Stack>
				{isLoading && <Loader size="xs" />}
			</Group>
		</Paper>
	)
}

export function ZipFileBrowser({
	entries,
	currentFile,
	onFileClick,
	loadingFile = null,
}: ZipFileBrowserProps) {
	// Group files by type
	const evtxFiles: ZipFileEntry[] = entries.filter((e) => e.type === 'evtx')
	const jsonFiles: ZipFileEntry[] = entries.filter((e) => e.type === 'json')
	const xmlFiles: ZipFileEntry[] = entries.filter((e) => e.type === 'xml')
	const txtFiles: ZipFileEntry[] = entries.filter((e) => e.type === 'txt')
	const unknownFiles: ZipFileEntry[] = entries.filter((e) => e.type === 'unknown')

	return (
		<Paper
			w={300}
			h="calc(100vh - 4rem)"
			p="md"
			withBorder
			style={{
				display: 'flex',
				flexDirection: 'column',
				position: 'sticky',
				top: '2rem',
			}}
		>
			<Stack gap="md" style={{ flex: 1, overflow: 'hidden' }}>
				<Group justify="space-between">
					<Title order={4}>Files</Title>
					<Badge size="sm" variant="light">
						{entries.length}
					</Badge>
				</Group>

				<Box style={{ flex: 1, overflowY: 'auto' }}>
					<Stack gap="lg">
						{/* EVTX Files */}
						{evtxFiles.length > 0 && (
							<Stack gap="xs">
								<Group gap="xs">
									<Text size="xs" fw={600} c="dimmed" tt="uppercase">
										EVTX Files
									</Text>
									<Badge size="xs" variant="light" color="blue">
										{evtxFiles.length}
									</Badge>
								</Group>
								{evtxFiles.map((entry) => (
									<FileListItem
										key={entry.name}
										entry={entry}
										active={entry.name === currentFile}
										isLoading={entry.name === loadingFile}
										onClick={() => onFileClick(entry.name)}
									/>
								))}
							</Stack>
						)}

						{/* JSON Files */}
						{jsonFiles.length > 0 && (
							<Stack gap="xs">
								<Group gap="xs">
									<Text size="xs" fw={600} c="dimmed" tt="uppercase">
										JSON Files
									</Text>
									<Badge size="xs" variant="light" color="green">
										{jsonFiles.length}
									</Badge>
								</Group>
								{jsonFiles.map((entry) => (
									<FileListItem
										key={entry.name}
										entry={entry}
										active={entry.name === currentFile}
										isLoading={entry.name === loadingFile}
										onClick={() => onFileClick(entry.name)}
									/>
								))}
							</Stack>
						)}

						{/* XML Files */}
						{xmlFiles.length > 0 && (
							<Stack gap="xs">
								<Group gap="xs">
									<Text size="xs" fw={600} c="dimmed" tt="uppercase">
										XML Files
									</Text>
									<Badge size="xs" variant="light" color="orange">
										{xmlFiles.length}
									</Badge>
								</Group>
								{xmlFiles.map((entry) => (
									<FileListItem
										key={entry.name}
										entry={entry}
										active={entry.name === currentFile}
										isLoading={entry.name === loadingFile}
										onClick={() => onFileClick(entry.name)}
									/>
								))}
							</Stack>
						)}

						{/* Text Files */}
						{txtFiles.length > 0 && (
							<Stack gap="xs">
								<Group gap="xs">
									<Text size="xs" fw={600} c="dimmed" tt="uppercase">
										Text Files
									</Text>
									<Badge size="xs" variant="light" color="gray">
										{txtFiles.length}
									</Badge>
								</Group>
								{txtFiles.map((entry) => (
									<FileListItem
										key={entry.name}
										entry={entry}
										active={entry.name === currentFile}
										isLoading={entry.name === loadingFile}
										onClick={() => onFileClick(entry.name)}
									/>
								))}
							</Stack>
						)}

						{/* Unknown Files */}
						{unknownFiles.length > 0 && (
							<Stack gap="xs">
								<Group gap="xs">
									<Text size="xs" fw={600} c="dimmed" tt="uppercase">
										Other Files
									</Text>
									<Badge size="xs" variant="light">
										{unknownFiles.length}
									</Badge>
								</Group>
								{unknownFiles.map((entry) => (
									<FileListItem
										key={entry.name}
										entry={entry}
										active={entry.name === currentFile}
										isLoading={entry.name === loadingFile}
										onClick={() => onFileClick(entry.name)}
									/>
								))}
							</Stack>
						)}
					</Stack>
				</Box>
			</Stack>
		</Paper>
	)
}
