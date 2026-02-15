import {Center, MantineProvider, Text} from '@mantine/core'
import {RouterProvider} from '@tanstack/react-router'
import {ErrorBoundary, type FallbackProps} from 'react-error-boundary'
import {CacheProvider} from '@/contexts/CacheContext'
import {NavbarProvider} from '@/contexts/NavbarContext'
import {router} from '@/router'
import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
import '@mantine/spotlight/styles.css'
import '@mantine/dates/styles.css'
import 'mantine-react-table/styles.css'

function renderError({error}: FallbackProps) {
	return (
		<Center style={{minHeight: '100vh'}}>
			<Text c='red' size='xl'>
				{error instanceof Error ? error.message : 'Something went wrong'}
			</Text>
		</Center>
	)
}

export function App() {
	return (
		<MantineProvider defaultColorScheme='dark'>
			<ErrorBoundary fallbackRender={renderError}>
				<CacheProvider>
					<NavbarProvider>
						<RouterProvider router={router} />
					</NavbarProvider>
				</CacheProvider>
			</ErrorBoundary>
		</MantineProvider>
	)
}
