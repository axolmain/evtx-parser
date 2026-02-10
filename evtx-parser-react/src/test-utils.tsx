import {type RenderOptions, render as rtlRender} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {ReactElement} from 'react'

export function render(
	ui: ReactElement,
	options?: Omit<RenderOptions, 'wrapper'>
) {
	return {
		user: userEvent.setup(),
		...rtlRender(ui, options)
	}
}

// biome-ignore lint: test file
export * from '@testing-library/react'
