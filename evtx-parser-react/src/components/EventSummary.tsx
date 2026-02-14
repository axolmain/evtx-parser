import {Badge, Group, Text} from '@mantine/core'
import type {ParsedEventRecord} from '@/parser'

interface Properties {
	records: ParsedEventRecord[]
}

const LEVEL_NAMES: Record<number, string> = {
	0: 'LogAlways',
	1: 'Critical',
	2: 'Error',
	3: 'Warning',
	4: 'Information',
	5: 'Verbose'
}

const LEVEL_COLORS: Record<number, string> = {
	0: 'violet',
	1: 'red',
	2: 'orange',
	3: 'yellow',
	4: 'blue',
	5: 'gray'
}

export function EventSummary({records}: Properties) {
	const _t0 = performance.now()
	const levelCounts: Record<number, number> = {}
	let minDate = ''
	let maxDate = ''

	for (const record of records) {
		levelCounts[record.level] = (levelCounts[record.level] || 0) + 1
		if (!minDate || record.timestamp < minDate) minDate = record.timestamp
		if (!maxDate || record.timestamp > maxDate) maxDate = record.timestamp
	}

	const formatDate = (iso: string) => {
		const date = new Date(iso)
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})
	}

	return (
		<Group gap='lg'>
			<Group gap='xs'>
				{[0, 1, 2, 3, 4, 5].map(level => {
					const count = levelCounts[level] || 0
					if (count === 0) return null
					const color = LEVEL_COLORS[level]
					return (
						<Badge
							key={level}
							{...(color && {color})}
							size='lg'
							variant='light'
						>
							{count} {LEVEL_NAMES[level]}
						</Badge>
					)
				})}
			</Group>
			{minDate && maxDate && (
				<Text c='dimmed' size='sm'>
					{formatDate(minDate)} → {formatDate(maxDate)}
				</Text>
			)}
		</Group>
	)
}
