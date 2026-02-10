interface Properties {
	message: string
	type?: 'error' | 'info' | 'success'
}

const colorMap = {
	error: 'text-[#e66]',
	info: 'text-[#aaa]',
	success: 'text-[#5a7]'
} as const

export function StatusMessage({message, type = 'info'}: Properties) {
	if (!message) return null
	return (
		<div
			className={`min-h-[1.2em] w-full max-w-[700px] text-[0.85rem] ${colorMap[type]}`}
		>
			{message}
		</div>
	)
}
