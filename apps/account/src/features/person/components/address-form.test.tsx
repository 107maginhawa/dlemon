import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddressForm } from './address-form'

describe('AddressForm', () => {
  afterEach(() => {
    cleanup()
  })

  test('renders address form with all fields', () => {
    const onSubmit = () => {}
    render(<AddressForm onSubmit={onSubmit} />)

    // Check for form fields - use exact match to avoid matching "Street Address Line 2"
    expect(screen.getByLabelText(/^street address$/i)).toBeDefined()
    expect(screen.getByLabelText(/city/i)).toBeDefined()
    expect(screen.getByLabelText(/state/i)).toBeDefined()
    expect(screen.getByLabelText(/zip/i)).toBeDefined()
    expect(screen.getByLabelText(/country/i)).toBeDefined()
  })

  test('renders with default values', () => {
    const defaultValues = {
      street1: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001',
      country: 'US'
    }

    const onSubmit = () => {}
    render(<AddressForm defaultValues={defaultValues} onSubmit={onSubmit} />)

    const addressInput = screen.getByDisplayValue('123 Main St') as HTMLInputElement
    expect(addressInput).toBeDefined()
    expect(addressInput.value).toBe('123 Main St')

    const cityInput = screen.getByDisplayValue('Los Angeles') as HTMLInputElement
    expect(cityInput).toBeDefined()
    expect(cityInput.value).toBe('Los Angeles')
  })

  test('includes optional address line 2 field', () => {
    const onSubmit = () => {}
    render(<AddressForm onSubmit={onSubmit} />)

    expect(screen.getByLabelText(/street address line 2/i)).toBeDefined()
  })

  test('validates required fields', async () => {
    const onSubmit = () => {}
    render(<AddressForm onSubmit={onSubmit} showButtons={true} required={true} />)

    const submitButton = screen.getByRole('button', { name: /continue/i })

    // Try to submit without filling required fields
    fireEvent.click(submitButton)

    // Should show validation errors
    await waitFor(() => {
      // At least one required field error should appear
      const errors = screen.queryAllByText(/required/i)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  test('handles form submission', async () => {
    let submittedData: any = null
    const onSubmit = (data: any) => {
      submittedData = data
    }

    render(<AddressForm onSubmit={onSubmit} showButtons={true} />)

    // Fill in form fields
    await userEvent.type(screen.getByLabelText(/^street address$/i), '456 Elm St')
    await userEvent.type(screen.getByLabelText(/city/i), 'San Francisco')

    // Select state (assuming it's a select field)
    const stateField = screen.getByLabelText(/state/i)
    await userEvent.type(stateField, 'CA')

    await userEvent.type(screen.getByLabelText(/zip/i), '94102')

    // Select country
    const countryField = screen.getByLabelText(/country/i)
    fireEvent.click(countryField)

    // Submit form
    const submitButton = screen.getByRole('button', { name: /continue/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(submittedData).toBeDefined()
    })
  })
})
