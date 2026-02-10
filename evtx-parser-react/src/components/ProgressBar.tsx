interface Properties {
	progress: number
}

export function ProgressBar({progress}: Properties) {
	return (
		<div className='h-[3px] w-full max-w-[700px] overflow-hidden rounded-sm bg-[#222]'>
			<div
				className='h-full bg-[#5a7] transition-[width] duration-50'
				style={{width: `${progress}%`}}
			/>
		</div>
	)
}
