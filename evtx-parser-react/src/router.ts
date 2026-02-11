import {
	createHashHistory,
	createRootRoute,
	createRoute,
	createRouter
} from '@tanstack/react-router'
import {ArchiveIndex, ArchiveLayout} from '@/routes/ArchiveLayout'
import {FileViewPage} from '@/routes/FileViewPage'
import {HomePage} from '@/routes/HomePage'
import {RootLayout} from '@/routes/RootLayout'
import {StandalonePage} from '@/routes/StandalonePage'

const rootRoute = createRootRoute({
	component: RootLayout
})

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	component: HomePage
})

const archiveRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/archive/$archiveId',
	component: ArchiveLayout
})

const archiveIndexRoute = createRoute({
	getParentRoute: () => archiveRoute,
	path: '/',
	component: ArchiveIndex
})

interface FileSearchParams {
	view?: string
	search?: string
	levels?: string
	event?: number
	page?: number
	pageSize?: number
}

const fileRoute = createRoute({
	getParentRoute: () => archiveRoute,
	path: '/file/$fileName',
	component: FileViewPage,
	validateSearch: (search: Record<string, unknown>): FileSearchParams => {
		const params: FileSearchParams = {}
		if (search['view'] !== undefined) params.view = String(search['view'])
		if (search['search'] !== undefined) params.search = String(search['search'])
		if (search['levels'] !== undefined) params.levels = String(search['levels'])
		if (search['event'] !== undefined) params.event = Number(search['event'])
		if (search['page'] !== undefined) params.page = Number(search['page'])
		if (search['pageSize'] !== undefined) params.pageSize = Number(search['pageSize'])
		return params
	}
})

const standaloneRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/standalone',
	component: StandalonePage
})

const routeTree = rootRoute.addChildren([
	indexRoute,
	archiveRoute.addChildren([archiveIndexRoute, fileRoute]),
	standaloneRoute
])

const hashHistory = createHashHistory()

export const router = createRouter({
	routeTree,
	history: hashHistory,
	defaultNotFoundComponent: () => {
		// Redirect to home on not found
		window.location.hash = '#/'
		return null
	}
})

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router
	}
}
