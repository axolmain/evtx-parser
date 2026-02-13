import {Button} from '@mantine/core'
import {useCallback} from 'react'

interface Properties {
	disabled?: boolean
	fileName: string
	getText: () => string
}

export function DownloadButton({getText, fileName, disabled}: Properties) {
	const handleClick = useCallback(() => {
		const blob = new Blob([getText()], {type: 'application/xml'})
		const a = document.createElement('a')
		a.href = URL.createObjectURL(blob)
		a.download = `${fileName}-rawdump.xml`
		a.click()
		URL.revokeObjectURL(a.href)
	}, [getText, fileName])

	return (
		<Button
			disabled={disabled ?? false}
			onClick={handleClick}
			size='sm'
			variant='default'
		>
			Download XML
		</Button>
	)
}
