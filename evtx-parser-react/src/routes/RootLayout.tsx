import {Outlet, useMatches} from '@tanstack/react-router'
import {AppShellWrapper} from '@/components/AppShellWrapper'
import {GlobalSearch} from '@/components/GlobalSearch'
import {PWAPrompt} from '@/components/PWAPrompt'
import {useNavbar} from '@/contexts/NavbarContext'

export function RootLayout() {
	// Detect if we're on an archive route
	const matches = useMatches()
	const isArchiveRoute = matches.some((match) =>
		match.pathname.startsWith('/archive/'),
	)
	const {navbarContent, setProgressiveMode, closeNavbarRef} = useNavbar()

	return (
		<>
			<GlobalSearch />
			<AppShellWrapper
				showNavbar={isArchiveRoute}
				navbarContent={navbarContent}
				onProgressiveModeChange={setProgressiveMode}
				closeNavbarRef={closeNavbarRef}
			>
				<Outlet />
			</AppShellWrapper>
			<PWAPrompt />
		</>
	)
}
