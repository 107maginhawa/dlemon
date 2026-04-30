import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactInfoForm } from './contact-info-form'

describe('ContactInfoForm', () => {
  afterEach(() => {
    cleanup()
  })

  test('renders contact info form with all fields', () => {
    const onSubmit = () => {}
    render(<ContactInfoForm onSubmit={onSubmit} />)

    // Check for form fields
    expect(screen.getByLabelText(/email/i)).toBeDefined()
    expect(screen.getByLabelText(/phone/i)).toBeDefined()
  })

  test('renders with default values', () => {
    const defaultValues = {
      email: 'john@example.com',
      phone: '+12133734253'
    }

    const onSubmit = () => {}
    render(<ContactInfoForm defaultValues={defaultValues} onSubmit={onSubmit} />)

    const emailInput = screen.getByDisplayValue('john@example.com') as HTMLInputElement
    expect(emailInput).toBeDefined()
    expect(emailInput.value).toBe('john@example.com')
  })

  test('validates email format', async () => {
    const onSubmit = () => {}
    render(<ContactInfoForm onSubmit={onSubmit} showButtons={true} />)

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    const submitButton = screen.getByRole('button', { name: /save/i })

    // Enter invalid email
    await userEvent.type(emailInput, 'invalid-email')
    fireEvent.click(submitButton)

    // Should show validation error
    await waitFor(() => {
      const errorMessage = screen.queryByText(/invalid email/i)
      expect(errorMessage).toBeDefined()
    })
  })

  test('shows submit and cancel buttons', () => {
    const onSubmit = () => {}
    const onCancel = () => {}
    render(
      <ContactInfoForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        showButtons={true}
      />
    )

    expect(screen.getByRole('button', { name: /save/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined()
  })
})
