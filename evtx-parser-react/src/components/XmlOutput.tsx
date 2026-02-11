import {Textarea} from '@mantine/core'
import {useEffect, useRef} from 'react'

interface Properties {
	value: string
}

export function XmlOutput({value}: Properties) {
	const ref = useRef<HTMLTextAreaElement>(null)

	useEffect(() => {
		if (ref.current) ref.current.scrollTop = 0
	}, [])

	return (
		<Textarea
			autosize={true}
			ff='monospace'
			minRows={15}
			placeholder='Parsed XML will appear here...'
			readOnly={true}
			ref={ref}
			style={{width: '100%', maxWidth: '700px'}}
			value={value}
		/>
	)
}
