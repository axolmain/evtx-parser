import {
	Badge,
	Box,
	Button,
	Group,
	Loader,
	Stack,
	Text,
	Title
} from '@mantine/core'
import {spotlight} from '@mantine/spotlight'
import {IconRefresh, IconSearch, IconTrash} from '@tabler/icons-react'
import {Outlet, useParams, useRouter} from '@tanstack/react-router'
import {useEffect, useState} from 'react'
import {ZipFileBrowser} from '@/components/ZipFileBrowser'
import {useCache} from '@/contexts/CacheContext'
import type {Archive} from '@/db/schema'
import * as dbService from '@/db/service'
import type {FileType} from '@/lib/fileTypes'

export interface ArchiveFileEntry {
	name: string
	size: number
	compressedSize: number
	type: FileType
}

export function ArchiveLayout() {
	const router = useRouter()
	const {archiveId} = useParams({strict: false}) as {archiveId: string}
	const {clearCaches, cacheStats} = useCache()
	const [archive, setArchive] = useState<Archive | null>(null)
	const [entries, setEntries] = useState<ArchiveFileEntry[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [currentFileName, setCurrentFileName] = useState<string | null>(null)

	useEffect(() => {
		async function loadArchive() {
			setLoading(true)
			setError(null)
			try {
				const arch = await dbService.getArchive(archiveId)
				if (!arch) {
					setError('Archive not found')
					return
				}
				setArchive(arch)

				const files = await dbService.getFilesByArchive(archiveId)
				setEntries(
					files.map(f => ({
						name: f.name,
						size: f.size,
						compressedSize: f.size,
						type: f.type
					}))
				)
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load archive')
			} finally {
				setLoading(false)
			}
		}
		loadArchive()
	}, [archiveId])

	// Track current file from URL - use window.location since we're in hash routing
	useEffect(() => {
		const hash = window.location.hash
		const fileMatch = /\/file\/(.+?)(?:\?|$)/.exec(hash)
		if (fileMatch?.[1]) {
			setCurrentFileName(decodeURIComponent(fileMatch[1]))
		} else {
			setCurrentFileName(null)
		}
	})

	const handleFileClick = async (fileName: string) => {
		setCurrentFileName(fileName)
		await router.navigate({
			to: '/archive/$archiveId/file/$fileName',
			params: {archiveId, fileName}
		})
	}

	const stats = cacheStats()

	if (loading) {
		return (
			<Box p='4rem'>
				<Stack align='center' gap='md'>
					<Loader size='lg' />
					<Text size='lg'>Loading archive...</Text>
				</Stack>
			</Box>
		)
	}

	if (error || !archive) {
		return (
			<Box maw={900} mx='auto' p='4rem'>
				<Stack align='center' gap='md'>
					<Title order={2}>Archive Not Found</Title>
					<Text c='dimmed'>
						{error ?? 'This archive may have been deleted.'}
					</Text>
					<Button onClick={() => router.navigate({to: '/'})} variant='light'>
						Go Home
					</Button>
				</Stack>
			</Box>
		)
	}

	return (
		<Box
			style={{
				display: 'flex',
				minHeight: '100vh',
				maxWidth: '100vw',
				overflow: 'hidden'
			}}
		>
			{/* Sidebar */}
			<ZipFileBrowser
				currentFile={currentFileName}
				entries={entries}
				onFileClick={handleFileClick}
			/>

			{/* Content Area */}
			<Box
				style={{
					flex: 1,
					padding: '2rem',
					overflow: 'auto',
					minWidth: 0
				}}
			>
				<Stack gap='lg'>
					{/* Header */}
					<Group justify='space-between' wrap='wrap'>
						<Stack gap='xs' style={{minWidth: 0}}>
							<Group wrap='wrap'>
								<Title order={2}>SysInfoZip Viewer</Title>
								<Badge size='lg' variant='light'>
									{archive.name}
								</Badge>
							</Group>
							<Text c='dimmed' size='sm'>
								{entries.length} files •{' '}
								{entries.filter(e => e.type === 'evtx').length} EVTX •{' '}
								{entries.filter(e => e.type === 'json').length} JSON •{' '}
								{entries.filter(e => e.type === 'txt').length} TXT
							</Text>
						</Stack>
						<Group gap='xs' wrap='wrap'>
							<Button
								leftSection={<IconSearch size={14} />}
								onClick={() => spotlight.open()}
								rightSection={
									<Badge size='xs' variant='light'>
										⌘K
									</Badge>
								}
								size='xs'
								variant='light'
							>
								Search Events
							</Button>
							{stats.evtx > 0 && (
								<Badge color='blue' size='sm' variant='dot'>
									{stats.evtx} EVTX cached
								</Badge>
							)}
							{(stats.evtx > 0 || stats.json > 0 || stats.txt > 0) && (
								<Button
									color='gray'
									leftSection={<IconTrash size={14} />}
									onClick={clearCaches}
									size='xs'
									variant='subtle'
								>
									Clear Cache
								</Button>
							)}
							<Button
								leftSection={<IconRefresh size={14} />}
								onClick={() => router.navigate({to: '/'})}
								size='xs'
								variant='light'
							>
								Load Another File
							</Button>
						</Group>
					</Group>

					{/* Child route content (FileViewPage or ArchiveIndex) */}
					<Outlet />
				</Stack>
			</Box>
		</Box>
	)
}

export function ArchiveIndex() {
	return (
		<Box p='4rem'>
			<Text c='dimmed' size='lg' ta='center'>
				Select a file from the sidebar to view its contents
			</Text>
		</Box>
	)
}
