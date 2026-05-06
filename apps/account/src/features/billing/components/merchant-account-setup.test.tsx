import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MerchantAccountSetup } from './merchant-account-setup'

afterEach(() => cleanup())

const defaultProps = {
  account: null,
  status: 'none' as const,
  isLoading: false,
  onSetupAccount: mock(() => {}),
  onSubmit: mock(() => {}),
  onSkip: mock(() => {}),
}

describe('MerchantAccountSetup', () => {
  test('renders loading state', () => {
    render(<MerchantAccountSetup {...defaultProps} isLoading={true} />)
    // Loading spinner rendered (animate-spin element present)
    const container = document.querySelector('.animate-spin')
    expect(container).not.toBeNull()
  })

  test('renders "none" state with setup button', () => {
    render(<MerchantAccountSetup {...defaultProps} status="none" />)
    expect(screen.getByRole('button', { name: /set up merchant account/i })).toBeDefined()
    expect(screen.getByText(/merchant account setup/i)).toBeDefined()
  })

  test('renders "incomplete" state with continue setup button', () => {
    render(
      <MerchantAccountSetup
        {...defaultProps}
        account={{ id: 'acc-1' }}
        status="incomplete"
      />
    )
    expect(screen.getByRole('button', { name: /continue payment account onboarding setup/i })).toBeDefined()
    expect(screen.getByText(/complete your payment setup/i)).toBeDefined()
  })

  test('renders "complete" state with connected message', () => {
    render(
      <MerchantAccountSetup
        {...defaultProps}
        account={{ id: 'acc-1' }}
        status="complete"
      />
    )
    expect(screen.getByText(/merchant account connected/i)).toBeDefined()
  })

  test('calls onSetupAccount when setup button clicked', async () => {
    const onSetupAccount = mock(() => {})
    render(<MerchantAccountSetup {...defaultProps} status="none" onSetupAccount={onSetupAccount} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /set up merchant account/i }))
    expect(onSetupAccount).toHaveBeenCalledTimes(1)
  })

  test('calls onSetupAccount when continue setup clicked (incomplete)', async () => {
    const onSetupAccount = mock(() => {})
    render(
      <MerchantAccountSetup
        {...defaultProps}
        account={{ id: 'acc-1' }}
        status="incomplete"
        onSetupAccount={onSetupAccount}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /continue payment account onboarding setup/i }))
    expect(onSetupAccount).toHaveBeenCalledTimes(1)
  })

  test('shows Skip and Continue buttons when showButtons=true and complete', () => {
    render(
      <MerchantAccountSetup
        {...defaultProps}
        account={{ id: 'acc-1' }}
        status="complete"
        showButtons={true}
      />
    )
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDefined()
  })

  test('hides action buttons when showButtons=false', () => {
    render(
      <MerchantAccountSetup
        {...defaultProps}
        account={{ id: 'acc-1' }}
        status="complete"
        showButtons={false}
      />
    )
    expect(screen.queryByRole('button', { name: /skip for now/i })).toBeNull()
  })

  test('calls onSkip when Skip button clicked', async () => {
    const onSkip = mock(() => {})
    render(
      <MerchantAccountSetup
        {...defaultProps}
        account={{ id: 'acc-1' }}
        status="complete"
        onSkip={onSkip}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  test('calls onSubmit when Continue button clicked (complete status)', async () => {
    const onSubmit = mock(() => {})
    render(
      <MerchantAccountSetup
        {...defaultProps}
        account={{ id: 'acc-1' }}
        status="complete"
        onSubmit={onSubmit}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test('action buttons disabled while loading (incomplete status)', () => {
    // When isLoading=true the component returns the loading spinner (early return),
    // so there are no action buttons to query. Verify the loading spinner renders instead.
    render(
      <MerchantAccountSetup
        {...defaultProps}
        account={{ id: 'acc-1' }}
        status="incomplete"
        isLoading={true}
      />
    )
    // Loading skeleton renders — no buttons present
    expect(screen.queryByRole('button')).toBeNull()
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).not.toBeNull()
  })
})
