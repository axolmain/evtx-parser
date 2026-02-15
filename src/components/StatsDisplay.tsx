import {Text} from '@mantine/core'
import type {TemplateStatsSummary} from '@/parser'

interface Properties {
	fileSize: number
	numChunks: number
	parseTime: number
	totalRecords: number
	tplStats: TemplateStatsSummary
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
	if (tplStats.parseErrorCount > 0) {
		text += ` · ${tplStats.parseErrorCount} errors`
	}

	return (
		<Text c='dimmed' size='xs' style={{marginLeft: 'auto'}}>
			{text}
		</Text>
	)
}
