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
		<button
			className='cursor-pointer rounded-md border border-[#333] bg-[#1a1a24] px-5 py-2 text-[#ccc] text-[0.85rem] transition-colors hover:bg-[#252530] disabled:cursor-default disabled:opacity-40'
			disabled={disabled}
			onClick={handleClick}
			type='button'
		>
			Download XML
		</button>
	)
}
