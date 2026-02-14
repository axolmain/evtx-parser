import {useRegisterSW} from 'virtual:pwa-register/react'
import {Button, Group, Notification} from '@mantine/core'
import {useEffect, useRef, useState} from 'react'

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>
	userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>
}

export function PWAPrompt() {
	const [showInstallPrompt, setShowInstallPrompt] = useState(false)
	const [installable, setInstallable] = useState(false)
	const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

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

	const dismissInstall = () => {
		deferredPrompt.current = null
		setInstallable(false)
	}

	const handleInstall = async () => {
		const prompt = deferredPrompt.current
		if (!prompt) return
		await prompt.prompt()
		const {outcome} = await prompt.userChoice
		if (outcome === 'accepted') {
			deferredPrompt.current = null
			setInstallable(false)
		}
	}

	useEffect(() => {
		if (offlineReady) {
			setShowInstallPrompt(true)
		}
	}, [offlineReady])

	useEffect(() => {
		const handler = (e: Event) => {
			e.preventDefault()
			deferredPrompt.current = e as BeforeInstallPromptEvent
			setInstallable(true)
		}
		window.addEventListener('beforeinstallprompt', handler)
		return () => window.removeEventListener('beforeinstallprompt', handler)
	}, [])

	if (!(offlineReady || needRefresh || installable)) {
		return null
	}

	return (
		<div
			style={{
				position: 'fixed',
				bottom: '1rem',
				right: '1rem',
				zIndex: 9999,
				display: 'flex',
				flexDirection: 'column',
				gap: '0.5rem'
			}}
		>
			{installable && (
				<Notification
					color='violet'
					onClose={dismissInstall}
					title='Install app'
					withCloseButton={true}
				>
					Install EVTX Parser for quick access and offline use.
					<Group gap='xs' mt='sm'>
						<Button onClick={handleInstall} size='xs'>
							Install
						</Button>
						<Button onClick={dismissInstall} size='xs' variant='subtle'>
							Not now
						</Button>
					</Group>
				</Notification>
			)}

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
