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
			ref={ref}
			value={value}
			placeholder='Parsed XML will appear here...'
			readOnly
			autosize
			minRows={15}
			ff="monospace"
			style={{width: '100%', maxWidth: '700px'}}
		/>
	)
}
