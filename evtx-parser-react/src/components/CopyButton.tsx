import {useCallback, useState} from 'react'

interface Properties {
	disabled?: boolean
	text: string
}

export function CopyButton({text, disabled}: Properties) {
	const [copied, setCopied] = useState(false)

	const handleClick = useCallback(async () => {
		await navigator.clipboard.writeText(text)
		setCopied(true)
		setTimeout(() => setCopied(false), 1500)
	}, [text])

	return (
		<button
			className='cursor-pointer rounded-md border border-[#333] bg-[#1a1a24] px-5 py-2 text-[#ccc] text-[0.85rem] transition-colors hover:bg-[#252530] disabled:cursor-default disabled:opacity-40'
			disabled={disabled}
			onClick={handleClick}
			type='button'
		>
			{copied ? 'Copied!' : 'Copy XML'}
		</button>
	)
}
