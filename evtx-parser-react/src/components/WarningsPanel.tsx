interface Properties {
	warnings: string[]
}

export function WarningsPanel({warnings}: Properties) {
	if (warnings.length === 0) return null

	return (
		<details className='w-full max-w-[700px]'>
			<summary className='cursor-pointer rounded-md border border-[#2a2a20] bg-[#161614] px-2.5 py-1.5 text-[#997] text-[0.85rem] hover:bg-[#1e1e18]'>
				{warnings.length} note{warnings.length > 1 ? 's' : ''}
			</summary>
			<ul className='mt-2 ml-5 max-h-[200px] overflow-y-auto text-[#887] text-[0.8rem] leading-relaxed'>
				{warnings.map(w => (
					<li className='mb-0.5' key={w}>
						{w}
					</li>
				))}
			</ul>
		</details>
	)
}
