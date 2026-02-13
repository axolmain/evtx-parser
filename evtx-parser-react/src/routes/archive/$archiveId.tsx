import {
	Badge,
	Box,
	Button,
	Divider,
	Group,
	Loader,
	Skeleton,
	Stack,
	Tabs,
	Text,
	Title,
	Tooltip,
} from '@mantine/core'
import {spotlight} from '@mantine/spotlight'
import {
	IconAlertCircle,
	IconFileText,
	IconFileTypography,
	IconJson,
	IconQuestionMark,
	IconRefresh,
	IconSearch,
} from '@tabler/icons-react'
import {createFileRoute, useRouter, useSearch} from '@tanstack/react-router'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {EvtxViewer} from '@/components/EvtxViewer'
import {JsonViewer} from '@/components/JsonViewer'
import {TextViewer} from '@/components/TextViewer'
import type {EvtxCacheData} from '@/contexts/CacheContext'
import {useCache} from '@/contexts/CacheContext'
import type {Archive} from '@/db/schema'
import * as dbService from '@/db/service'
import {useFileLoader} from '@/hooks/useFileLoader'
import {detectFileType, type FileType} from '@/lib/fileTypes'

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

/* ─── helpers ─── */

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FILE_META: Record<string, {icon: typeof IconFileText; color: string; label: string}> = {
	evtx: {icon: IconFileText, color: 'var(--mantine-color-blue-6)', label: 'EVTX'},
	json: {icon: IconJson, color: 'var(--mantine-color-green-6)', label: 'JSON'},
	xml: {icon: IconFileText, color: 'var(--mantine-color-orange-6)', label: 'XML'},
	txt: {icon: IconFileTypography, color: 'var(--mantine-color-gray-6)', label: 'Text'},
}

function FileGroup({files, type}: {files: ArchiveFileEntry[]; type: string}) {
	if (files.length === 0) return null
	const meta = FILE_META[type]
	const Icon = meta?.icon ?? IconQuestionMark
	const color = meta?.color ?? 'var(--mantine-color-gray-6)'
	const label = meta?.label ?? 'Other'

	return (
		<>
			<Group gap='xs' px='sm' py={4}>
				<Text c='dimmed' fw={600} size='xs' tt='uppercase'>{label}</Text>
				<Badge size='xs' variant='light'>{files.length}</Badge>
			</Group>
			{files.map(entry => (
				<Tabs.Tab
					key={entry.name}
					leftSection={<Icon color={color} size={16} />}
					value={entry.name}
				>
					<Stack gap={0}>
						<Tooltip disabled={entry.name.length < 25} label={entry.name}>
							<Text size='sm' style={{maxWidth: 180}} truncate>{entry.name}</Text>
						</Tooltip>
						<Text c='dimmed' size='xs'>{formatFileSize(entry.size)}</Text>
					</Stack>
				</Tabs.Tab>
			))}
		</>
	)
}

/* ─── skeletons ─── */

function EvtxSkeleton() {
	return (
		<Stack align='center' gap='md' w='100%'>
			<Group gap='sm' w='100%'>
				{Array.from({length: 5}, (_, i) => (
					<Skeleton h={36} key={i} radius='md' w={100} />
				))}
			</Group>
			<Divider w='100%' />
			<Group justify='space-between' w='100%'>
				<Group gap='sm'>
					<Skeleton h={36} radius='sm' w={250} />
					{Array.from({length: 5}, (_, i) => (
						<Skeleton h={28} key={i} radius='xl' w={70} />
					))}
				</Group>
				<Group gap='sm'>
					<Skeleton h={36} radius='sm' w={80} />
					<Skeleton h={36} radius='sm' w={80} />
				</Group>
			</Group>
			<Group gap='sm' w='100%'>
				<Skeleton h={32} radius='sm' w={100} />
				<Skeleton h={32} radius='sm' w={80} />
				<Skeleton h={32} radius='sm' w={100} />
			</Group>
			<Divider w='100%' />
			{Array.from({length: 6}, (_, i) => (
				<Skeleton h={80} key={i} radius='sm' w='100%' />
			))}
		</Stack>
	)
}

function TextSkeleton() {
	return (
		<Stack gap='md' w='100%'>
			<Skeleton h={24} radius='sm' w='60%' />
			<Skeleton h={400} radius='sm' w='100%' />
		</Stack>
	)
}

/* ─── FileViewer ─── */

