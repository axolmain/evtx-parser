import {Progress} from '@mantine/core'

interface Properties {
	progress: number
}

export function ProgressBar({progress}: Properties) {
	return (
		<Progress
			value={progress}
			size="xs"
			color="teal"
			style={{width: '100%', maxWidth: '700px'}}
		/>
	)
}
