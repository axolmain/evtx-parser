import type {TemplateStats} from '@/parser'
import {CopyButton} from './CopyButton'
import {DownloadButton} from './DownloadButton'
import {StatsDisplay} from './StatsDisplay'

interface Properties {
	disabled: boolean
	fileName: string
	fileSize: number
	numChunks: number
	parseTime: number
	totalRecords: number
	tplStats: TemplateStats
	xml: string
}

export function ControlBar({
	xml,
	fileName,
	disabled,
	totalRecords,
	numChunks,
	fileSize,
	parseTime,
	tplStats
}: Properties) {
	return (
		<div className='flex w-full max-w-[700px] flex-wrap gap-3'>
			<CopyButton disabled={disabled} text={xml} />
			<DownloadButton disabled={disabled} fileName={fileName} text={xml} />
			<StatsDisplay
				fileSize={fileSize}
				numChunks={numChunks}
				parseTime={parseTime}
				totalRecords={totalRecords}
				tplStats={tplStats}
			/>
		</div>
	)
}