function FileViewer({
	archiveId,
	fileName,
	isActive,
	selectedRecordId,
}: {
	archiveId: string
	fileName: string
	isActive: boolean
	selectedRecordId: number | null
}) {
	const fileType = detectFileType(fileName)
	const {data, isLoading, error} = useFileLoader(archiveId, fileName, fileType)

	const prevActive = useRef(isActive)
	useEffect(() => {
		if (isActive && !prevActive.current) {
			console.log(`[nav] switched to ${fileName} (keep-alive, no re-render)`)
		}
		prevActive.current = isActive
	}, [isActive, fileName])

	if (isLoading && !data) {
		return fileType === 'evtx' ? <EvtxSkeleton /> : <TextSkeleton />
	}

	if (error) {
		return (
			<Box p='4rem'>
				<Stack align='center' gap='md'>
					<IconAlertCircle color='var(--mantine-color-red-6)' size={48} />
					<Text c='red'>{error}</Text>
				</Stack>
			</Box>
		)
	}

	if (!data) return null

	switch (fileType) {
		case 'evtx': {
			const evtxData = data as EvtxCacheData
			return (
				<EvtxViewer
					fileName={evtxData.fileName}
					fileSize={evtxData.fileSize}
					parsedResult={evtxData.result}
					parseTime={evtxData.parseTime}
					selectedRecordId={selectedRecordId}
				/>
			)
		}
		case 'json':
			return <JsonViewer content={data} fileName={fileName} />
		case 'txt':
		case 'xml':
			return <TextViewer content={data as string} fileName={fileName} />
		default:
			return (
				<Stack align='center' gap='md' p='4rem'>
					<IconAlertCircle color='var(--mantine-color-gray-6)' size={64} />
					<Text fw={600} size='lg'>Unsupported File Type</Text>
					<Text c='dimmed' maw={500} ta='center'>
						Cannot display <strong>{fileName}</strong>. Only EVTX, JSON, XML, and
						TXT files are supported.
					</Text>
				</Stack>
			)
	}
}

/* ─── layout ─── */

function ArchiveLayout() {
	const router = useRouter()
	const {archiveId} = Route.useParams()
	const searchParams = useSearch({from: '/archive/$archiveId'})
	const currentFileName = searchParams.file ?? null
	const {clearCaches, cacheStats} = useCache()
	const [archive, setArchive] = useState<Archive | null>(null)
	const [entries, setEntries] = useState<ArchiveFileEntry[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Track opened files — grow-only ref so panels stay mounted via keepMounted
	const openedFilesRef = useRef<string[]>([])
	if (currentFileName && !openedFilesRef.current.includes(currentFileName)) {
		openedFilesRef.current = [...openedFilesRef.current, currentFileName]
	}
	const openedFiles = openedFilesRef.current

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

	const handleTabChange = useCallback((value: string | null) => {
		if (!value) return
		router.navigate({
			to: '/archive/$archiveId',
			params: {archiveId},
			search: {file: value},
		})
	}, [archiveId, router])

	const groups = useMemo(() => {
		const g: Record<string, ArchiveFileEntry[]> = {evtx: [], json: [], xml: [], txt: [], other: []}
		for (const e of entries) {
			(g[e.type] ?? g.other).push(e)
		}
		return g
	}, [entries])

	const counts = useMemo(() => {
		let evtx = 0, json = 0, txt = 0
		for (const e of entries) {
			if (e.type === 'evtx') evtx++
			else if (e.type === 'json') json++
			else if (e.type === 'txt') txt++
		}
		return {evtx, json, txt}
	}, [entries])

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
		<Stack gap='lg' style={{height: 'calc(100vh - 60px - 2 * var(--mantine-spacing-md))'}}>
			<Group justify='space-between' wrap='wrap'>
				<Group gap='md'>
					<Title order={3}>SysInfoZip Viewer</Title>
					<Badge color='blue' size='lg' variant='light'>
						{archive.name}
					</Badge>
				</Group>

				<Group gap='sm'>
					<Text c='dimmed' size='sm'>
						{entries.length} files
						{counts.evtx > 0 && ` \u2022 ${counts.evtx} EVTX`}
						{counts.json > 0 && ` \u2022 ${counts.json} JSON`}
						{counts.txt > 0 && ` \u2022 ${counts.txt} TXT`}
					</Text>
				</Group>
			</Group>

			<Group gap='sm'>
				<Button
					leftSection={<IconSearch size={18} />}
					onClick={() => spotlight.open()}
					variant='default'
				>
					Search Events
				</Button>

				{stats.evtx > 0 && (
					<>
						<Badge color='green' size='lg'>
							{stats.evtx} EVTX cached
						</Badge>
						<Button
							color='red'
							onClick={clearCaches}
							size='sm'
							variant='light'
						>
							Clear Cache
						</Button>
					</>
				)}

				<Button
					leftSection={<IconRefresh size={18} />}
					ml='auto'
					onClick={() => router.navigate({to: '/'})}
					variant='light'
				>
					Load Another File
				</Button>
			</Group>

			<Divider />

			<Tabs
				keepMounted
				onChange={handleTabChange}
				orientation='vertical'
				value={currentFileName}
				styles={{
					root: {flex: 1, minHeight: 0},
					list: {width: 280, overflowY: 'auto'},
					panel: {flex: 1, overflowY: 'auto', paddingLeft: 'var(--mantine-spacing-md)'},
				}}
			>
				<Tabs.List>
					<FileGroup files={groups.evtx} type='evtx' />
					<FileGroup files={groups.json} type='json' />
					<FileGroup files={groups.xml} type='xml' />
					<FileGroup files={groups.txt} type='txt' />
					<FileGroup files={groups.other} type='other' />
				</Tabs.List>

				{openedFiles.map(file => (
					<Tabs.Panel key={file} value={file}>
						<FileViewer
							archiveId={archiveId}
							fileName={file}
							isActive={file === currentFileName}
							selectedRecordId={file === currentFileName ? (searchParams.event ?? null) : null}
						/>
					</Tabs.Panel>
				))}

				{!currentFileName && (
					<Box p='4rem' style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
						<Text c='dimmed' size='lg'>
							Select a file to view its contents
						</Text>
					</Box>
				)}
			</Tabs>
		</Stack>
	)
}
