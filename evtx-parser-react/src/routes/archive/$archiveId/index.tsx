import {Box, Divider, Group, Skeleton, Stack, Text} from '@mantine/core'
import {IconAlertCircle} from '@tabler/icons-react'
import {createFileRoute, useSearch} from '@tanstack/react-router'
import {EvtxViewer} from '@/components/EvtxViewer'
import {JsonViewer} from '@/components/JsonViewer'
import {TextViewer} from '@/components/TextViewer'
import type {EvtxCacheData} from '@/contexts/CacheContext'
import {useFileLoader} from '@/hooks/useFileLoader'
import {detectFileType} from '@/lib/fileTypes'
import type {ArchiveSearchParams} from '../$archiveId'

export const Route = createFileRoute('/archive/$archiveId/')({
	component: ArchiveIndex,
})

function ArchiveIndex() {
	const {archiveId} = Route.useParams()
	const searchParams = useSearch({strict: false}) as ArchiveSearchParams
	const fileName = searchParams.file

	if (!fileName) {
		return (
			<Box p='4rem'>
				<Text c='dimmed' size='lg' ta='center'>
					Select a file from the sidebar to view its contents
				</Text>
			</Box>
		)
	}

	return <FileViewer archiveId={archiveId} fileName={fileName} searchParams={searchParams} />
}

function EvtxSkeleton() {
	return (
		<Stack align='center' gap='md' w='100%'>
			{/* EventSummary row */}
			<Group gap='sm' w='100%'>
				{Array.from({length: 5}, (_, i) => (
					<Skeleton h={36} key={i} radius='md' w={100} />
				))}
			</Group>

			<Divider w='100%' />

			{/* Filters + view toggle row */}
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

			{/* Action bar */}
			<Group gap='sm' w='100%'>
				<Skeleton h={32} radius='sm' w={100} />
				<Skeleton h={32} radius='sm' w={80} />
				<Skeleton h={32} radius='sm' w={100} />
			</Group>

			<Divider w='100%' />

			{/* Event cards */}
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

function FileViewer({
	archiveId,
	fileName,
	searchParams,
}: {
	archiveId: string
	fileName: string
	searchParams: ArchiveSearchParams
}) {
	const fileType = detectFileType(fileName)
	const {data, isLoading, error} = useFileLoader(archiveId, fileName, fileType)

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
					selectedRecordId={searchParams.event ?? null}
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
