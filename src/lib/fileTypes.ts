export type FileType = 'evtx' | 'json' | 'txt' | 'xml' | 'unknown'

export function detectFileType(fileName: string): FileType {
	const lower = fileName.toLowerCase()
	if (lower.endsWith('.evtx')) return 'evtx'
	if (lower.endsWith('.json')) return 'json'
	if (lower.endsWith('.txt') || lower.endsWith('.log')) return 'txt'
	if (lower.endsWith('.xml')) return 'xml'
	return 'unknown'
}
