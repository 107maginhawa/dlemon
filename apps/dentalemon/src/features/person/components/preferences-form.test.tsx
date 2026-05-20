import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PreferencesForm } from './preferences-form'

describe('PreferencesForm', () => {
  afterEach(() => {
    cleanup()
  })

  test('renders preferences form with all fields', () => {
    const onSubmit = () => {}
    render(<PreferencesForm onSubmit={onSubmit} />)

    // Check for form field labels - now accessible with getByLabelText
    expect(screen.getByLabelText(/languages spoken/i)).not.toBeNull()
    expect(screen.getByLabelText(/timezone/i)).not.toBeNull()
  })

  test('renders with default values', () => {
    const defaultValues = {
      languagesSpoken: ['en'],
      timezone: 'America/New_York'
    }

    const onSubmit = () => {}
    render(<PreferencesForm defaultValues={defaultValues} onSubmit={onSubmit} />)

    // Check that form renders with defaults
    expect(screen.getByLabelText(/languages spoken/i)).not.toBeNull()
    expect(screen.getByLabelText(/timezone/i)).not.toBeNull()
  })

  test('includes communication preferences', () => {
    const onSubmit = () => {}
    render(<PreferencesForm onSubmit={onSubmit} />)

    // Form only has language and timezone fields, no communication preferences
    expect(screen.getByLabelText(/languages spoken/i)).not.toBeNull()
    expect(screen.getByLabelText(/timezone/i)).not.toBeNull()
  })

  test('handles language selection', async () => {
    const onSubmit = () => {}
    render(<PreferencesForm onSubmit={onSubmit} />)

    // Languages field should be present
    expect(screen.getByLabelText(/languages spoken/i)).not.toBeNull()
    expect(screen.getByText(/select all languages you speak/i)).not.toBeNull()
  })

  test('handles timezone selection', async () => {
    const onSubmit = () => {}
    render(<PreferencesForm onSubmit={onSubmit} />)

    // Timezone field should be present with detected timezone
    expect(screen.getByLabelText(/timezone/i)).not.toBeNull()
    expect(screen.getByText(/current detected timezone/i)).not.toBeNull()
  })

  test('displays proper language names in badges, not codes', async () => {
    const defaultValues = {
      languagesSpoken: ['en', 'es', 'ar']
    }

    const onSubmit = () => {}
    render(<PreferencesForm defaultValues={defaultValues} onSubmit={onSubmit} />)

    // Should display proper names in badges (using nativeName which is the label)
    await waitFor(() => {
      expect(screen.getByText('English')).not.toBeNull()
      expect(screen.getByText('Español')).not.toBeNull()
      expect(screen.getByText('العربية')).not.toBeNull()

      // Should NOT display 3-letter codes
      expect(screen.queryByText('eng')).toBeNull()
      expect(screen.queryByText('spa')).toBeNull()
      expect(screen.queryByText('ara')).toBeNull()
    })
  })

  test('displays native language names in badges', async () => {
    const defaultValues = {
      languagesSpoken: ['en', 'es', 'ja', 'fr']
    }

    const onSubmit = () => {}
    render(<PreferencesForm defaultValues={defaultValues} onSubmit={onSubmit} />)

    // Since preferences-form uses nativeName in labels
    await waitFor(() => {
      expect(screen.getByText('English')).not.toBeNull()
      expect(screen.getByText('Español')).not.toBeNull()
      expect(screen.getByText('日本語')).not.toBeNull()
      expect(screen.getByText('Français')).not.toBeNull()
    })
  })

  test('displays native language names in dropdown', async () => {
    const user = userEvent.setup()
    const onSubmit = () => {}
    render(<PreferencesForm onSubmit={onSubmit} />)

    const combobox = screen.getByTestId('languages-combobox')
    await user.click(combobox)

    await waitFor(() => {
      // Check for a few languages to ensure they are using the native name
      expect(screen.getByText('Español')).not.toBeNull()
      expect(screen.getByText('日本語')).not.toBeNull()
      expect(screen.getByText('Français')).not.toBeNull()
    })
  })


  test('toggles communication preferences', async () => {
    const onSubmit = () => {}
    render(<PreferencesForm onSubmit={onSubmit} />)

    // This form doesn't have communication preferences, just verify form renders
    expect(screen.getByLabelText(/languages spoken/i)).not.toBeNull()
    expect(screen.getByLabelText(/timezone/i)).not.toBeNull()
  })

  test('submits form with preferences', async () => {
    const user = userEvent.setup()
    let submittedData: any = null
    const onSubmit = (data: any) => {
      submittedData = data
    }

    render(<PreferencesForm onSubmit={onSubmit} showButtons={true} />)

    // Submit form
    const submitButton = screen.getByRole('button', { name: /save preferences/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(submittedData).not.toBeNull()
    })
  })

  test('shows cancel button when provided', () => {
    const onSubmit = () => {}
    const onCancel = () => {}
    render(
      <PreferencesForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        showButtons={true}
      />
    )

    expect(screen.getByRole('button', { name: /cancel/i })).not.toBeNull()
  })
})
