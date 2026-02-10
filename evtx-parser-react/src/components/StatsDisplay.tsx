import type {TemplateStats} from '@/parser'

interface Properties {
	fileSize: number
	numChunks: number
	parseTime: number
	totalRecords: number
	tplStats: TemplateStats
}

export function StatsDisplay({
	totalRecords,
	numChunks,
	fileSize,
	parseTime,
	tplStats
}: Properties) {
	let text = `${totalRecords} records · ${numChunks} chunks · ${(fileSize / 1024).toFixed(1)} KB · ${parseTime.toFixed(0)}ms · ${tplStats.definitionCount} templates · ${tplStats.referenceCount} refs`

	if (tplStats.missingCount > 0) {
		text += ` · ${tplStats.missingCount} missing!`
	}
	if (tplStats.parseErrors.length > 0) {
		text += ` · ${tplStats.parseErrors.length} errors`
	}

	return (
		<div className='ml-auto flex items-center gap-4 text-[#666] text-[0.8rem]'>
			{text}
		</div>
	)
}
