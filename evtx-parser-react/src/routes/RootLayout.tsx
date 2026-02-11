import {Outlet} from '@tanstack/react-router'
import {GlobalSearch} from '@/components/GlobalSearch'
import {PWAPrompt} from '@/components/PWAPrompt'

export function RootLayout() {
	return (
		<>
			<GlobalSearch />
			<Outlet />
			<PWAPrompt />
		</>
	)
}
