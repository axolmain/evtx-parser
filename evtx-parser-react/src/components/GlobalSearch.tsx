import {Spotlight, spotlight} from '@mantine/spotlight'
import {
	IconAlertCircle,
	IconAlertTriangle,
	IconInfoCircle,
	IconSearch,
	IconX
} from '@tabler/icons-react'
import {useRouter} from '@tanstack/react-router'
import {useEffect, useState} from 'react'
import type {StoredEvent} from '@/db/schema'
import * as dbService from '@/db/service'

const LEVEL_ICONS: Record<number, React.ReactNode> = {
	1: <IconX size={16} />,
	2: <IconAlertCircle size={16} />,
	3: <IconAlertTriangle size={16} />,
	4: <IconInfoCircle size={16} />,
	5: <IconInfoCircle size={16} />
}

export function GlobalSearch() {
	const router = useRouter()
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<StoredEvent[]>([])
	const [isSearching, setIsSearching] = useState(false)

	// Debounced search
	useEffect(() => {
		const timer = setTimeout(async () => {
			if (query.trim()) {
				setIsSearching(true)
				try {
					const events = await dbService.searchEvents({query}, 100)
					setResults(events)
				} catch {
					setResults([])
				} finally {
					setIsSearching(false)
				}
			} else {
				setResults([])
			}
		}, 300)

		return () => clearTimeout(timer)
	}, [query])

	const handleEventSelect = (event: StoredEvent) => {
		spotlight.close()
		router.navigate({
			to: '/archive/$archiveId',
			params: {archiveId: event.archiveId},
			search: {file: event.fileName, event: event.recordId}
		})
	}

	const formatTimestamp = (timestamp: string) => {
		try {
			return new Intl.DateTimeFormat('en-US', {
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				second: '2-digit'
			}).format(new Date(timestamp))
		} catch {
			return timestamp
		}
	}

	const actions = results.map(event => {
		const descriptionText = [
			`${event.provider} • ${event.computer}`,
			formatTimestamp(event.timestamp),
			event.eventData
				? event.eventData.substring(0, 100) +
					(event.eventData.length > 100 ? '...' : '')
				: '',
			`${event.archiveName} / ${event.fileName}`
		]
			.filter(Boolean)
			.join(' • ')

		return {
			id: event.id,
			label: `Event ${event.eventId} - ${event.levelText}`,
			description: descriptionText,
			onClick: () => handleEventSelect(event),
			leftSection: LEVEL_ICONS[event.level]
		}
	})

	return (
		<Spotlight
			actions={actions}
			highlightQuery={true}
			limit={100}
			nothingFound={
				isSearching
					? 'Searching...'
					: query
						? 'No events found'
						: 'Type to search'
			}
			searchProps={{
				leftSection: <IconSearch size={20} />,
				placeholder: 'Search all EVTX events...',
				value: query,
				onChange: e => setQuery(e.currentTarget.value)
			}}
			shortcut={['mod + K']}
		/>
	)
}

export function useGlobalSearch() {
	const open = () => spotlight.open()
	const close = () => spotlight.close()
	const toggle = () => spotlight.toggle()

	return {open, close, toggle}
}
