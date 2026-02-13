import {
	createContext,
	useContext,
	useState,
	type ReactNode,
} from 'react'
import {useDisclosure} from '@mantine/hooks'

interface NavbarContextType {
	navbarContent: ReactNode | null
	setNavbarContent: (content: ReactNode | null) => void
	mobileOpened: boolean
	toggleMobile: () => void
	desktopOpened: boolean
	toggleDesktop: () => void
	closeMobile: () => void
}

const NavbarContext = createContext<NavbarContextType | null>(null)

export function NavbarProvider({children}: {children: ReactNode}) {
	const [navbarContent, setNavbarContent] = useState<ReactNode | null>(null)
	const [mobileOpened, {toggle: toggleMobile, close: closeMobile}] = useDisclosure()
	const [desktopOpened, {toggle: toggleDesktop}] = useDisclosure()

	return (
		<NavbarContext.Provider
			value={{
				navbarContent,
				setNavbarContent,
				mobileOpened,
				toggleMobile,
				desktopOpened,
				toggleDesktop,
				closeMobile,
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
