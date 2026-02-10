import { useEffect, useState } from 'react'
import {
	Alert,
	Badge,
	Box,
	Button,
	Container,
	Divider,
	Group,
	Loader,
	Paper,
	Stack,
	Text,
	Title,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { IconAlertCircle, IconDownload, IconRefresh, IconSearch, IconTrash } from '@tabler/icons-react'
import { spotlight } from '@mantine/spotlight'
import { useFileViewer } from '@/hooks/useFileViewer'
import { ArchiveManager } from './ArchiveManager'
import { EvtxViewer } from './EvtxViewer'
import { JsonViewer } from './JsonViewer'
import { TextViewer } from './TextViewer'
import { ZipFileBrowser } from './ZipFileBrowser'

function UnsupportedFileViewer({ fileName }: { fileName: string }) {
	return (
		<Stack gap="md" align="center" style={{ padding: '4rem' }}>
			<IconAlertCircle size={64} color="var(--mantine-color-gray-6)" />
			<Title order={3}>Unsupported File Type</Title>
			<Text c="dimmed" ta="center" maw={500}>
				Cannot display <strong>{fileName}</strong>. Only EVTX, JSON, XML, and TXT
				files are supported.
			</Text>
		</Stack>
	)
}

function StandaloneTextViewer({ file, fileName, onReset }: { file: File; fileName: string; onReset: () => void }) {
	const [content, setContent] = useState<string>('')
	const [loading, setLoading] = useState(true)
	const isJson = fileName.toLowerCase().endsWith('.json')

	useEffect(() => {
		async function loadContent() {
			try {
				const text = await file.text()
				// If it's a JSON file, try to format it
				if (isJson) {
					try {
						const parsed = JSON.parse(text)
						setContent(JSON.stringify(parsed, null, 2))
					} catch {
						// If parsing fails, just show as-is
						setContent(text)
					}
				} else {
					setContent(text)
				}
			} catch (error) {
				console.error('Failed to load text file:', error)
			} finally {
				setLoading(false)
			}
		}
		loadContent()
	}, [file, isJson])

	const downloadFile = () => {
		const blob = new Blob([content], { type: 'text/plain' })
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
		<Container size="xl" style={{ minHeight: '100vh', padding: '2rem' }}>
			<Stack gap="md">
				<Group justify="space-between">
					<Title order={1}>Text Viewer - {fileName}</Title>
					<Group gap="xs">
						<Button
							size="xs"
							variant="light"
							leftSection={<IconDownload size={16} />}
							onClick={downloadFile}
							disabled={loading}
						>
							Download
						</Button>
						<Button
							size="xs"
							variant="subtle"
							leftSection={<IconRefresh size={16} />}
							onClick={onReset}
						>
							Load Another File
						</Button>
					</Group>
				</Group>
				{loading ? (
					<Container size="md" style={{ padding: '4rem' }}>
						<Stack gap="md" align="center">
							<Loader size="lg" />
							<Text size="lg">Loading {fileName}...</Text>
						</Stack>
					</Container>
				) : (
					<Paper
						withBorder
						p="md"
						style={{
							maxHeight: 'calc(100vh - 10rem)',
							overflow: 'auto',
						}}
					>
						<Text
							component="pre"
							ff="monospace"
							size="sm"
							style={{
								whiteSpace: 'pre-wrap',
								wordBreak: 'break-word',
								margin: 0,
							}}
						>
							{content}
						</Text>
					</Paper>
				)}
			</Stack>
		</Container>
	)
}

export function FileViewer() {
	const viewer = useFileViewer()

	const handleDrop = (files: File[]) => {
		const file = files[0]
		if (!file) return

		const fileName = file.name.toLowerCase()

		if (fileName.endsWith('.zip') || fileName.endsWith('.sysinfozip')) {
			viewer.loadZipFile(file)
		} else if (fileName.endsWith('.evtx')) {
			viewer.viewStandaloneEvtx(file)
		} else if (fileName.endsWith('.txt') || fileName.endsWith('.xml') || fileName.endsWith('.json')) {
			viewer.viewStandaloneText(file)
		}
	}

	const renderContent = () => {
		// Error state
		if (viewer.state.status === 'error') {
			return (
				<Container size="lg" style={{ padding: '4rem' }}>
					<Alert
						icon={<IconAlertCircle size={20} />}
						title="Error"
						color="red"
						withCloseButton
						onClose={viewer.clearError}
					>
						{viewer.state.error}
					</Alert>
				</Container>
			)
		}

		// Loading zip
		if (viewer.state.status === 'loading-zip') {
			return (
				<Container size="lg" style={{ padding: '4rem' }}>
					<Stack gap="md" align="center">
						<Loader size="lg" />
						<Text size="lg">Loading {viewer.state.fileName}...</Text>
					</Stack>
				</Container>
			)
		}

		// Standalone EVTX mode (backwards compatibility)
		if (viewer.state.status === 'standalone-evtx') {
			return (
				<Container size="xl" style={{ minHeight: '100vh', padding: '2rem' }}>
					<Stack gap="md" align="center">
						<Group>
							<Title order={1}>EVTX → Raw Byte Dump</Title>
							<Button
								size="xs"
								variant="subtle"
								leftSection={<IconRefresh size={16} />}
								onClick={viewer.reset}
							>
								Load Another File
							</Button>
						</Group>
						<EvtxViewer file={viewer.state.file} />
					</Stack>
				</Container>
			)
		}

		// Standalone text/XML mode
		if (viewer.state.status === 'standalone-text') {
			return <StandaloneTextViewer file={viewer.state.file} fileName={viewer.state.fileName} onReset={viewer.reset} />
		}

		// Zip loaded - show browser + content
		if (
			viewer.state.status === 'zip-loaded' ||
			viewer.state.status === 'viewing-file'
		) {
			const isViewing = viewer.state.status === 'viewing-file'
			const currentFile = viewer.state.currentFile
			const isLoading =
				viewer.state.status === 'viewing-file' && viewer.state.isLoading

			return (
				<Box style={{ display: 'flex', minHeight: '100vh' }}>
					{/* Sidebar */}
					<ZipFileBrowser
						entries={viewer.state.entries}
						currentFile={currentFile?.name || null}
						onFileClick={viewer.viewFile}
						loadingFile={isLoading && currentFile ? currentFile.name : null}
					/>

					{/* Content Area */}
					<Box style={{ flex: 1, padding: '2rem' }}>
						<Stack gap="lg">
							{/* Header */}
							<Group justify="space-between">
								<Stack gap="xs">
									<Group>
										<Title order={2}>SysInfoZip Viewer</Title>
										<Badge size="lg" variant="light">
											{viewer.state.zipFileName}
										</Badge>
									</Group>
									<Text size="sm" c="dimmed">
										{viewer.state.entries.length} files •{' '}
										{viewer.state.entries.filter((e) => e.type === 'evtx').length}{' '}
										EVTX •{' '}
										{viewer.state.entries.filter((e) => e.type === 'json').length}{' '}
										JSON •{' '}
										{viewer.state.entries.filter((e) => e.type === 'txt').length} TXT
									</Text>
								</Stack>
								<Group gap="xs">
									<Button
										size="xs"
										variant="light"
										leftSection={<IconSearch size={14} />}
										onClick={() => spotlight.open()}
										rightSection={
											<Badge size="xs" variant="light">
												⌘K
											</Badge>
										}
									>
										Search Events
									</Button>
									{viewer.cacheStats.evtx > 0 && (
										<Badge size="sm" variant="dot" color="blue">
											{viewer.cacheStats.evtx} EVTX cached
										</Badge>
									)}
									{(viewer.cacheStats.evtx > 0 ||
										viewer.cacheStats.json > 0 ||
										viewer.cacheStats.txt > 0) && (
										<Button
											size="xs"
											variant="subtle"
											color="gray"
											leftSection={<IconTrash size={14} />}
											onClick={viewer.clearCaches}
										>
											Clear Cache
										</Button>
									)}
									<Button
										size="xs"
										variant="light"
										leftSection={<IconRefresh size={14} />}
										onClick={viewer.reset}
									>
										Load Another File
									</Button>
								</Group>
							</Group>

							{/* File Content */}
							{!isViewing && (
								<Container size="md" style={{ padding: '4rem' }}>
									<Text size="lg" c="dimmed" ta="center">
										Select a file from the sidebar to view its contents
									</Text>
								</Container>
							)}

							{isViewing && isLoading && (
								<Container size="md" style={{ padding: '4rem' }}>
									<Stack gap="md" align="center">
										<Loader size="lg" />
										<Text size="lg">
											Loading {currentFile?.name || 'file'}...
										</Text>
									</Stack>
								</Container>
							)}

							{isViewing && !isLoading && currentFile && (
								<>
									{currentFile.type === 'evtx' && (() => {
										const cachedData = viewer.getCachedContent(
											viewer.state.zipFileName,
											currentFile.name,
											'evtx'
										)
										if (!cachedData) {
											return (
												<Container size="md" style={{ padding: '2rem' }}>
													<Text c="dimmed">Parsing EVTX file...</Text>
												</Container>
											)
										}
										// Type guard to ensure cachedData is EvtxCacheData
										const evtxData = cachedData as {
											result: any
											fileSize: number
											parseTime: number
											fileName: string
										}
										return (
											<EvtxViewer
												parsedResult={evtxData.result}
												fileName={evtxData.fileName}
												fileSize={evtxData.fileSize}
												parseTime={evtxData.parseTime}
											/>
										)
									})()}

									{currentFile.type === 'json' && (() => {
										const cachedContent = viewer.getCachedContent(
											viewer.state.zipFileName,
											currentFile.name,
											'json'
										)
										return cachedContent ? (
											<JsonViewer
												content={cachedContent}
												fileName={currentFile.name}
											/>
										) : null
									})()}

									{(currentFile.type === 'txt' || currentFile.type === 'xml') && (() => {
										const cachedContent = viewer.getCachedContent(
											viewer.state.zipFileName,
											currentFile.name,
											currentFile.type
										)
										return cachedContent ? (
											<TextViewer
												content={cachedContent as string}
												fileName={currentFile.name}
											/>
										) : null
									})()}

									{currentFile.type === 'unknown' && (
										<UnsupportedFileViewer fileName={currentFile.name} />
									)}
								</>
							)}
						</Stack>
					</Box>
				</Box>
			)
		}

		// Default idle state - show dropzone and recent archives
		return (
			<Container size="xl" style={{ minHeight: '100vh', padding: '2rem' }}>
				<Stack gap="xl">
					<Stack gap="md" align="center">
						<Title order={1}>SysInfoZip / EVTX Viewer</Title>
						<Text size="md" c="dimmed" ta="center" maw={600}>
							Upload a SysInfoZip archive to browse multiple log files, or drop a
							standalone .evtx, .json, .txt, or .xml file
						</Text>

						<Dropzone
							onDrop={handleDrop}
							accept={{
								'application/zip': ['.zip'],
								'application/octet-stream': ['.evtx'],
								'application/json': ['.json'],
								'text/plain': ['.txt'],
								'text/xml': ['.xml'],
							}}
							style={{ width: '100%', maxWidth: '700px' }}
						>
							<div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
								<Dropzone.Accept>
									<div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
										📦
									</div>
									<Text size="md" c="teal">
										Drop file here
									</Text>
								</Dropzone.Accept>
								<Dropzone.Reject>
									<div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
										❌
									</div>
									<Text size="md" c="red">
										Only .zip, .evtx, .json, .txt, or .xml files allowed
									</Text>
								</Dropzone.Reject>
								<Dropzone.Idle>
									<div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
										📦
									</div>
									<Text size="md" c="dimmed">
										Drop a .zip, .evtx, .json, .txt, or .xml file here, or click to browse
									</Text>
									<Text size="sm" c="dimmed" mt="sm">
										Supported: SysInfoZip archives (.zip), EVTX log files (.evtx),
										JSON files (.json), text files (.txt), and XML files (.xml)
									</Text>
								</Dropzone.Idle>
							</div>
						</Dropzone>
					</Stack>

					{/* Recent Archives */}
					{viewer.state.status === 'idle' &&
						viewer.state.recentArchives.length > 0 && (
							<>
								<Divider />
								<Box style={{ maxWidth: '700px', width: '100%', margin: '0 auto' }}>
									<ArchiveManager
										archives={viewer.state.recentArchives}
										onLoadArchive={viewer.loadArchive}
										onArchivesChange={viewer.reset}
									/>
								</Box>
							</>
						)}
				</Stack>
			</Container>
		)
	}

	return <>{renderContent()}</>
}
