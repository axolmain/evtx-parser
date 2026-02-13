import {useCallback, useEffect, useState} from 'react'
import type {EvtxCacheData} from '@/contexts/CacheContext'
import {useCache} from '@/contexts/CacheContext'
import * as dbService from '@/db/service'
import {parseBuffer} from '@/hooks/useEvtxParserHelpers'
import type {FileType} from '@/lib/fileTypes'

interface FileLoaderResult {
	data: EvtxCacheData | unknown | string | null
	isLoading: boolean
	error: string | null
	reload: () => void
}

export function useFileLoader(
	archiveId: string,
	fileName: string,
	fileType: FileType
): FileLoaderResult {
	const {getCachedContent, setCachedContent} = useCache()
	const [data, setData] = useState<EvtxCacheData | unknown | string | null>(
		null
	)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		setIsLoading(true)
		setError(null)
		setData(null)

		try {
			// Check memory cache first
			const cached = getCachedContent(archiveId, fileName, fileType)
			if (cached !== null) {
				setData(cached)
				setIsLoading(false)
				return
			}

			const fileId = dbService.generateFileId(archiveId, fileName)

			switch (fileType) {
				case 'evtx': {
					const storedFile = await dbService.getFile(fileId)
					if (storedFile?.parsedData) {
						const parsedData = storedFile.parsedData as EvtxCacheData
						setCachedContent(archiveId, fileName, 'evtx', parsedData)
						setData(parsedData)
						setIsLoading(false)
						return
					}

					if (!storedFile) throw new Error('File not found in database')

					const buffer = await storedFile.blob.arrayBuffer()
					const {result, parseTime} = await parseBuffer(buffer)

					const evtxData: EvtxCacheData = {
						result,
						fileSize: buffer.byteLength,
						parseTime,
						fileName: fileName.replace(/\.evtx$/i, '')
					}

					setCachedContent(archiveId, fileName, 'evtx', evtxData)
					await dbService.updateFileParsedData(fileId, evtxData)
					setData(evtxData)

					// Index events in background
					const isIndexed = await dbService.isFileIndexed(fileId)
					if (!isIndexed) {
						const archive = await dbService.getArchive(archiveId)
						if (evtxData.result) {
							dbService
								.indexEvtxEvents(
									fileId,
									archiveId,
									archive?.name ?? '',
									fileName,
									evtxData.result.records
								)
								.catch(() => {})
						}
					}

					break
				}

				case 'json': {
					const storedFile = await dbService.getFile(fileId)
					if (storedFile?.parsedData) {
						setCachedContent(archiveId, fileName, 'json', storedFile.parsedData)
						setData(storedFile.parsedData)
						setIsLoading(false)
						return
					}

					if (!storedFile) throw new Error('File not found in database')

					const buffer = await storedFile.blob.arrayBuffer()
					const text = new TextDecoder().decode(buffer)
					const json: unknown = JSON.parse(text)

					setCachedContent(archiveId, fileName, 'json', json)
					await dbService.updateFileParsedData(fileId, json)
					setData(json)
					break
				}

				case 'txt':
				case 'xml': {
					const storedFile = await dbService.getFile(fileId)
					if (storedFile?.parsedData) {
						setCachedContent(
							archiveId,
							fileName,
							fileType,
							storedFile.parsedData as string
						)
						setData(storedFile.parsedData as string)
						setIsLoading(false)
						return
					}

					if (!storedFile) throw new Error('File not found in database')

					const buffer = await storedFile.blob.arrayBuffer()
					const text = new TextDecoder().decode(buffer)

					setCachedContent(archiveId, fileName, fileType, text)
					await dbService.updateFileParsedData(fileId, text)
					setData(text)
					break
				}

				default:
					throw new Error(`Unsupported file type: ${fileType}`)
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load file')
		} finally {
			setIsLoading(false)
		}
	}, [archiveId, fileName, fileType, getCachedContent, setCachedContent])

	useEffect(() => {
		load()
	}, [load])

	return {data, isLoading, error, reload: load}
}
