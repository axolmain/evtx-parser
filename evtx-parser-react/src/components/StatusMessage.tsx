import {Text} from '@mantine/core'

interface Properties {
	message: string
	type?: 'error' | 'info' | 'success'
}

const colorMap = {
	error: 'red',
	info: 'dimmed',
	success: 'green'
} as const

export function StatusMessage({message, type = 'info'}: Properties) {
	if (!message) return null
	return (
		<Text
			c={colorMap[type]}
			size="sm"
			style={{width: '100%', maxWidth: '700px', minHeight: '1.2em'}}
		>
			{message}
		</Text>
	)
}
