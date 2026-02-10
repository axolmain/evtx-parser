import {ErrorBoundary, type FallbackProps} from 'react-error-boundary'
import {EvtxParser} from '@/components/EvtxParser'

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
			<EvtxParser />
		</ErrorBoundary>
	)
}
