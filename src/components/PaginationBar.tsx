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
		<Group gap='sm' style={{width: '100%', maxWidth: '700px'}}>
			<Button disabled={!hasPrev} onClick={onPrev} size='sm' variant='default'>
				← Prev
			</Button>
			<Text c='dimmed' size='sm'>
				Page {currentPage + 1} of {totalPages} ({start + 1}–{end} of{' '}
				{totalItems})
			</Text>
			<Button disabled={!hasNext} onClick={onNext} size='sm' variant='default'>
				Next →
			</Button>
			<NativeSelect
				data={pageSizes.map(String)}
				label='Per page'
				onChange={e => onPageSizeChange(Number(e.currentTarget.value))}
				size='sm'
				style={{marginLeft: 'auto', width: 'auto'}}
				value={String(pageSize)}
			/>
		</Group>
	)
}
