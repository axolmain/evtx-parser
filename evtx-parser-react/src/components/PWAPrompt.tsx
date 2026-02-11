import {useRegisterSW} from 'virtual:pwa-register/react'
import {Button, Group, Notification} from '@mantine/core'
import {useEffect, useState} from 'react'

export function PWAPrompt() {
	const [showInstallPrompt, setShowInstallPrompt] = useState(false)

	const {
		offlineReady: [offlineReady, setOfflineReady],
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker
	} = useRegisterSW({
		onRegistered(_r) {},
		onRegisterError(_error) {}
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

	if (!(offlineReady || needRefresh)) {
		return null
	}

	return (
		<div
			style={{position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999}}
		>
			{offlineReady && showInstallPrompt && (
				<Notification
					color='green'
					onClose={close}
					title='App ready for offline use'
					withCloseButton={true}
				>
					The app is now cached and ready to work offline!
				</Notification>
			)}

			{needRefresh && (
				<Notification
					color='blue'
					onClose={close}
					title='Update available'
					withCloseButton={true}
				>
					<Group gap='xs' mt='sm'>
						<Button onClick={() => updateServiceWorker(true)} size='xs'>
							Update now
						</Button>
						<Button onClick={close} size='xs' variant='subtle'>
							Later
						</Button>
					</Group>
				</Notification>
			)}
		</div>
	)
}
