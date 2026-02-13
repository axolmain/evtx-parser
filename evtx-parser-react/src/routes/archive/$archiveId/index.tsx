import {Box, Text} from '@mantine/core'
import {createFileRoute} from '@tanstack/react-router'

export const Route = createFileRoute('/archive/$archiveId/')({
	component: ArchiveIndex,
})

function ArchiveIndex() {
	return (
		<Box p='4rem'>
			<Text c='dimmed' size='lg' ta='center'>
				Select a file from the sidebar to view its contents
			</Text>
		</Box>
	)
}
