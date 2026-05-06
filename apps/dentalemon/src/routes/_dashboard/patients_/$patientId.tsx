/**
 * Patient Profile Route — /patients/:patientId
 *
 * Standalone patient profile page under the dashboard layout.
 * Satisfies PROF-04: accessible from patient list and workspace.
 *
 * Wireframe: docs/prd/context/wireframes/patient-profile.html
 */
import { createFileRoute } from '@tanstack/react-router';
import { PatientProfilePage } from '@/features/patients/components/patient-profile-page';

export const Route = createFileRoute('/_dashboard/patients_/$patientId')({
  component: ProfilePage,
});

function ProfilePage() {
  const { patientId } = Route.useParams();
  return <PatientProfilePage patientId={patientId} />;
}
