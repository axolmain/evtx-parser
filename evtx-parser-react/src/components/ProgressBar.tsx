import {Progress} from '@mantine/core'

interface Properties {
	progress: number
}

export function ProgressBar({progress}: Properties) {
	return (
		<Progress
			color='teal'
			size='xs'
			style={{width: '100%', maxWidth: '700px'}}
			value={progress}
		/>
	)
}
