// Pattern reference for smart-hint resolver components. Not auto-registered.
import { useAppSelector } from '@/store/hooks';
import { SmartHintRenderer } from '../../components/SmartHintRenderer';

export function ExampleApplicantDashboardHint() {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return null;
  return SmartHintRenderer({
    hint: {
      id: 'example-applicant-welcome',
      messageKey: 'guide.smart_next_step_empty',
      severity: 'info',
    },
  });
}

export function ExampleAdminDashboardHint() {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return null;
  return null;
}
