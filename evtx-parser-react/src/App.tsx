import {ErrorBoundary, type FallbackProps} from 'react-error-boundary'
import {EvtxParser} from '@/components/EvtxParser'
import {Center, MantineProvider, Text} from '@mantine/core'
import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
// import '@mantine/modals/styles.css'
import '@mantine/spotlight/styles.css'


function renderError({error}: FallbackProps) {
	return (
		<Center style={{minHeight: '100vh'}}>
			<Text size="xl" c="red">
				{error instanceof Error ? error.message : 'Something went wrong'}
			</Text>
		</Center>
	)
}

export function App() {
	return (
		<ErrorBoundary fallbackRender={renderError}>
			<MantineProvider defaultColorScheme="dark">
				<EvtxParser />
			</MantineProvider>
		</ErrorBoundary>
	)
}
