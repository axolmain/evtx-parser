import {Box, Divider, Loader, Stack, Text, Title} from '@mantine/core'
import {Dropzone} from '@mantine/dropzone'
import {useRouter} from '@tanstack/react-router'
import {useEffect, useState} from 'react'
import {ArchiveManager} from '@/components/ArchiveManager'
import {useStandaloneFile} from '@/contexts/StandaloneFileContext'
import type {Archive} from '@/db/schema'
import * as dbService from '@/db/service'
import {uploadZipFile} from '@/lib/zipUploader'

export function HomePage() {
	const router = useRouter()
	const {setFile} = useStandaloneFile()
	const [isUploading, setIsUploading] = useState(false)
	const [uploadMessage, setUploadMessage] = useState('')
	const [archives, setArchives] = useState<Archive[]>([])

	useEffect(() => {
		dbService.getAllArchives().then(setArchives).catch(console.error)
	}, [])

	const refreshArchives = () => {
		dbService.getAllArchives().then(setArchives).catch(console.error)
	}

	const handleDrop = async (files: File[]) => {
		const file = files[0]
		if (!file) return

		const fileName = file.name.toLowerCase()

		if (fileName.endsWith('.zip') || fileName.endsWith('.sysinfozip')) {
			setIsUploading(true)
			try {
				const {archiveId} = await uploadZipFile(file, setUploadMessage)
				await router.navigate({
					to: '/archive/$archiveId',
					params: {archiveId}
				})
			} catch (error) {
				setUploadMessage(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				)
			} finally {
				setIsUploading(false)
			}
		} else if (
			fileName.endsWith('.evtx') ||
			fileName.endsWith('.txt') ||
			fileName.endsWith('.xml') ||
			fileName.endsWith('.json')
		) {
			setFile(file)
			await router.navigate({to: '/standalone'})
		}
	}

	const handleLoadArchive = async (archiveId: string) => {
		await router.navigate({
			to: '/archive/$archiveId',
			params: {archiveId}
		})
	}

	if (isUploading) {
		return (
			<Box maw={900} mx='auto' p='4rem'>
				<Stack align='center' gap='md'>
					<Loader size='lg' />
					<Text size='lg'>{uploadMessage || 'Loading...'}</Text>
				</Stack>
			</Box>
		)
	}

	return (
		<Box maw={1400} mx='auto' p='2rem' style={{minHeight: '100vh'}}>
			<Stack gap='xl'>
				<Stack align='center' gap='md'>
					<Title order={1}>SysInfoZip / EVTX Viewer</Title>
					<Text c='dimmed' maw={600} size='md' ta='center'>
						Upload a SysInfoZip archive to browse multiple log files, or drop a
						standalone .evtx, .json, .txt, or .xml file
					</Text>

					<Dropzone
						accept={{
							'application/zip': ['.zip'],
							'application/octet-stream': ['.evtx'],
							'application/json': ['.json'],
							'text/plain': ['.txt'],
							'text/xml': ['.xml']
						}}
						maw={700}
						onDrop={handleDrop}
						w='100%'
					>
						<Box p='3rem 2rem' ta='center'>
							<Dropzone.Accept>
								<Text mb='0.5rem' size='3rem'>
									📦
								</Text>
								<Text c='teal' size='md'>
									Drop file here
								</Text>
							</Dropzone.Accept>
							<Dropzone.Reject>
								<Text mb='0.5rem' size='3rem'>
									❌
								</Text>
								<Text c='red' size='md'>
									Only .zip, .evtx, .json, .txt, or .xml files allowed
								</Text>
							</Dropzone.Reject>
							<Dropzone.Idle>
								<Text mb='0.5rem' size='3rem'>
									📦
								</Text>
								<Text c='dimmed' size='md'>
									Drop a .zip, .evtx, .json, .txt, or .xml file here, or click
									to browse
								</Text>
								<Text c='dimmed' mt='sm' size='sm'>
									Supported: SysInfoZip archives (.zip), EVTX log files (.evtx),
									JSON files (.json), text files (.txt), and XML files (.xml)
								</Text>
							</Dropzone.Idle>
						</Box>
					</Dropzone>
				</Stack>

				{archives.length > 0 && (
					<>
						<Divider />
						<Box maw={700} mx='auto' w='100%'>
							<ArchiveManager
								archives={archives}
								onArchivesChange={refreshArchives}
								onLoadArchive={handleLoadArchive}
							/>
						</Box>
					</>
				)}
			</Stack>
		</Box>
	)
}
