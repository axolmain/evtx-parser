import {type ReactNode, useEffect} from 'react'
import {
	AppShell,
	Burger,
	Group,
	ScrollArea,
	Switch,
	Text,
	Tooltip,
} from '@mantine/core'
import {useLocalStorage, useViewportSize} from '@mantine/hooks'

interface AppShellWrapperProps {
	children: ReactNode
	showNavbar?: boolean // Whether navbar is available (only on archive routes)
	navbarContent?: ReactNode // Navbar content (ZipFileBrowser)
	onProgressiveModeChange?: (enabled: boolean) => void
	closeNavbarRef?: React.MutableRefObject<() => void> // Ref to close navbar function
}

export function AppShellWrapper({
	children,
	showNavbar = false,
	navbarContent,
	onProgressiveModeChange,
	closeNavbarRef,
}: AppShellWrapperProps) {
	const [navbarOpen, setNavbarOpen] = useLocalStorage<boolean>({
		key: 'evtx-navbar-open',
		defaultValue: false, // Collapsed by default
	})

	const [progressiveMode, setProgressiveMode] = useLocalStorage<boolean>({
		key: 'evtx-progressive-mode',
		defaultValue: false,
	})

	const viewport = useViewportSize()
	const isMobile = viewport.width < 768

	const handleProgressiveToggle = (checked: boolean) => {
		setProgressiveMode(checked)
		onProgressiveModeChange?.(checked)
	}

	const handleNavbarToggle = () => {
		setNavbarOpen(!navbarOpen)
	}

	// Provide close navbar callback for mobile auto-close
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
			layout="alt" // Navbar overlays content instead of pushing it
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

					<Group gap="lg">
						<Tooltip label="Parse files progressively (faster initial load)">
							<Group gap="xs">
								<Switch
									checked={progressiveMode}
									onChange={(e) =>
										handleProgressiveToggle(e.currentTarget.checked)
									}
									size="md"
								/>
								<Text size="sm" c="dimmed">
									Progressive
								</Text>
							</Group>
						</Tooltip>
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
