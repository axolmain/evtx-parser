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
		<div className='flex w-full max-w-[700px] flex-wrap items-center gap-3'>
			<button
				className='cursor-pointer rounded-md border border-[#333] bg-[#1a1a24] px-5 py-2 text-[#ccc] text-[0.85rem] transition-colors hover:bg-[#252530] disabled:cursor-default disabled:opacity-40'
				disabled={!hasPrev}
				onClick={onPrev}
				type='button'
			>
				← Prev
			</button>
			<span className='flex items-center text-[#888] text-[0.85rem]'>
				Page {currentPage + 1} of {totalPages} ({start + 1}–{end} of{' '}
				{totalItems})
			</span>
			<button
				className='cursor-pointer rounded-md border border-[#333] bg-[#1a1a24] px-5 py-2 text-[#ccc] text-[0.85rem] transition-colors hover:bg-[#252530] disabled:cursor-default disabled:opacity-40'
				disabled={!hasNext}
				onClick={onNext}
				type='button'
			>
				Next →
			</button>
			<label className='ml-auto text-[#666] text-[0.85rem]'>
				Per page:{' '}
				<select
					className='rounded border border-[#333] bg-[#1a1a24] px-1.5 py-0.5 text-[#ccc] text-[0.85rem]'
					onChange={e => onPageSizeChange(Number(e.target.value))}
					value={pageSize}
				>
					{pageSizes.map(s => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</label>
		</div>
	)
}
