import {ErrorBoundary, type FallbackProps} from 'react-error-boundary'
import {FileViewer} from '@/components/FileViewer'
import {GlobalSearch} from '@/components/GlobalSearch'
import {PWAPrompt} from '@/components/PWAPrompt'
import {Center, MantineProvider, Text} from '@mantine/core'
import {useFileViewer} from '@/hooks/useFileViewer'
import {useState} from 'react'
import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
// import '@mantine/modals/styles.css'
import '@mantine/spotlight/styles.css'
import '@mantine/dates/styles.css'
import 'mantine-react-table/styles.css'


function renderError({error}: FallbackProps) {
	return (
		<Center style={{minHeight: '100vh'}}>
			<Text size="xl" c="red">
				{error instanceof Error ? error.message : 'Something went wrong'}
			</Text>
		</Center>
	)
}

function AppContent() {
	const viewer = useFileViewer()
	const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null)

	const handleEventSelect = async (archiveId: string, fileName: string, recordId: number) => {
		await viewer.navigateToEvent(archiveId, fileName, recordId)
		setSelectedRecordId(recordId)
	}

	return (
		<>
			<GlobalSearch onEventSelect={handleEventSelect} />
			<FileViewer viewer={viewer} selectedRecordId={selectedRecordId} />
			<PWAPrompt />
		</>
	)
}

export function App() {
	return (
		<MantineProvider defaultColorScheme="dark">
			<ErrorBoundary fallbackRender={renderError}>
				<AppContent />
			</ErrorBoundary>
		</MantineProvider>
	)
}
