import {Button} from '@mantine/core'
import {useClipboard} from '@mantine/hooks'

interface Properties {
	disabled?: boolean
	getText: () => string
}

export function CopyButton({getText, disabled}: Properties) {
	const clipboard = useClipboard({timeout: 1500})

	return (
		<Button
			disabled={disabled ?? false}
			onClick={() => clipboard.copy(getText())}
			size='sm'
			variant='default'
		>
			{clipboard.copied ? 'Copied!' : 'Copy XML'}
		</Button>
	)
}
