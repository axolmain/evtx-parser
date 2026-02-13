import {Box, Loader, Stack, Text} from '@mantine/core'
import {IconAlertCircle} from '@tabler/icons-react'
import {useParams, useSearch} from '@tanstack/react-router'
import {EvtxViewer} from '@/components/EvtxViewer'
import {JsonViewer} from '@/components/JsonViewer'
import {TextViewer} from '@/components/TextViewer'
import type {EvtxCacheData} from '@/contexts/CacheContext'
import {useFileLoader} from '@/hooks/useFileLoader'
import {detectFileType} from '@/lib/fileTypes'
import type {FileSearchParams} from '@/router'

function UnsupportedFileViewer({fileName}: {fileName: string}) {
	return (
		<Stack align='center' gap='md' p='4rem'>
			<IconAlertCircle color='var(--mantine-color-gray-6)' size={64} />
			<Text fw={600} size='lg'>
				Unsupported File Type
			</Text>
			<Text c='dimmed' maw={500} ta='center'>
				Cannot display <strong>{fileName}</strong>. Only EVTX, JSON, XML, and
				TXT files are supported.
			</Text>
		</Stack>
	)
}

export function FileViewPage() {
	const {archiveId, fileName} = useParams({strict: false}) as {
		archiveId: string
		fileName: string
	}
	const searchParams = useSearch({strict: false}) as FileSearchParams

	const decodedFileName = decodeURIComponent(fileName)
	const fileType = detectFileType(decodedFileName)

	const {data, isLoading, error} = useFileLoader(
		archiveId,
		decodedFileName,
		fileType
	)

	if (isLoading && !data) {
		return (
			<Box p='4rem'>
				<Stack align='center' gap='md'>
					<Loader size='lg' />
					<Text size='lg'>Loading {decodedFileName}...</Text>
				</Stack>
			</Box>
		)
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
			return <JsonViewer content={data} fileName={decodedFileName} />
		case 'txt':
		case 'xml':
			return <TextViewer content={data as string} fileName={decodedFileName} />
		default:
			return <UnsupportedFileViewer fileName={decodedFileName} />
	}
}
