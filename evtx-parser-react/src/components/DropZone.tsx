import {useCallback, useRef, useState} from 'react'

interface Properties {
	disabled?: boolean
	onFile: (file: File) => void
}

function useDropHandlers(onFile: (file: File) => void, disabled?: boolean) {
	const [dragOver, setDragOver] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	const handleClick = useCallback(() => {
		if (!disabled) inputRef.current?.click()
	}, [disabled])

	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			if (!disabled) setDragOver(true)
		},
		[disabled]
	)

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			setDragOver(false)
			if (disabled) return
			const file = e.dataTransfer.files[0]
			if (file) onFile(file)
		},
		[onFile, disabled]
	)

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0]
			if (file) onFile(file)
		},
		[onFile]
	)

	const handleDragLeave = useCallback(() => setDragOver(false), [])

	return {
		dragOver,
		handleChange,
		handleClick,
		handleDragLeave,
		handleDragOver,
		handleDrop,
		inputRef
	}
}

export function DropZone({onFile, disabled}: Properties) {
	const {
		dragOver,
		handleChange,
		handleClick,
		handleDragLeave,
		handleDragOver,
		handleDrop,
		inputRef
	} = useDropHandlers(onFile, disabled)

	return (
		<>
			<button
				className={`w-full max-w-[700px] cursor-pointer rounded-xl border-2 border-dashed bg-[#111118] px-8 py-12 text-center transition-colors ${
					dragOver
						? 'border-[#5a7] bg-[#13151f]'
						: 'border-[#333] hover:border-[#5a7] hover:bg-[#13151f]'
				}`}
				disabled={disabled}
				onClick={handleClick}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				type='button'
			>
				<div className='mb-2 text-[2.5rem]'>📄</div>
				<p className='text-[#888] text-[0.95rem]'>
					Drop an .evtx file here or click to browse
				</p>
			</button>
			<input
				accept='.evtx'
				className='hidden'
				onChange={handleChange}
				ref={inputRef}
				type='file'
			/>
		</>
	)
}
