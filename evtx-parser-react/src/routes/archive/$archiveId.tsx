import {
	Badge,
	Box,
	Button,
	Divider,
	Group,
	Loader,
	Stack,
	Text,
	Title,
} from '@mantine/core'
import { spotlight } from '@mantine/spotlight'
import { IconRefresh, IconSearch } from '@tabler/icons-react'
import { Outlet, useParams, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ZipFileBrowser } from '@/components/ZipFileBrowser'
import { useCache } from '@/contexts/CacheContext'
import { useNavbar } from '@/contexts/NavbarContext'
import type { Archive } from '@/db/schema'
import * as dbService from '@/db/service'
import type { FileType } from '@/lib/fileTypes'

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
	const {setNavbarContent, closeMobile} = useNavbar()
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
		closeMobile() // Auto-close navbar on mobile
		await router.navigate({
			to: '/archive/$archiveId/file/$fileName',
			params: {archiveId, fileName},
		})
	}

	// Set navbar content when entries load
	useEffect(() => {
		if (!loading && !error && entries.length > 0) {
			setNavbarContent(
				<ZipFileBrowser
					currentFile={currentFileName}
					entries={entries}
					onFileClick={handleFileClick}
				/>,
			)
		}

		// Clear navbar when component unmounts
		return () => setNavbarContent(null)
	}, [entries, currentFileName, loading, error, setNavbarContent])

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

	const evtxCount = entries.filter((e) => e.type === 'evtx').length
	const jsonCount = entries.filter((e) => e.type === 'json').length
	const txtCount = entries.filter((e) => e.type === 'txt').length

	return (
		<Stack gap="lg">
			{/* Header section - now in main content area */}
			<Group justify="space-between" wrap="wrap">
				<Group gap="md">
					<Title order={3}>SysInfoZip Viewer</Title>
					<Badge color="blue" size="lg" variant="light">
						{archive.name}
					</Badge>
				</Group>

				<Group gap="sm">
					<Text c="dimmed" size="sm">
						{entries.length} files
						{evtxCount > 0 && ` • ${evtxCount} EVTX`}
						{jsonCount > 0 && ` • ${jsonCount} JSON`}
						{txtCount > 0 && ` • ${txtCount} TXT`}
					</Text>
				</Group>
			</Group>

			<Group gap="sm">
				<Button
					leftSection={<IconSearch size={18} />}
					onClick={() => spotlight.open()}
					variant="default"
				>
					Search Events
				</Button>

				{stats.evtx > 0 && (
					<>
						<Badge color="green" size="lg">
							{stats.evtx} EVTX cached
						</Badge>
						<Button
							color="red"
							onClick={clearCaches}
							size="sm"
							variant="light"
						>
							Clear Cache
						</Button>
					</>
				)}

				<Button
					leftSection={<IconRefresh size={18} />}
					ml="auto"
					onClick={() => router.navigate({to: '/'})}
					variant="light"
				>
					Load Another File
				</Button>
			</Group>

			<Divider />

			{/* Child route content (FileViewPage or ArchiveIndex) */}
			<Outlet />
		</Stack>
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
