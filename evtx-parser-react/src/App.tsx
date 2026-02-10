import {ErrorBoundary, type FallbackProps} from 'react-error-boundary'
import {EvtxParser} from '@/components/EvtxParser'
import {MantineProvider} from "@mantine/core";
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/modals/styles.css';
import '@mantine/spotlight/styles.css';


function renderError({error}: FallbackProps) {
	return (
		<div className='flex min-h-screen items-center justify-center'>
			<h1 className='text-[#e66] text-xl'>
				{error instanceof Error ? error.message : 'Something went wrong'}
			</h1>
		</div>
	)
}

export function App() {
	return (
		<ErrorBoundary fallbackRender={renderError}>
			<MantineProvider> 
				<EvtxParser />
			</MantineProvider>
		</ErrorBoundary>
	)
}
