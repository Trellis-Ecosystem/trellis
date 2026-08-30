import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ToastProvider, useToastActions } from '../../hooks/useToast'

const TestComponent = () => {
  const toast = useToastActions()

  return (
    <div>
      <button onClick={() => toast.success({ title: 'Success', message: 'Test success' })}>
        Show Success
      </button>
      <button onClick={() => toast.error({ title: 'Error', message: 'Test error' })}>
        Show Error
      </button>
      <button onClick={() => toast.info({ title: 'Info', message: 'Test info' })}>
        Show Info
      </button>
    </div>
  )
}

const renderWithToastProvider = () => {
  return render(
    <ToastProvider>
      <TestComponent />
    </ToastProvider>
  )
}

describe('<ToastProvider />', () => {
  it('renders toast provider and child components', () => {
    renderWithToastProvider()

    expect(screen.getByRole('button', { name: 'Show Success' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show Error' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show Info' })).toBeInTheDocument()
  })

  it('renders successfully without crashing', () => {
    expect(() => {
      renderWithToastProvider()
    }).not.toThrow()
  })

  it('provides toast context to child components', () => {
    renderWithToastProvider()

    expect(screen.getByRole('button', { name: 'Show Success' })).toBeInTheDocument()
  })

  it('renders toast actions buttons', () => {
    renderWithToastProvider()

    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})
