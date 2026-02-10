import {Badge, Button, Checkbox, Group, Popover, Stack, TextInput} from '@mantine/core'
import {IconFilter, IconSearch} from '@tabler/icons-react'
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

	const toggleLevel = (level: number) => {
		if (selectedLevels.includes(level)) {
			onLevelsChange(selectedLevels.filter(l => l !== level))
		} else {
			onLevelsChange([...selectedLevels, level])
		}
	}

	const activeFilterCount = 5 - selectedLevels.length

	return (
		<Group gap="sm">
			<TextInput
				placeholder="Search events..."
				leftSection={<IconSearch size={16} />}
				value={searchQuery}
				onChange={(e) => onSearchChange(e.currentTarget.value)}
				style={{minWidth: '300px'}}
			/>

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
		</Group>
	)
}
