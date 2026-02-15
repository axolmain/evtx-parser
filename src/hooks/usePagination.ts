import {useCallback, useMemo, useState} from 'react'

const PAGE_SIZES = [50, 100, 250, 500] as const
type PageSize = (typeof PAGE_SIZES)[number]

export function usePagination(totalItems: number) {
	const [currentPage, setCurrentPage] = useState(0)
	const [pageSize, setPageSize] = useState<PageSize>(100)

	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
	const safePage = Math.min(currentPage, totalPages - 1)

	const start = safePage * pageSize
	const end = Math.min(start + pageSize, totalItems)

	const goNext = useCallback(() => {
		setCurrentPage(p => Math.min(p + 1, totalPages - 1))
	}, [totalPages])

	const goPrev = useCallback(() => {
		setCurrentPage(p => Math.max(p - 1, 0))
	}, [])

	const changePageSize = useCallback((size: number) => {
		setPageSize(size as PageSize)
		setCurrentPage(0)
	}, [])

	const reset = useCallback(() => {
		setCurrentPage(0)
	}, [])

	return useMemo(
		() => ({
			changePageSize,
			currentPage: safePage,
			end,
			goNext,
			goPrev,
			hasNext: safePage < totalPages - 1,
			hasPrev: safePage > 0,
			pageSize,
			pageSizes: PAGE_SIZES,
			reset,
			showPagination: totalItems > pageSize,
			start,
			totalPages
		}),
		[
			changePageSize,
			end,
			goNext,
			goPrev,
			pageSize,
			reset,
			safePage,
			start,
			totalItems,
			totalPages
		]
	)
}
