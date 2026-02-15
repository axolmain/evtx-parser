import {createRootRoute, Outlet} from '@tanstack/react-router'
import {AppShellWrapper} from '@/components/AppShellWrapper'
import {GlobalSearch} from '@/components/GlobalSearch'
import {PWAPrompt} from '@/components/PWAPrompt'
import {useNavbar} from '@/contexts/NavbarContext'

function RootLayout() {
	const {navbarContent} = useNavbar()

	return (
		<>
			<GlobalSearch />
			<AppShellWrapper
				navbarContent={navbarContent}
				showNavbar={Boolean(navbarContent)}
			>
				<Outlet />
			</AppShellWrapper>
			<PWAPrompt />
		</>
	)
}

export const Route = createRootRoute({
	component: RootLayout
})
