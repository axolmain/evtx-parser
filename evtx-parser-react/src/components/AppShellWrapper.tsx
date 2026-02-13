import {type ReactNode} from 'react'
import {AppShell, Burger, Group, ScrollArea, Text} from '@mantine/core'
import {useNavbar} from '@/contexts/NavbarContext'

interface AppShellWrapperProps {
	children: ReactNode
	showNavbar?: boolean
	navbarContent?: ReactNode
}

export function AppShellWrapper({
	children,
	showNavbar = false,
	navbarContent,
}: AppShellWrapperProps) {
	const {mobileOpened, toggleMobile, desktopOpened, toggleDesktop} = useNavbar()

	return (
		<AppShell
			header={{height: 60}}
			navbar={{
				width: 300,
				breakpoint: 'sm',
				collapsed: {mobile: !mobileOpened, desktop: !desktopOpened},
			}}
			padding="md"
			layout="alt"
		>
			<AppShell.Header>
				<Group h="100%" px="md">
					{showNavbar && (
						<>
							<Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
							<Burger opened={desktopOpened} onClick={toggleDesktop} visibleFrom="sm" size="sm" />
						</>
					)}
					<Text size="xl" fw={700}>
						EVTX Parser
					</Text>
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
