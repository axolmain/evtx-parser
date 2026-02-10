import { XMLParser } from 'fast-xml-parser'

/**
 * Worker-safe XML parser helper that provides a simple interface
 * for extracting event fields from Windows Event XML.
 *
 * Uses fast-xml-parser which works in both main thread and Web Workers,
 * unlike DOMParser which is only available in the main thread.
 */

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	textNodeName: '#text',
	parseAttributeValue: true,
	trimValues: true
})

interface ParsedXML {
	Event?: {
		System?: {
			Provider?: { '@_Name'?: string }
			EventID?: string | { '#text': string }
			Level?: string | number
			Computer?: string
			Channel?: string
			Task?: string
			Opcode?: string
			Keywords?: string
			Version?: string
			Execution?: { '@_ProcessID'?: string; '@_ThreadID'?: string }
			Security?: { '@_UserID'?: string }
			Correlation?: { '@_ActivityID'?: string; '@_RelatedActivityID'?: string }
		}
		EventData?: {
			Data?: Array<{ '@_Name'?: string; '#text'?: string }> | { '@_Name'?: string; '#text'?: string }
		}
	}
}

function getTextValue(value: string | number | { '#text': string } | undefined): string {
	if (value === undefined || value === null) return ''
	if (typeof value === 'string') return value
	if (typeof value === 'number') return String(value)
	if (typeof value === 'object' && '#text' in value) return String(value['#text'])
	return ''
}

export function parseEventXml(xmlString: string): {
	eventId: string
	level: number
	provider: string
	computer: string
	channel: string
	task: string
	opcode: string
	keywords: string
	version: string
	processId: string
	threadId: string
	securityUserId: string
	activityId: string
	relatedActivityId: string
	eventData: string
} {
	try {
		const parsed = parser.parse(xmlString) as ParsedXML
		const system = parsed.Event?.System

		const eventId = getTextValue(system?.EventID)
		const level = Number.parseInt(getTextValue(system?.Level), 10) || 0
		const provider = system?.Provider?.['@_Name'] || ''
		const computer = getTextValue(system?.Computer)
		const channel = getTextValue(system?.Channel)
		const task = getTextValue(system?.Task)
		const opcode = getTextValue(system?.Opcode)
		const keywords = getTextValue(system?.Keywords)
		const version = getTextValue(system?.Version)
		const processId = system?.Execution?.['@_ProcessID'] || ''
		const threadId = system?.Execution?.['@_ThreadID'] || ''
		const securityUserId = system?.Security?.['@_UserID'] || ''
		const activityId = system?.Correlation?.['@_ActivityID'] || ''
		const relatedActivityId = system?.Correlation?.['@_RelatedActivityID'] || ''

		// Extract EventData as formatted key-value pairs
		const eventDataPairs: string[] = []
		const eventDataObj = parsed.Event?.EventData?.Data

		if (eventDataObj) {
			const dataArray = Array.isArray(eventDataObj) ? eventDataObj : [eventDataObj]

			for (const dataItem of dataArray) {
				const name = dataItem['@_Name']
				const value = getTextValue(dataItem['#text'])

				if (value) {
					// If has Name attribute, format as "Name: Value", otherwise just the value
					eventDataPairs.push(name ? `${name}: ${value}` : value)
				}
			}
		}

		const eventData = eventDataPairs.join('\n')

		return {
			eventId,
			level,
			provider,
			computer,
			channel,
			task,
			opcode,
			keywords,
			version,
			processId,
			threadId,
			securityUserId,
			activityId,
			relatedActivityId,
			eventData
		}
	} catch (error) {
		// If parsing fails, return empty values
		console.warn('Failed to parse event XML:', error)
		return {
			eventId: '',
			level: 0,
			provider: '',
			computer: '',
			channel: '',
			task: '',
			opcode: '',
			keywords: '',
			version: '',
			processId: '',
			threadId: '',
			securityUserId: '',
			activityId: '',
			relatedActivityId: '',
			eventData: ''
		}
	}
}
