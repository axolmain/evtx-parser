import {Button} from '@mantine/core'
import {useCallback} from 'react'

interface Properties {
	disabled?: boolean
	fileName: string
	text: string
}

export function DownloadButton({text, fileName, disabled}: Properties) {
	const handleClick = useCallback(() => {
		const blob = new Blob([text], {type: 'application/xml'})
		const a = document.createElement('a')
		a.href = URL.createObjectURL(blob)
		a.download = `${fileName}-rawdump.xml`
		a.click()
		URL.revokeObjectURL(a.href)
	}, [text, fileName])

	return (
		<Button
			variant="default"
			size="sm"
			disabled={disabled ?? false}
			onClick={handleClick}
		>
			Download XML
		</Button>
	)
}
