import {Button, Group, NativeSelect, Text} from '@mantine/core'

interface Properties {
	currentPage: number
	end: number
	hasNext: boolean
	hasPrev: boolean
	onNext: () => void
	onPageSizeChange: (size: number) => void
	onPrev: () => void
	pageSize: number
	pageSizes: readonly number[]
	start: number
	totalItems: number
	totalPages: number
}

export function PaginationBar({
	currentPage,
	totalPages,
	start,
	end,
	totalItems,
	hasPrev,
	hasNext,
	onPrev,
	onNext,
	pageSize,
	pageSizes,
	onPageSizeChange
}: Properties) {
	return (
		<Group gap="sm" style={{width: '100%', maxWidth: '700px'}}>
			<Button
				variant="default"
				size="sm"
				disabled={!hasPrev}
				onClick={onPrev}
			>
				← Prev
			</Button>
			<Text size="sm" c="dimmed">
				Page {currentPage + 1} of {totalPages} ({start + 1}–{end} of{' '}
				{totalItems})
			</Text>
			<Button
				variant="default"
				size="sm"
				disabled={!hasNext}
				onClick={onNext}
			>
				Next →
			</Button>
			<NativeSelect
				label="Per page"
				data={pageSizes.map(String)}
				value={String(pageSize)}
				onChange={e => onPageSizeChange(Number(e.currentTarget.value))}
				size="sm"
				style={{marginLeft: 'auto', width: 'auto'}}
			/>
		</Group>
	)
}
