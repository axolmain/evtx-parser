import {Button} from '@mantine/core'
import {useClipboard} from '@mantine/hooks'

interface Properties {
	disabled?: boolean
	text: string
}

export function CopyButton({text, disabled}: Properties) {
	const clipboard = useClipboard({timeout: 1500})

	return (
		<Button
			variant="default"
			size="sm"
			disabled={disabled ?? false}
			onClick={() => clipboard.copy(text)}
		>
			{clipboard.copied ? 'Copied!' : 'Copy XML'}
		</Button>
	)
}
