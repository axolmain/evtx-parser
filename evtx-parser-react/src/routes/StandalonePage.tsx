import {
	Box,
	Button,
	Group,
	Loader,
	Paper,
	Stack,
	Text,
	Title
} from '@mantine/core'
import {IconDownload, IconRefresh} from '@tabler/icons-react'
import {useRouter} from '@tanstack/react-router'
import {useEffect, useState} from 'react'
import {EvtxViewer} from '@/components/EvtxViewer'
import {useStandaloneFile} from '@/contexts/StandaloneFileContext'

function StandaloneTextViewer({
	file,
	fileName,
	onReset
}: {
	file: File
	fileName: string
	onReset: () => void
}) {
	const [content, setContent] = useState<string>('')
	const [loading, setLoading] = useState(true)
	const isJson = fileName.toLowerCase().endsWith('.json')

	useEffect(() => {
		async function loadContent() {
			try {
				const text = await file.text()
				if (isJson) {
					try {
						const parsed: unknown = JSON.parse(text)
						setContent(JSON.stringify(parsed, null, 2))
					} catch {
						setContent(text)
					}
				} else {
					setContent(text)
				}
			} catch {
			} finally {
				setLoading(false)
			}
		}
		loadContent()
	}, [file, isJson])

	const downloadFile = () => {
		const blob = new Blob([content], {type: 'text/plain'})
		const url = URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.href = url
		link.download = fileName
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
		URL.revokeObjectURL(url)
	}

	return (
		<Box maw={1400} mx='auto' p='2rem' style={{minHeight: '100vh'}}>
			<Stack gap='md'>
				<Group justify='space-between' wrap='wrap'>
					<Title order={1}>Text Viewer - {fileName}</Title>
					<Group gap='xs'>
						<Button
							disabled={loading}
							leftSection={<IconDownload size={16} />}
							onClick={downloadFile}
							size='xs'
							variant='light'
						>
							Download
						</Button>
						<Button
							leftSection={<IconRefresh size={16} />}
							onClick={onReset}
							size='xs'
							variant='subtle'
						>
							Load Another File
						</Button>
					</Group>
				</Group>
				{loading ? (
					<Box p='4rem'>
						<Stack align='center' gap='md'>
							<Loader size='lg' />
							<Text size='lg'>Loading {fileName}...</Text>
						</Stack>
					</Box>
				) : (
					<Paper
						p='md'
						style={{
							maxHeight: 'calc(100vh - 10rem)',
							overflow: 'auto'
						}}
						withBorder={true}
					>
						<Text
							component='pre'
							ff='monospace'
							size='sm'
							style={{
								whiteSpace: 'pre-wrap',
								wordBreak: 'break-word',
								margin: 0
							}}
						>
							{content}
						</Text>
					</Paper>
				)}
			</Stack>
		</Box>
	)
}

export function StandalonePage() {
	const router = useRouter()
	const {file, clear} = useStandaloneFile()

	// Redirect to home if no file (e.g. page refresh)
	useEffect(() => {
		if (!file) {
			router.navigate({to: '/'})
		}
	}, [file, router])

	if (!file) return null

	const fileName = file.name
	const isEvtx = fileName.toLowerCase().endsWith('.evtx')

	const handleReset = () => {
		clear()
		router.navigate({to: '/'})
	}

	if (isEvtx) {
		return (
			<Box p='2rem' style={{minHeight: '100vh'}}>
				<Stack align='center' gap='md'>
					<Group>
						<Title order={1}>EVTX → Raw Byte Dump</Title>
						<Button
							leftSection={<IconRefresh size={16} />}
							onClick={handleReset}
							size='xs'
							variant='subtle'
						>
							Load Another File
						</Button>
					</Group>
					<EvtxViewer file={file} selectedRecordId={null} />
				</Stack>
			</Box>
		)
	}

	return (
		<StandaloneTextViewer
			file={file}
			fileName={fileName}
			onReset={handleReset}
		/>
	)
}
