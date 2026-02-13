import {type ReactNode, useEffect} from 'react'
import {
	AppShell,
	Burger,
	Group,
	ScrollArea,
	Text,
} from '@mantine/core'
import {useLocalStorage, useViewportSize} from '@mantine/hooks'

interface AppShellWrapperProps {
	children: ReactNode
	showNavbar?: boolean
	navbarContent?: ReactNode
	closeNavbarRef?: React.MutableRefObject<() => void>
}

export function AppShellWrapper({
	children,
	showNavbar = false,
	navbarContent,
	closeNavbarRef,
}: AppShellWrapperProps) {
	const [navbarOpen, setNavbarOpen] = useLocalStorage<boolean>({
		key: 'evtx-navbar-open',
		defaultValue: false,
	})

	const viewport = useViewportSize()
	const isMobile = viewport.width < 768

	const handleNavbarToggle = () => {
		setNavbarOpen(!navbarOpen)
	}

	useEffect(() => {
		if (closeNavbarRef) {
			closeNavbarRef.current = () => {
				if (isMobile && navbarOpen) {
					setNavbarOpen(false)
				}
			}
		}
	}, [isMobile, navbarOpen, closeNavbarRef])

	return (
		<AppShell
			header={{height: 60}}
			navbar={{
				width: 300,
				breakpoint: 'sm',
				collapsed: {mobile: !navbarOpen, desktop: !navbarOpen},
			}}
			padding="md"
			layout="alt"
		>
			<AppShell.Header>
				<Group h="100%" px="md" justify="space-between">
					<Group>
						{showNavbar && (
							<Burger
								opened={navbarOpen}
								onClick={handleNavbarToggle}
								size="sm"
								aria-label="Toggle navigation"
							/>
						)}
						<Text size="xl" fw={700}>
							EVTX Parser
						</Text>
					</Group>
				</Group>
			</AppShell.Header>

			{showNavbar && (
				<AppShell.Navbar p="md" withBorder>
					<ScrollArea style={{height: '100%'}}>{navbarContent}</ScrollArea>
				</AppShell.Navbar>
			)}

			<AppShell.Main>{children}</AppShell.Main>
		</AppShell>
	)
}
