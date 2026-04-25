import { useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { getPrimaryRole } from '@/shared/constants/roles';
import { getGuide, matchRouteKey } from '@/features/guides';

export function useGuideForRoute() {
  const location = useLocation();
  const user = useAppSelector((s) => s.auth.user);
  const routeKey = matchRouteKey(location.pathname);
  const role = getPrimaryRole(user?.roles ?? []);
  const guide = getGuide(routeKey, role);
  return { guide, routeKey, role };
}
