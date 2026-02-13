import {parseEvtx} from '@/parser'

self.onmessage = (e: MessageEvent<ArrayBuffer>) => {
	const result = parseEvtx(e.data)
	self.postMessage(result)
}
