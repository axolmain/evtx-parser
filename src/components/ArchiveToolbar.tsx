import {ActionIcon, Button, Group, Text, Tooltip} from '@mantine/core'
import {IconArrowLeft, IconX} from '@tabler/icons-react'

interface ArchiveToolbarProps {
	archiveName: string
	fileCounts: {total: number; evtx: number; json: number; txt: number}
	cachedEvtxCount: number
	onClearCache: () => void
	onGoHome: () => void
}

export function ArchiveToolbar({
	archiveName,
	fileCounts,
	cachedEvtxCount,
	onClearCache,
	onGoHome
}: ArchiveToolbarProps) {
	const countsText = [
		`${fileCounts.total} files`,
		fileCounts.evtx > 0 ? `${fileCounts.evtx} EVTX` : null,
		fileCounts.json > 0 ? `${fileCounts.json} JSON` : null,
		fileCounts.txt > 0 ? `${fileCounts.txt} TXT` : null
	]
		.filter(Boolean)
		.join(' \u00b7 ')

	return (
		<Group h={40} justify='space-between' px='xs' wrap='nowrap'>
			<Group gap='sm' wrap='nowrap'>
				<Tooltip label='Back to Home'>
					<ActionIcon color='gray' onClick={onGoHome} variant='subtle'>
						<IconArrowLeft size={18} />
					</ActionIcon>
				</Tooltip>
				<Text fw={600} size='sm' style={{maxWidth: 300}} truncate={true}>
					{archiveName}
				</Text>
				<Text c='dimmed' size='xs'>
					{countsText}
				</Text>
			</Group>

			{cachedEvtxCount > 0 && (
				<Tooltip label='Clear parsed file cache'>
					<Button
						color='red'
						leftSection={<IconX size={14} />}
						onClick={onClearCache}
						size='xs'
						variant='subtle'
					>
						Clear Cache
					</Button>
				</Tooltip>
			)}
		</Group>
	)
}
