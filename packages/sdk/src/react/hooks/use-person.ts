import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getMyProfile,
  createMyPerson,
  updateMyPersonalInfo,
  updateMyContactInfo,
  updateMyAddress,
  updateMyPreferences,
  type Person,
  type CreatePersonData,
  type PersonalInfo,
  type OptionalAddress,
  type ContactInfo,
  type Preferences,
} from '../../services/person'
import { queryKeys } from '../query-keys'
import { ApiError } from '../../api'

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get the current person's person profile
 */
export function useMyPerson() {
  return useQuery({
    queryKey: queryKeys.personProfile('me'),
    queryFn: getMyProfile,
    retry: (failureCount, error) => {
      // Don't retry if:
      // - User is not authenticated (401) - retrying won't help
      // - Person profile doesn't exist (404) - expected for onboarding flow
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        return false
      }
      return failureCount < 3
    },
  })
}

/**
 * Hook to create a new person profile for the current user
 */
export function useCreateMyPerson(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: Person) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createMyPerson,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.person() })
      
      if (options?.toastSuccess !== false) {
        toast.success('Profile created successfully!')
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error) => {
      console.error('Failed to create person profile:', error)
      
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          toast.error(error.message || 'Failed to create profile')
        } else {
          toast.error('Failed to create profile. Please try again.')
        }
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to update the current user's personal information
 */
export function useUpdateMyPersonalInfo(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ personId, data }: { personId: string; data: PersonalInfo }) =>
      updateMyPersonalInfo(personId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personProfile('me') })

      if (options?.toastSuccess !== false) {
        toast.success('Personal information updated successfully!')
      }

      options?.onSuccess?.(data)
    },
    onError: (err) => {
      console.error('Failed to update personal information:', err)

      if (options?.toastError !== false) {
        if (err instanceof ApiError) {
          toast.error(err.message || 'Failed to update personal information')
        } else {
          toast.error('Failed to update personal information. Please try again.')
        }
      }

      options?.onError?.(err)
    },
  })
}

/**
 * Hook to update the current user's contact information
 */
export function useUpdateMyContactInfo(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ personId, data }: { personId: string; data: ContactInfo }) =>
      updateMyContactInfo(personId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personProfile('me') })

      if (options?.toastSuccess !== false) {
        toast.success('Contact information updated successfully!')
      }

      options?.onSuccess?.(data)
    },
    onError: (err) => {
      console.error('Failed to update contact information:', err)

      if (options?.toastError !== false) {
        if (err instanceof ApiError) {
          toast.error(err.message || 'Failed to update contact information')
        } else {
          toast.error('Failed to update contact information. Please try again.')
        }
      }

      options?.onError?.(err)
    },
  })
}

/**
 * Hook to update the current user's address
 */
export function useUpdateMyAddress(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ personId, data }: { personId: string; data: OptionalAddress }) =>
      updateMyAddress(personId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personProfile('me') })

      if (options?.toastSuccess !== false) {
        toast.success('Address updated successfully!')
      }

      options?.onSuccess?.(data)
    },
    onError: (err) => {
      console.error('Failed to update address:', err)

      if (options?.toastError !== false) {
        if (err instanceof ApiError) {
          toast.error(err.message || 'Failed to update address')
        } else {
          toast.error('Failed to update address. Please try again.')
        }
      }

      options?.onError?.(err)
    },
  })
}

/**
 * Hook to update the current user's preferences
 */
export function useUpdateMyPreferences(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ personId, data }: { personId: string; data: Preferences }) =>
      updateMyPreferences(personId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personProfile('me') })

      if (options?.toastSuccess !== false) {
        toast.success('Preferences updated successfully!')
      }

      options?.onSuccess?.(data)
    },
    onError: (err) => {
      console.error('Failed to update preferences:', err)

      if (options?.toastError !== false) {
        if (err instanceof ApiError) {
          toast.error(err.message || 'Failed to update preferences')
        } else {
          toast.error('Failed to update preferences. Please try again.')
        }
      }

      options?.onError?.(err)
    },
  })
}
