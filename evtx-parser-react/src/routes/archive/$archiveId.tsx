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
import { Outlet, createFileRoute, useRouter, useSearch } from '@tanstack/react-router'
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

export interface ArchiveSearchParams {
	file?: string
	view?: string
	search?: string
	levels?: string
	event?: number
	page?: number
	pageSize?: number
	fieldsToExtract?: string
}

export const Route = createFileRoute('/archive/$archiveId')({
	component: ArchiveLayout,
	validateSearch: (search: Record<string, unknown>): ArchiveSearchParams => {
		const params: ArchiveSearchParams = {}
		if (search['file'] !== undefined) params.file = String(search['file'])
		if (search['view'] !== undefined) params.view = String(search['view'])
		if (search['search'] !== undefined) params.search = String(search['search'])
		if (search['levels'] !== undefined) params.levels = String(search['levels'])
		if (search['event'] !== undefined) params.event = Number(search['event'])
		if (search['page'] !== undefined) params.page = Number(search['page'])
		if (search['pageSize'] !== undefined)
			params.pageSize = Number(search['pageSize'])
		if (search['fieldsToExtract'] !== undefined)
			params.fieldsToExtract = String(search['fieldsToExtract'])
		return params
	},
})

function ArchiveLayout() {
	const router = useRouter()
	const {archiveId} = Route.useParams()
	const searchParams = useSearch({from: '/archive/$archiveId'})
	const currentFileName = searchParams.file ?? null
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
			to: '/archive/$archiveId',
			params: {archiveId},
			search: {file: name},
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

			<Outlet />
		</Stack>
	)
}
