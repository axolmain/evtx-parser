import {Accordion, List} from '@mantine/core'

interface Properties {
	warnings: string[]
}

export function WarningsPanel({warnings}: Properties) {
	if (warnings.length === 0) return null

	return (
		<Accordion variant="contained" style={{width: '100%', maxWidth: '700px'}}>
			<Accordion.Item value="warnings">
				<Accordion.Control>
					{warnings.length} note{warnings.length > 1 ? 's' : ''}
				</Accordion.Control>
				<Accordion.Panel>
					<List size="sm" style={{maxHeight: '200px', overflowY: 'auto'}}>
						{warnings.map(w => (
							<List.Item key={w}>{w}</List.Item>
						))}
					</List>
				</Accordion.Panel>
			</Accordion.Item>
		</Accordion>
	)
}
