import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getMyPatientProfile,
  createPatient,
  updatePatient,
  updatePrimaryProvider,
  updatePrimaryPharmacy,
  type Patient,
  type CreatePatientData,
  type UpdatePatientData,
  type PrimaryProvider,
  type PrimaryPharmacy
} from '../../services/patient'
import { queryKeys } from '../query-keys'
import { ApiError } from '../../api'

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get current user's patient profile
 */
export function useMyPatient() {
  return useQuery({
    queryKey: queryKeys.patientProfile('me'),
    queryFn: getMyPatientProfile,
    retry: (failureCount, error) => {
      // Don't retry if:
      // - User is not authenticated (401) - retrying won't help
      // - Profile doesn't exist (404) - expected for onboarding flow
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        return false
      }
      return failureCount < 3
    },
  })
}

/**
 * Hook to create a new patient profile
 */
export function useCreatePatient(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: Patient) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPatient,
    onSuccess: (patient) => {
      queryClient.setQueryData(queryKeys.patientProfile('me'), patient)
      queryClient.invalidateQueries({ queryKey: queryKeys.patient() })
      
      if (options?.toastSuccess !== false) {
        toast.success('Patient profile created successfully!')
      }
      
      options?.onSuccess?.(patient)
    },
    onError: (error) => {
      console.error('Failed to create patient profile:', error)
      
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          if (error.status === 409) {
            toast.error('A patient profile already exists for your account.')
          } else if (error.status === 400) {
            toast.error('Invalid profile information. Please check your inputs.')
          } else if (error.status === 403) {
            toast.error('You do not have permission to create a patient profile.')
          } else {
            toast.error(error.message || 'Unable to create patient profile. Please try again.')
          }
        } else {
          toast.error('Network error. Please check your connection and try again.')
        }
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to update patient profile
 */
export function useUpdatePatient(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: Patient) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  const { data: currentPatient } = useMyPatient()

  return useMutation({
    mutationFn: (data: UpdatePatientData) => {
      if (!currentPatient?.id) {
        throw new Error('No patient profile found')
      }
      return updatePatient(currentPatient.id, data)
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.patientProfile('me') })
      const previousPatient = queryClient.getQueryData<Patient>(queryKeys.patientProfile('me'))

      if (previousPatient) {
        queryClient.setQueryData(queryKeys.patientProfile('me'), {
          ...previousPatient,
          ...data,
        })
      }

      return { previousPatient }
    },
    onError: (error, variables, context) => {
      if (context?.previousPatient) {
        queryClient.setQueryData(queryKeys.patientProfile('me'), context.previousPatient)
      }
      console.error('Failed to update patient:', error)
      
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            toast.error('Patient profile not found. Please create a profile first.')
          } else if (error.status === 400) {
            toast.error('Invalid profile information. Please check your inputs.')
          } else if (error.status === 403) {
            toast.error('You do not have permission to update this profile.')
          } else {
            toast.error(error.message || 'Unable to update patient profile. Please try again.')
          }
        } else {
          toast.error('Network error. Please check your connection and try again.')
        }
      }
      
      options?.onError?.(error)
    },
    onSuccess: (updatedPatient) => {
      queryClient.setQueryData(queryKeys.patientProfile('me'), updatedPatient)
      
      if (options?.toastSuccess !== false) {
        toast.success('Patient profile updated successfully!')
      }
      
      options?.onSuccess?.(updatedPatient)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patientProfile('me') })
    },
  })
}

/**
 * Hook to update patient's primary provider
 */
export function useUpdatePrimaryProvider(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: Patient) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  const { data: currentPatient } = useMyPatient()

  return useMutation({
    mutationFn: (provider: PrimaryProvider | null) => {
      if (!currentPatient?.id) {
        throw new Error('No patient profile found')
      }
      return updatePrimaryProvider(currentPatient.id, provider)
    },
    onMutate: async (provider) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.patientProfile('me') })
      const previousPatient = queryClient.getQueryData<Patient>(queryKeys.patientProfile('me'))

      if (previousPatient) {
        queryClient.setQueryData(queryKeys.patientProfile('me'), {
          ...previousPatient,
          primaryProvider: provider,
        })
      }

      return { previousPatient }
    },
    onError: (error, variables, context) => {
      if (context?.previousPatient) {
        queryClient.setQueryData(queryKeys.patientProfile('me'), context.previousPatient)
      }
      console.error('Failed to update primary provider:', error)
      
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            toast.error('Patient profile not found. Please create a profile first.')
          } else if (error.status === 400) {
            toast.error('Invalid provider information. Please check your inputs.')
          } else {
            toast.error(error.message || 'Unable to update primary provider. Please try again.')
          }
        } else {
          toast.error('Network error. Please check your connection and try again.')
        }
      }
      
      options?.onError?.(error)
    },
    onSuccess: (updatedPatient) => {
      queryClient.setQueryData(queryKeys.patientProfile('me'), updatedPatient)
      
      if (options?.toastSuccess !== false) {
        toast.success('Primary provider updated successfully!')
      }
      
      options?.onSuccess?.(updatedPatient)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patientProfile('me') })
    },
  })
}

/**
 * Hook to update patient's primary pharmacy
 */
export function useUpdatePrimaryPharmacy(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: Patient) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  const { data: currentPatient } = useMyPatient()

  return useMutation({
    mutationFn: (pharmacy: PrimaryPharmacy | null) => {
      if (!currentPatient?.id) {
        throw new Error('No patient profile found')
      }
      return updatePrimaryPharmacy(currentPatient.id, pharmacy)
    },
    onMutate: async (pharmacy) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.patientProfile('me') })
      const previousPatient = queryClient.getQueryData<Patient>(queryKeys.patientProfile('me'))

      if (previousPatient) {
        queryClient.setQueryData(queryKeys.patientProfile('me'), {
          ...previousPatient,
          primaryPharmacy: pharmacy,
        })
      }

      return { previousPatient }
    },
    onError: (error, variables, context) => {
      if (context?.previousPatient) {
        queryClient.setQueryData(queryKeys.patientProfile('me'), context.previousPatient)
      }
      console.error('Failed to update primary pharmacy:', error)
      
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            toast.error('Patient profile not found. Please create a profile first.')
          } else if (error.status === 400) {
            toast.error('Invalid pharmacy information. Please check your inputs.')
          } else {
            toast.error(error.message || 'Unable to update primary pharmacy. Please try again.')
          }
        } else {
          toast.error('Network error. Please check your connection and try again.')
        }
      }
      
      options?.onError?.(error)
    },
    onSuccess: (updatedPatient) => {
      queryClient.setQueryData(queryKeys.patientProfile('me'), updatedPatient)
      
      if (options?.toastSuccess !== false) {
        toast.success('Primary pharmacy updated successfully!')
      }
      
      options?.onSuccess?.(updatedPatient)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patientProfile('me') })
    },
  })
}

/**
 * Hook to check if user has a patient profile
 */
export function useHasPatientProfile() {
  const { data: profile, isLoading, error } = useMyPatient()

  return {
    hasProfile: !!profile && !error,
    isLoading,
    error: error && !(error instanceof ApiError && error.status === 404) ? error : null,
  }
}
