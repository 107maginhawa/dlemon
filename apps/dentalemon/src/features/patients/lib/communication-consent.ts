/**
 * Communication-consent persistence (FIX-003 / GAP-4).
 *
 * The post-registration per-channel consent save used to be a raw fetch with a
 * silent `.catch(() => {})` — a trust defect: staff believed preferences saved when
 * they had not, and Phase-2 reminders act on this consent. This module persists the
 * consent via the SDK and SURFACES failures (error toast + Retry), instead of
 * swallowing them. Registration itself has already succeeded by the time this runs,
 * so a failure here is non-fatal to the patient record — but it must be visible.
 */
import { toast } from 'sonner';
import { updatePatientCommunicationConsent } from '@monobase/sdk-ts/generated';
import { getErrorMessage } from '@/lib/error-toast';

export interface CommunicationConsent {
  sms: boolean;
  email: boolean;
  phone: boolean;
  marketing: boolean;
}

/**
 * Persist a patient's per-channel communication consent. Throws the SDK error on a
 * non-2xx so callers can surface it (never swallows the failure).
 */
export async function saveCommunicationConsent(
  patientId: string,
  consent: CommunicationConsent,
): Promise<void> {
  const result = await updatePatientCommunicationConsent({
    path: { patientId },
    body: consent,
  });
  if (result.error || !result.response?.ok) {
    throw (
      result.error ??
      new Error(`Failed to save communication preferences (${result.response?.status ?? 0})`)
    );
  }
}

/**
 * FIX-003: persist communication consent and surface any failure as an error toast
 * with a Retry action — instead of the prior silent catch. Quiet on the initial
 * success (the expected path); a retry that succeeds confirms with a success toast.
 * Never throws: registration has already committed, so the caller's flow continues.
 */
export async function persistCommunicationConsentWithRetry(
  patientId: string,
  consent: CommunicationConsent,
  isRetry = false,
): Promise<void> {
  try {
    await saveCommunicationConsent(patientId, consent);
    if (isRetry) toast.success('Communication preferences saved.');
  } catch (err) {
    toast.error(
      getErrorMessage(err, 'Patient saved, but their communication preferences could not be saved.'),
      {
        action: {
          label: 'Retry',
          onClick: () => {
            void persistCommunicationConsentWithRetry(patientId, consent, true);
          },
        },
      },
    );
  }
}
