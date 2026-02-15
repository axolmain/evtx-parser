import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Card,
	Group,
	Modal,
	Paper,
	Progress,
	Stack,
	Text,
	Tooltip
} from '@mantine/core'
import {
	IconArchive,
	IconDatabase,
	IconDownload,
	IconTrash,
	IconTrashX
} from '@tabler/icons-react'
import {useEffect, useState} from 'react'
import type {Archive} from '@/db/schema'
import {formatBytes, getStorageEstimate} from '@/db/schema'
import * as dbService from '@/db/service'

interface ArchiveManagerProps {
	archives: Archive[]
	onLoadArchive: (archiveId: string) => void
	onArchivesChange?: () => void
}

interface StorageStats {
	usage: number
	quota: number
	usagePercent: number
}

export function ArchiveManager({
	archives,
	onLoadArchive,
	onArchivesChange
}: ArchiveManagerProps) {
	const [storageStats, setStorageStats] = useState<StorageStats>({
		usage: 0,
		quota: 0,
		usagePercent: 0
	})
	const [deleteModalOpen, setDeleteModalOpen] = useState(false)
	const [clearModalOpen, setClearModalOpen] = useState(false)
	const [archiveToDelete, setArchiveToDelete] = useState<Archive | null>(null)
	const [isDeleting, setIsDeleting] = useState(false)

	// Load storage stats
	useEffect(() => {
		async function loadStats() {
			const stats = await getStorageEstimate()
			setStorageStats(stats)
		}
		loadStats()

		// Refresh every 5 seconds
		const interval = setInterval(loadStats, 5000)
		return () => clearInterval(interval)
	}, [])

	const handleDeleteArchive = async (archive: Archive) => {
		setArchiveToDelete(archive)
		setDeleteModalOpen(true)
	}

	const confirmDeleteArchive = async () => {
		if (!archiveToDelete) return

		setIsDeleting(true)
		try {
			await dbService.deleteArchive(archiveToDelete.id)
			setDeleteModalOpen(false)
			setArchiveToDelete(null)
			onArchivesChange?.()
		} catch {
			alert('Failed to delete archive')
		} finally {
			setIsDeleting(false)
		}
	}

	const handleClearAll = () => {
		setClearModalOpen(true)
	}

	const confirmClearAll = async () => {
		setIsDeleting(true)
		try {
			await dbService.clearAllArchives()
			setClearModalOpen(false)
			onArchivesChange?.()
		} catch {
			alert('Failed to clear archives')
		} finally {
			setIsDeleting(false)
		}
	}

	const formatDate = (date: Date) =>
		new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(date))

	if (archives.length === 0) {
		return (
			<Paper p='xl' style={{textAlign: 'center'}} withBorder={true}>
				<IconArchive color='var(--mantine-color-dimmed)' size={48} />
				<Text fw={500} mt='md' size='lg'>
					No Recent Archives
				</Text>
				<Text c='dimmed' mt='xs' size='sm'>
					Upload a SysInfoZip archive to get started
				</Text>
			</Paper>
		)
	}

	return (
		<Stack gap='md'>
			{/* Storage Stats */}
			<Card withBorder={true}>
				<Group justify='space-between' mb='xs'>
					<Group gap='xs'>
						<IconDatabase size={20} />
						<Text fw={500}>Storage Usage</Text>
					</Group>
					<Badge variant='light'>
						{formatBytes(storageStats.usage)} /{' '}
						{formatBytes(storageStats.quota)}
					</Badge>
				</Group>

				<Progress
					color={
						storageStats.usagePercent > 80
							? 'red'
							: storageStats.usagePercent > 50
								? 'yellow'
								: 'blue'
					}
					size='lg'
					value={storageStats.usagePercent}
				/>

				<Group justify='space-between' mt='xs'>
					<Text c='dimmed' size='xs'>
						{storageStats.usagePercent.toFixed(1)}% used
					</Text>
					{storageStats.usagePercent > 80 && (
						<Text c='red' size='xs'>
							Consider clearing old archives
						</Text>
					)}
				</Group>
			</Card>

			{/* Archives List Header */}
			<Group justify='space-between'>
				<Group gap='xs'>
					<IconArchive size={20} />
					<Text fw={500}>Recent Archives</Text>
					<Badge size='sm' variant='light'>
						{archives.length}
					</Badge>
				</Group>

				{archives.length > 0 && (
					<Button
						color='red'
						leftSection={<IconTrashX size={14} />}
						onClick={handleClearAll}
						size='xs'
						variant='light'
					>
						Clear All
					</Button>
				)}
			</Group>

			{/* Archives List */}
			<Stack gap='xs'>
				{archives.map(archive => (
					<Card key={archive.id} padding='sm' withBorder={true}>
						<Group justify='space-between' wrap='nowrap'>
							<Box style={{flex: 1, minWidth: 0}}>
								<Group gap='xs' wrap='nowrap'>
									<IconArchive size={18} />
									<Text
										fw={500}
										size='sm'
										style={{
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap'
										}}
									>
										{archive.name}
									</Text>
								</Group>

								<Group gap='md' mt={4}>
									<Text c='dimmed' size='xs'>
										{formatDate(archive.uploadedAt)}
									</Text>
									<Text c='dimmed' size='xs'>
										{archive.fileCount} files
									</Text>
									<Text c='dimmed' size='xs'>
										{formatBytes(archive.totalSize)}
									</Text>
								</Group>
							</Box>

							<Group gap='xs'>
								<Tooltip label='Load archive'>
									<ActionIcon
										color='blue'
										onClick={() => onLoadArchive(archive.id)}
										variant='light'
									>
										<IconDownload size={18} />
									</ActionIcon>
								</Tooltip>

								<Tooltip label='Delete archive'>
									<ActionIcon
										color='red'
										onClick={() => handleDeleteArchive(archive)}
										variant='light'
									>
										<IconTrash size={18} />
									</ActionIcon>
								</Tooltip>
							</Group>
						</Group>
					</Card>
				))}
			</Stack>

			{/* Delete Confirmation Modal */}
			<Modal
				centered={true}
				onClose={() => !isDeleting && setDeleteModalOpen(false)}
				opened={deleteModalOpen}
				title='Delete Archive'
			>
				<Stack gap='md'>
					<Text>
						Are you sure you want to delete{' '}
						<strong>{archiveToDelete?.name}</strong>?
					</Text>
					<Text c='dimmed' size='sm'>
						This will remove the archive and all associated files and indexed
						events. This action cannot be undone.
					</Text>
					<Group justify='flex-end'>
						<Button
							disabled={isDeleting}
							onClick={() => setDeleteModalOpen(false)}
							variant='subtle'
						>
							Cancel
						</Button>
						<Button
							color='red'
							loading={isDeleting}
							onClick={confirmDeleteArchive}
						>
							Delete
						</Button>
					</Group>
				</Stack>
			</Modal>

			{/* Clear All Confirmation Modal */}
			<Modal
				centered={true}
				onClose={() => !isDeleting && setClearModalOpen(false)}
				opened={clearModalOpen}
				title='Clear All Archives'
			>
				<Stack gap='md'>
					<Text>
						Are you sure you want to clear{' '}
						<strong>all {archives.length}</strong> archives?
					</Text>
					<Text c='dimmed' size='sm'>
						This will permanently delete all archives, files, and indexed events
						from your browser storage. This action cannot be undone.
					</Text>
					<Group justify='flex-end'>
						<Button
							disabled={isDeleting}
							onClick={() => setClearModalOpen(false)}
							variant='subtle'
						>
							Cancel
						</Button>
						<Button color='red' loading={isDeleting} onClick={confirmClearAll}>
							Clear All
						</Button>
					</Group>
				</Stack>
			</Modal>
		</Stack>
	)
}
