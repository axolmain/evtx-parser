import { useEffect, useState } from 'react'
import { Button, Group, Notification } from '@mantine/core'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWAPrompt() {
	const [showInstallPrompt, setShowInstallPrompt] = useState(false)

	const {
		offlineReady: [offlineReady, setOfflineReady],
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		onRegistered(r) {
			console.log('SW Registered:', r)
		},
		onRegisterError(error) {
			console.log('SW registration error', error)
		},
	})

	const close = () => {
		setOfflineReady(false)
		setNeedRefresh(false)
		setShowInstallPrompt(false)
	}

	useEffect(() => {
		if (offlineReady) {
			setShowInstallPrompt(true)
		}
	}, [offlineReady])

	if (!offlineReady && !needRefresh) {
		return null
	}

	return (
		<div style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999 }}>
			{offlineReady && showInstallPrompt && (
				<Notification
					title="App ready for offline use"
					color="green"
					onClose={close}
					withCloseButton
				>
					The app is now cached and ready to work offline!
				</Notification>
			)}

			{needRefresh && (
				<Notification
					title="Update available"
					color="blue"
					onClose={close}
					withCloseButton
				>
					<Group gap="xs" mt="sm">
						<Button size="xs" onClick={() => updateServiceWorker(true)}>
							Update now
						</Button>
						<Button size="xs" variant="subtle" onClick={close}>
							Later
						</Button>
					</Group>
				</Notification>
			)}
		</div>
	)
}
