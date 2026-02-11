import {
	Badge,
	Box,
	Divider,
	Group,
	Loader,
	Paper,
	ScrollArea,
	Stack,
	Text,
	Title,
	Tooltip,
} from '@mantine/core'
import {
	IconFileText,
	IconFileTypography,
	IconJson,
	IconQuestionMark
} from '@tabler/icons-react'
import type {FileType} from '@/lib/fileTypes'

export interface FileEntry {
	name: string
	size: number
	compressedSize: number
	type: FileType
}

interface ZipFileBrowserProps {
	entries: FileEntry[]
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
	entry: FileEntry
	active: boolean
	onClick: () => void
	isLoading: boolean
}

function FileListItem({entry, active, onClick, isLoading}: FileListItemProps) {
	return (
		<Paper
			onClick={onClick}
			p='sm'
			style={{
				cursor: 'pointer',
				backgroundColor: active ? 'var(--mantine-color-dark-6)' : 'transparent',
				borderColor: active ? 'var(--mantine-color-blue-6)' : 'transparent',
				transition: 'all 0.15s ease'
			}}
			withBorder={active}
		>
			<Group gap='sm' wrap='nowrap'>
				<Box c={getFileColor(entry.type)}>{getFileIcon(entry.type)}</Box>
				<Stack gap={2} style={{flex: 1, minWidth: 0}}>
					<Tooltip disabled={entry.name.length < 30} label={entry.name}>
						<Text
							fw={active ? 600 : 400}
							size='sm'
							style={{
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap'
							}}
						>
							{entry.name}
						</Text>
					</Tooltip>
					<Text c='dimmed' size='xs'>
						{formatFileSize(entry.size)}
					</Text>
				</Stack>
				{isLoading && <Loader size='xs' />}
			</Group>
		</Paper>
	)
}

export function ZipFileBrowser({
	entries,
	currentFile,
	onFileClick,
	loadingFile = null
}: ZipFileBrowserProps) {
	// Group files by type
	const evtxFiles: FileEntry[] = entries.filter(e => e.type === 'evtx')
	const jsonFiles: FileEntry[] = entries.filter(e => e.type === 'json')
	const xmlFiles: FileEntry[] = entries.filter(e => e.type === 'xml')
	const txtFiles: FileEntry[] = entries.filter(e => e.type === 'txt')
	const unknownFiles: FileEntry[] = entries.filter(e => e.type === 'unknown')

	return (
		<Stack gap="md" style={{height: '100%'}}>
			<Group justify="space-between">
				<Title order={5}>Files</Title>
				<Badge size="sm" variant="light">
					{entries.length}
				</Badge>
			</Group>
			<Divider />

			<ScrollArea style={{flex: 1}}>
					<Stack gap='lg'>
						{/* EVTX Files */}
						{evtxFiles.length > 0 && (
							<Stack gap='xs'>
								<Group gap='xs'>
									<Text c='dimmed' fw={600} size='xs' tt='uppercase'>
										EVTX Files
									</Text>
									<Badge color='blue' size='xs' variant='light'>
										{evtxFiles.length}
									</Badge>
								</Group>
								{evtxFiles.map(entry => (
									<FileListItem
										active={entry.name === currentFile}
										entry={entry}
										isLoading={entry.name === loadingFile}
										key={entry.name}
										onClick={() => onFileClick(entry.name)}
									/>
								))}
							</Stack>
						)}

						{/* JSON Files */}
						{jsonFiles.length > 0 && (
							<Stack gap='xs'>
								<Group gap='xs'>
									<Text c='dimmed' fw={600} size='xs' tt='uppercase'>
										JSON Files
									</Text>
									<Badge color='green' size='xs' variant='light'>
										{jsonFiles.length}
									</Badge>
								</Group>
								{jsonFiles.map(entry => (
									<FileListItem
										active={entry.name === currentFile}
										entry={entry}
										isLoading={entry.name === loadingFile}
										key={entry.name}
										onClick={() => onFileClick(entry.name)}
									/>
								))}
							</Stack>
						)}

						{/* XML Files */}
						{xmlFiles.length > 0 && (
							<Stack gap='xs'>
								<Group gap='xs'>
									<Text c='dimmed' fw={600} size='xs' tt='uppercase'>
										XML Files
									</Text>
									<Badge color='orange' size='xs' variant='light'>
										{xmlFiles.length}
									</Badge>
								</Group>
								{xmlFiles.map(entry => (
									<FileListItem
										active={entry.name === currentFile}
										entry={entry}
										isLoading={entry.name === loadingFile}
										key={entry.name}
										onClick={() => onFileClick(entry.name)}
									/>
								))}
							</Stack>
						)}

						{/* Text Files */}
						{txtFiles.length > 0 && (
							<Stack gap='xs'>
								<Group gap='xs'>
									<Text c='dimmed' fw={600} size='xs' tt='uppercase'>
										Text Files
									</Text>
									<Badge color='gray' size='xs' variant='light'>
										{txtFiles.length}
									</Badge>
								</Group>
								{txtFiles.map(entry => (
									<FileListItem
										active={entry.name === currentFile}
										entry={entry}
										isLoading={entry.name === loadingFile}
										key={entry.name}
										onClick={() => onFileClick(entry.name)}
									/>
								))}
							</Stack>
						)}

						{/* Unknown Files */}
						{unknownFiles.length > 0 && (
							<Stack gap='xs'>
								<Group gap='xs'>
									<Text c='dimmed' fw={600} size='xs' tt='uppercase'>
										Other Files
									</Text>
									<Badge size='xs' variant='light'>
										{unknownFiles.length}
									</Badge>
								</Group>
								{unknownFiles.map(entry => (
									<FileListItem
										active={entry.name === currentFile}
										entry={entry}
										isLoading={entry.name === loadingFile}
										key={entry.name}
										onClick={() => onFileClick(entry.name)}
									/>
								))}
							</Stack>
						)}
					</Stack>
			</ScrollArea>
		</Stack>
	)
}
