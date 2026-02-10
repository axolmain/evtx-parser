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
		<div className='flex min-h-[300px] w-full max-w-[700px] flex-1 flex-col'>
			<textarea
				className='min-h-[400px] w-full flex-1 resize-y rounded-lg border border-[#222] bg-[#111118] p-4 font-mono text-[#c8d0c8] text-[0.8rem] leading-6 focus:border-[#444] focus:outline-none'
				placeholder='Parsed XML will appear here...'
				readOnly={true}
				ref={ref}
				value={value}
			/>
		</div>
	)
}
