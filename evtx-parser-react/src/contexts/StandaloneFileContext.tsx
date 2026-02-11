import {createContext, useCallback, useContext, useState} from 'react'

interface StandaloneFileContextValue {
	file: File | null
	setFile: (file: File | null) => void
	clear: () => void
}

const StandaloneFileContext = createContext<StandaloneFileContextValue | null>(
	null
)

export function StandaloneFileProvider({
	children
}: {
	children: React.ReactNode
}) {
	const [file, setFileState] = useState<File | null>(null)

	const setFile = useCallback((f: File | null) => {
		setFileState(f)
	}, [])

	const clear = useCallback(() => {
		setFileState(null)
	}, [])

	return (
		<StandaloneFileContext.Provider value={{file, setFile, clear}}>
			{children}
		</StandaloneFileContext.Provider>
	)
}

export function useStandaloneFile() {
	const ctx = useContext(StandaloneFileContext)
	if (!ctx)
		throw new Error(
			'useStandaloneFile must be used within StandaloneFileProvider'
		)
	return ctx
}
