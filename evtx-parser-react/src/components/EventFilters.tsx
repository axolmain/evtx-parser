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
	Tooltip,
} from '@mantine/core'
import { IconFilter, IconFilterOff, IconSearch, IconX } from '@tabler/icons-react'
import {useState} from 'react'

interface Properties {
	searchQuery: string
	onSearchChange: (value: string) => void
	selectedLevels: number[]
	onLevelsChange: (levels: number[]) => void
	levelCounts: Record<number, number>
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
	levelCounts
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
		<Group gap="sm">
			<Popover
				opened={searchHintOpened}
				onChange={setSearchHintOpened}
				width={280}
				position="bottom-start"
			>
				<Popover.Target>
					<TextInput
						placeholder="Search events..."
						leftSection={<IconSearch size={16} />}
						value={searchQuery}
						onChange={(e) => onSearchChange(e.currentTarget.value)}
						onFocus={() => setSearchHintOpened(true)}
						onBlur={() => setTimeout(() => setSearchHintOpened(false), 200)}
						rightSection={
							searchQuery && (
								<ActionIcon
									size="sm"
									variant="transparent"
									onClick={() => onSearchChange('')}
								>
									<IconX size={14} />
								</ActionIcon>
							)
						}
						style={{ minWidth: '320px' }}
					/>
				</Popover.Target>
				<Popover.Dropdown>
					<Stack gap="xs">
						<Text size="xs" fw={600} c="dimmed">
							Search Tips
						</Text>
						<Text size="xs">
							• Search across event data, provider, event ID, computer, and
							channel
						</Text>
						<Text size="xs">• Search is case-insensitive</Text>
						<Text size="xs">
							• For global search across all archives, press{' '}
							<Badge size="xs" variant="light">
								⌘K
							</Badge>
						</Text>
					</Stack>
				</Popover.Dropdown>
			</Popover>

			<Popover opened={filterOpened} onChange={setFilterOpened} width={250} position="bottom-start">
				<Popover.Target>
					<Button
						variant="default"
						leftSection={<IconFilter size={16} />}
						onClick={() => setFilterOpened(o => !o)}
						rightSection={
							activeFilterCount > 0 ? (
								<Badge size="sm" color="blue" circle>
									{activeFilterCount}
								</Badge>
							) : null
						}
					>
						Filter Levels
					</Button>
				</Popover.Target>
				<Popover.Dropdown>
					<Stack gap="xs">
						<Group justify="space-between">
							<Text size="xs" fw={600} c="dimmed">
								Event Levels
							</Text>
							{activeFilterCount > 0 && (
								<Button
									size="xs"
									variant="subtle"
									onClick={() => onLevelsChange([1, 2, 3, 4, 5])}
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
									key={level}
									label={
										<Group gap="xs" wrap="nowrap">
											<span>{info.name}</span>
											<Badge size="xs" color={info.color}>
												{count}
											</Badge>
										</Group>
									}
									checked={selectedLevels.includes(levelNum)}
									onChange={() => toggleLevel(levelNum)}
								/>
							)
						})}
					</Stack>
				</Popover.Dropdown>
			</Popover>

			{hasActiveFilters && (
				<Tooltip label="Clear all filters">
					<ActionIcon
						variant="subtle"
						color="gray"
						onClick={clearAllFilters}
					>
						<IconFilterOff size={18} />
					</ActionIcon>
				</Tooltip>
			)}
		</Group>
	)
}
