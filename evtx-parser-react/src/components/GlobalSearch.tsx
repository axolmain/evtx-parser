import { Badge, Group, Highlight, Stack, Text } from '@mantine/core'
import { Spotlight, spotlight } from '@mantine/spotlight'
import {
	IconAlertCircle,
	IconAlertTriangle,
	IconInfoCircle,
	IconSearch,
	IconX,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import type { StoredEvent } from '@/db/schema'
import * as dbService from '@/db/service'

interface GlobalSearchProps {
	onEventSelect?: (event: StoredEvent) => void
}

const LEVEL_COLORS: Record<number, string> = {
	1: 'red',
	2: 'orange',
	3: 'yellow',
	4: 'blue',
	5: 'gray',
}

const LEVEL_ICONS: Record<number, React.ReactNode> = {
	1: <IconX size={16} />,
	2: <IconAlertCircle size={16} />,
	3: <IconAlertTriangle size={16} />,
	4: <IconInfoCircle size={16} />,
	5: <IconInfoCircle size={16} />,
}

export function GlobalSearch({ onEventSelect }: GlobalSearchProps) {
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<StoredEvent[]>([])
	const [isSearching, setIsSearching] = useState(false)

	// Debounced search
	useEffect(() => {
		const timer = setTimeout(() => {
			if (query.trim()) {
				performSearch(query)
			} else {
				setResults([])
			}
		}, 300)

		return () => clearTimeout(timer)
	}, [query])

	const performSearch = async (searchQuery: string) => {
		setIsSearching(true)
		try {
			const events = await dbService.searchEvents(
				{
					query: searchQuery,
				},
				100 // Limit to 100 results for performance
			)
			setResults(events)
		} catch (error) {
			console.error('Search failed:', error)
			setResults([])
		} finally {
			setIsSearching(false)
		}
	}

	const handleEventSelect = (event: StoredEvent) => {
		spotlight.close()
		onEventSelect?.(event)
	}

	const formatTimestamp = (timestamp: string) => {
		try {
			return new Intl.DateTimeFormat('en-US', {
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				second: '2-digit',
			}).format(new Date(timestamp))
		} catch {
			return timestamp
		}
	}

	const actions = results.map((event) => {
		// Create a simple text description for Spotlight
		const descriptionText = [
			`${event.provider} • ${event.computer}`,
			formatTimestamp(event.timestamp),
			event.eventData ? event.eventData.substring(0, 100) + (event.eventData.length > 100 ? '...' : '') : '',
			`${event.archiveName} / ${event.fileName}`
		].filter(Boolean).join(' • ')

		return {
			id: event.id,
			label: `Event ${event.eventId} - ${event.levelText}`,
			description: descriptionText,
			onClick: () => handleEventSelect(event),
			leftSection: LEVEL_ICONS[event.level],
		}
	})

	return (
		<Spotlight
			actions={actions}
			nothingFound={
				isSearching ? 'Searching...' : query ? 'No events found' : 'Type to search'
			}
			highlightQuery
			searchProps={{
				leftSection: <IconSearch size={20} />,
				placeholder: 'Search all EVTX events...',
				value: query,
				onChange: (e) => setQuery(e.currentTarget.value),
			}}
			limit={100}
			shortcut={['mod + K']}
		/>
	)
}

// Hook to open spotlight programmatically
export function useGlobalSearch() {
	const open = () => spotlight.open()
	const close = () => spotlight.close()
	const toggle = () => spotlight.toggle()

	return { open, close, toggle }
}
