import {Outlet, useMatches} from '@tanstack/react-router'
import {AppShellWrapper} from '@/components/AppShellWrapper'
import {GlobalSearch} from '@/components/GlobalSearch'
import {PWAPrompt} from '@/components/PWAPrompt'
import {useNavbar} from '@/contexts/NavbarContext'

export function RootLayout() {
	const matches = useMatches()
	const isArchiveRoute = matches.some((match) =>
		match.pathname.startsWith('/archive/'),
	)
	const {navbarContent, closeNavbarRef} = useNavbar()

	return (
		<>
			<GlobalSearch />
			<AppShellWrapper
				showNavbar={isArchiveRoute}
				navbarContent={navbarContent}
				closeNavbarRef={closeNavbarRef}
			>
				<Outlet />
			</AppShellWrapper>
			<PWAPrompt />
		</>
	)
}
