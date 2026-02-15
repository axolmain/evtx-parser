import {Badge, Group, Stack, Tabs, Text, Tooltip} from '@mantine/core'
import {
	IconFileText,
	IconFileTypography,
	IconJson,
	IconQuestionMark
} from '@tabler/icons-react'
import {formatBytes} from '@/db/schema'

const FILE_META: Record<
	string,
	{icon: typeof IconFileText; color: string; label: string}
> = {
	evtx: {
		icon: IconFileText,
		color: 'var(--mantine-color-blue-6)',
		label: 'EVTX'
	},
	json: {icon: IconJson, color: 'var(--mantine-color-green-6)', label: 'JSON'},
	xml: {
		icon: IconFileText,
		color: 'var(--mantine-color-orange-6)',
		label: 'XML'
	},
	txt: {
		icon: IconFileTypography,
		color: 'var(--mantine-color-gray-6)',
		label: 'Text'
	}
}

interface FileGroupProps {
	files: {name: string; size: number; type: string}[]
	type: string
}

export function FileGroup({files, type}: FileGroupProps) {
	if (files.length === 0) return null
	const meta = FILE_META[type]
	const Icon = meta?.icon ?? IconQuestionMark
	const color = meta?.color ?? 'var(--mantine-color-gray-6)'
	const label = meta?.label ?? 'Other'

	return (
		<>
			<Group gap='xs' px='sm' py={4}>
				<Text c='dimmed' fw={600} size='xs' tt='uppercase'>
					{label}
				</Text>
				<Badge size='xs' variant='light'>
					{files.length}
				</Badge>
			</Group>
			{files.map(entry => (
				<Tabs.Tab
					key={entry.name}
					leftSection={<Icon color={color} size={16} />}
					value={entry.name}
				>
					<Stack gap={0}>
						<Tooltip disabled={entry.name.length < 25} label={entry.name}>
							<Text size='sm' style={{maxWidth: 180}} truncate={true}>
								{entry.name}
							</Text>
						</Tooltip>
						<Text c='dimmed' size='xs'>
							{formatBytes(entry.size)}
						</Text>
					</Stack>
				</Tabs.Tab>
			))}
		</>
	)
}
