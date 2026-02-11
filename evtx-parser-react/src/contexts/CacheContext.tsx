import {createContext, useCallback, useContext, useEffect, useRef} from 'react'
import {createPool} from '@/hooks/useEvtxParserHelpers'
import type {FileType} from '@/lib/fileTypes'
import type {EvtxParseResult} from '@/parser'
import type {ChunkWorkerPool} from '@/worker/worker-pool'

export interface EvtxCacheData {
	result: EvtxParseResult
	fileSize: number
	parseTime: number
	fileName: string
}

interface CacheEntry<T> {
	data: T
	accessTime: number
}

const MAX_EVTX_CACHE = 3

interface CacheContextValue {
	getCachedContent: (
		archiveId: string,
		entryName: string,
		type: FileType
	) => EvtxCacheData | unknown | string | null
	setCachedContent: (
		archiveId: string,
		entryName: string,
		type: FileType,
		data: EvtxCacheData | unknown | string
	) => void
	clearCaches: () => void
	getPool: () => ChunkWorkerPool | null
	cacheStats: () => {evtx: number; json: number; txt: number}
}

const CacheContext = createContext<CacheContextValue | null>(null)

function getCacheKey(archiveId: string, entryName: string) {
	return `${archiveId}::${entryName}`
}

export function CacheProvider({children}: {children: React.ReactNode}) {
	const poolRef = useRef<ChunkWorkerPool | null | undefined>(undefined)
	const evtxCacheRef = useRef<Map<string, CacheEntry<EvtxCacheData>>>(new Map())
	const jsonCacheRef = useRef<Map<string, CacheEntry<unknown>>>(new Map())
	const textCacheRef = useRef<Map<string, CacheEntry<string>>>(new Map())

	useEffect(
		() => () => {
			poolRef.current?.dispose()
			poolRef.current = null
		},
		[]
	)

	const getPool = useCallback((): ChunkWorkerPool | null => {
		if (poolRef.current === undefined) {
			poolRef.current = createPool()
		}
		return poolRef.current
	}, [])

	const evictOldestEvtxCache = useCallback(() => {
		const cache = evtxCacheRef.current
		if (cache.size <= MAX_EVTX_CACHE) return

		let oldestKey: string | null = null
		let oldestTime = Number.POSITIVE_INFINITY

		for (const [key, entry] of cache.entries()) {
			if (entry.accessTime < oldestTime) {
				oldestTime = entry.accessTime
				oldestKey = key
			}
		}

		if (oldestKey) {
			cache.delete(oldestKey)
		}
	}, [])

	const getCachedContent = useCallback(
		(
			archiveId: string,
			entryName: string,
			type: FileType
		): EvtxCacheData | unknown | string | null => {
			const key = getCacheKey(archiveId, entryName)
			switch (type) {
				case 'evtx': {
					const entry = evtxCacheRef.current.get(key)
					if (entry) entry.accessTime = Date.now()
					return entry?.data ?? null
				}
				case 'json': {
					const entry = jsonCacheRef.current.get(key)
					if (entry) entry.accessTime = Date.now()
					return entry?.data ?? null
				}
				case 'txt':
				case 'xml': {
					const entry = textCacheRef.current.get(key)
					if (entry) entry.accessTime = Date.now()
					return entry?.data ?? null
				}
				default:
					return null
			}
		},
		[]
	)

	const setCachedContent = useCallback(
		(
			archiveId: string,
			entryName: string,
			type: FileType,
			data: EvtxCacheData | unknown | string
		) => {
			const key = getCacheKey(archiveId, entryName)
			const now = Date.now()

			switch (type) {
				case 'evtx':
					evtxCacheRef.current.set(key, {
						data: data as EvtxCacheData,
						accessTime: now
					})
					evictOldestEvtxCache()
					break
				case 'json':
					jsonCacheRef.current.set(key, {data, accessTime: now})
					break
				case 'txt':
				case 'xml':
					textCacheRef.current.set(key, {
						data: data as string,
						accessTime: now
					})
					break
			}
		},
		[evictOldestEvtxCache]
	)

	const clearCaches = useCallback(() => {
		evtxCacheRef.current.clear()
		jsonCacheRef.current.clear()
		textCacheRef.current.clear()
	}, [])

	const cacheStats = useCallback(
		() => ({
			evtx: evtxCacheRef.current.size,
			json: jsonCacheRef.current.size,
			txt: textCacheRef.current.size
		}),
		[]
	)

	return (
		<CacheContext.Provider
			value={{
				getCachedContent,
				setCachedContent,
				clearCaches,
				getPool,
				cacheStats
			}}
		>
			{children}
		</CacheContext.Provider>
	)
}

export function useCache() {
	const ctx = useContext(CacheContext)
	if (!ctx) throw new Error('useCache must be used within CacheProvider')
	return ctx
}
