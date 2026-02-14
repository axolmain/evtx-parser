import {AppShell, Burger, Group, ScrollArea, Text} from '@mantine/core'
import type {ReactNode} from 'react'
import {useNavbar} from '@/contexts/NavbarContext'

interface AppShellWrapperProps {
	children: ReactNode
	showNavbar?: boolean
	navbarContent?: ReactNode
}

export function AppShellWrapper({
	children,
	showNavbar = false,
	navbarContent
}: AppShellWrapperProps) {
	const {mobileOpened, toggleMobile, desktopOpened, toggleDesktop} = useNavbar()

	return (
		<AppShell
			header={{height: 60}}
			layout='alt'
			navbar={{
				width: 300,
				breakpoint: 'sm',
				collapsed: {mobile: !mobileOpened, desktop: !desktopOpened}
			}}
			padding='md'
		>
			<AppShell.Header>
				<Group h='100%' px='md'>
					{showNavbar && (
						<>
							<Burger
								hiddenFrom='sm'
								onClick={toggleMobile}
								opened={mobileOpened}
								size='sm'
							/>
							<Burger
								onClick={toggleDesktop}
								opened={desktopOpened}
								size='sm'
								visibleFrom='sm'
							/>
						</>
					)}
					<Text fw={700} size='xl'>
						EVTX Parser
					</Text>
				</Group>
			</AppShell.Header>

			{showNavbar && (
				<AppShell.Navbar p='md' withBorder={true}>
					<ScrollArea style={{height: '100%'}}>{navbarContent}</ScrollArea>
				</AppShell.Navbar>
			)}

			<AppShell.Main>{children}</AppShell.Main>
		</AppShell>
	)
}
