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
import { Outlet, createFileRoute, useParams, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
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

export const Route = createFileRoute('/archive/$archiveId')({
	component: ArchiveLayout,
})

function ArchiveLayout() {
	const router = useRouter()
	const {archiveId, fileName} = useParams({strict: false}) as {archiveId: string; fileName?: string}
	const currentFileName = fileName ?? null
	const {clearCaches, cacheStats} = useCache()
	const {setNavbarContent, openDesktop, closeMobile} = useNavbar()
	const [archive, setArchive] = useState<Archive | null>(null)
	const [entries, setEntries] = useState<ArchiveFileEntry[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Open the sidebar when entering an archive
	useEffect(() => { openDesktop() }, [openDesktop])

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

	const handleFileClick = useCallback(async (name: string) => {
		closeMobile()
		await router.navigate({
			to: '/archive/$archiveId/file/$fileName',
			params: {archiveId, fileName: name},
		})
	}, [archiveId, closeMobile, router])

	// Set navbar content when entries load or current file changes
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

		return () => setNavbarContent(null)
	}, [entries, currentFileName, loading, error, setNavbarContent, handleFileClick])

	const stats = cacheStats()

	const counts = useMemo(() => {
		let evtx = 0, json = 0, txt = 0
		for (const e of entries) {
			if (e.type === 'evtx') evtx++
			else if (e.type === 'json') json++
			else if (e.type === 'txt') txt++
		}
		return {evtx, json, txt}
	}, [entries])

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
						{counts.evtx > 0 && ` • ${counts.evtx} EVTX`}
						{counts.json > 0 && ` • ${counts.json} JSON`}
						{counts.txt > 0 && ` • ${counts.txt} TXT`}
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
