import {
	createContext,
	useContext,
	useRef,
	useState,
	type ReactNode,
} from 'react'

interface NavbarContextType {
	navbarContent: ReactNode | null
	setNavbarContent: (content: ReactNode | null) => void
	progressiveMode: boolean
	setProgressiveMode: (enabled: boolean) => void
	closeNavbarRef: React.MutableRefObject<() => void>
}

const NavbarContext = createContext<NavbarContextType | null>(null)

export function NavbarProvider({children}: {children: ReactNode}) {
	const [navbarContent, setNavbarContent] = useState<ReactNode | null>(null)
	const [progressiveMode, setProgressiveMode] = useState(false)
	const closeNavbarRef = useRef<() => void>(() => {})

	return (
		<NavbarContext.Provider
			value={{
				navbarContent,
				setNavbarContent,
				progressiveMode,
				setProgressiveMode,
				closeNavbarRef,
			}}
		>
			{children}
		</NavbarContext.Provider>
	)
}

export function useNavbar() {
	const context = useContext(NavbarContext)
	if (!context)
		throw new Error('useNavbar must be used within NavbarProvider')
	return context
}
