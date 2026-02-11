import {
	ActionIcon,
	Badge,
	Button,
	Checkbox,
	Group,
	Popover,
	Stack,
	Text,
	TextInput,
	Tooltip
} from '@mantine/core'
import {IconFilter, IconFilterOff, IconSearch, IconX} from '@tabler/icons-react'
import {useState} from 'react'

interface Properties {
	searchQuery: string
	onSearchChange: (value: string) => void
	selectedLevels: number[]
	onLevelsChange: (levels: number[]) => void
	levelCounts: Record<number, number>
	disabled?: boolean
}

const LEVEL_INFO = {
	1: {name: 'Critical', color: 'red'},
	2: {name: 'Error', color: 'orange'},
	3: {name: 'Warning', color: 'yellow'},
	4: {name: 'Information', color: 'blue'},
	5: {name: 'Verbose', color: 'gray'}
}

export function EventFilters({
	searchQuery,
	onSearchChange,
	selectedLevels,
	onLevelsChange,
	levelCounts,
	disabled = false
}: Properties) {
	const [filterOpened, setFilterOpened] = useState(false)
	const [searchHintOpened, setSearchHintOpened] = useState(false)

	const toggleLevel = (level: number) => {
		if (selectedLevels.includes(level)) {
			onLevelsChange(selectedLevels.filter(l => l !== level))
		} else {
			onLevelsChange([...selectedLevels, level])
		}
	}

	const activeFilterCount = 5 - selectedLevels.length
	const hasActiveFilters = searchQuery.trim() !== '' || activeFilterCount > 0

	const clearAllFilters = () => {
		onSearchChange('')
		onLevelsChange([1, 2, 3, 4, 5])
	}

	return (
		<Group gap='sm'>
			<Popover
				onChange={setSearchHintOpened}
				opened={searchHintOpened && !disabled}
				position='bottom-start'
				width={280}
			>
				<Popover.Target>
					<TextInput
						disabled={disabled}
						leftSection={<IconSearch size={16} />}
						onBlur={() => setTimeout(() => setSearchHintOpened(false), 200)}
						onChange={e => onSearchChange(e.currentTarget.value)}
						onFocus={() => setSearchHintOpened(true)}
						placeholder='Search events...'
						rightSection={
							searchQuery && (
								<ActionIcon
									disabled={disabled}
									onClick={() => onSearchChange('')}
									size='sm'
									variant='transparent'
								>
									<IconX size={14} />
								</ActionIcon>
							)
						}
						style={{minWidth: '320px'}}
						value={searchQuery}
					/>
				</Popover.Target>
				<Popover.Dropdown>
					<Stack gap='xs'>
						<Text c='dimmed' fw={600} size='xs'>
							Search Tips
						</Text>
						<Text size='xs'>
							• Search across event data, provider, event ID, computer, and
							channel
						</Text>
						<Text size='xs'>• Search is case-insensitive</Text>
						<Text size='xs'>
							• For global search across all archives, press{' '}
							<Badge size='xs' variant='light'>
								⌘K
							</Badge>
						</Text>
					</Stack>
				</Popover.Dropdown>
			</Popover>

			<Popover
				onChange={setFilterOpened}
				opened={filterOpened && !disabled}
				position='bottom-start'
				width={250}
			>
				<Popover.Target>
					<Button
						disabled={disabled}
						leftSection={<IconFilter size={16} />}
						onClick={() => setFilterOpened(o => !o)}
						rightSection={
							activeFilterCount > 0 ? (
								<Badge circle={true} color='blue' size='sm'>
									{activeFilterCount}
								</Badge>
							) : null
						}
						variant='default'
					>
						Filter Levels
					</Button>
				</Popover.Target>
				<Popover.Dropdown>
					<Stack gap='xs'>
						<Group justify='space-between'>
							<Text c='dimmed' fw={600} size='xs'>
								Event Levels
							</Text>
							{activeFilterCount > 0 && (
								<Button
									onClick={() => onLevelsChange([1, 2, 3, 4, 5])}
									size='xs'
									variant='subtle'
								>
									Select All
								</Button>
							)}
						</Group>
						{Object.entries(LEVEL_INFO).map(([level, info]) => {
							const levelNum = Number(level)
							const count = levelCounts[levelNum] || 0
							return (
								<Checkbox
									checked={selectedLevels.includes(levelNum)}
									key={level}
									label={
										<Group gap='xs' wrap='nowrap'>
											<span>{info.name}</span>
											<Badge color={info.color} size='xs'>
												{count}
											</Badge>
										</Group>
									}
									onChange={() => toggleLevel(levelNum)}
								/>
							)
						})}
					</Stack>
				</Popover.Dropdown>
			</Popover>

			{hasActiveFilters && (
				<Tooltip label='Clear all filters'>
					<ActionIcon color='gray' onClick={clearAllFilters} variant='subtle'>
						<IconFilterOff size={18} />
					</ActionIcon>
				</Tooltip>
			)}
		</Group>
	)
}
