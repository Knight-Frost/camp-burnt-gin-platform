import { useState, useEffect } from 'react';
import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import { getUsers } from '@/features/admin/api/admin.api';
import type { User } from '@/features/admin/types/admin.types';
import type { SmartHint } from '@/features/guides';

registerGuide({
  id: 'superAdmin.userManagement',
  role: 'super_admin',
  routeKeys: ['SUPER_ADMIN_USERS'],
  titleKey: 'guide.superAdmin.userManagement.title',
  summaryKey: 'guide.superAdmin.userManagement.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.superAdmin.user-management',
    titleKey: 'guide.superAdmin.userManagement.walkthrough.title',
    steps: [
      { id: 'create-button', anchorId: 'super-admin-users.create-button', titleKey: 'guide.superAdmin.userManagement.walkthrough.steps.create-button.title', bodyKey: 'guide.superAdmin.userManagement.walkthrough.steps.create-button.body', position: 'bottom' },
      { id: 'filter-bar',    anchorId: 'super-admin-users.filter-bar',    titleKey: 'guide.superAdmin.userManagement.walkthrough.steps.filter-bar.title',    bodyKey: 'guide.superAdmin.userManagement.walkthrough.steps.filter-bar.body',    position: 'bottom' },
      { id: 'user-table',    anchorId: 'super-admin-users.user-table',    titleKey: 'guide.superAdmin.userManagement.walkthrough.steps.user-table.title',    bodyKey: 'guide.superAdmin.userManagement.walkthrough.steps.user-table.body',    position: 'top' },
    ],
  },
  steps: [
    {
      id: 'user_list',
      titleKey: 'guide.superAdmin.userManagement.steps.user_list.title',
      summaryKey: 'guide.superAdmin.userManagement.steps.user_list.summary',
      detailsKey: 'guide.superAdmin.userManagement.steps.user_list.details',
    },
    {
      id: 'role_dropdown',
      titleKey: 'guide.superAdmin.userManagement.steps.role_dropdown.title',
      summaryKey: 'guide.superAdmin.userManagement.steps.role_dropdown.summary',
      detailsKey: 'guide.superAdmin.userManagement.steps.role_dropdown.details',
      severity: 'warning',
    },
    {
      id: 'deactivate',
      titleKey: 'guide.superAdmin.userManagement.steps.deactivate.title',
      summaryKey: 'guide.superAdmin.userManagement.steps.deactivate.summary',
      detailsKey: 'guide.superAdmin.userManagement.steps.deactivate.details',
    },
    {
      id: 'create_account',
      titleKey: 'guide.superAdmin.userManagement.steps.create_account.title',
      summaryKey: 'guide.superAdmin.userManagement.steps.create_account.summary',
      detailsKey: 'guide.superAdmin.userManagement.steps.create_account.details',
    },
    {
      id: 'cant_modify_self',
      titleKey: 'guide.superAdmin.userManagement.steps.cant_modify_self.title',
      summaryKey: 'guide.superAdmin.userManagement.steps.cant_modify_self.summary',
      detailsKey: 'guide.superAdmin.userManagement.steps.cant_modify_self.details',
    },
  ],
  faq: [
    {
      id: 'admin_vs_super',
      questionKey: 'guide.superAdmin.userManagement.faq.admin_vs_super.question',
      answerKey: 'guide.superAdmin.userManagement.faq.admin_vs_super.answer',
    },
    {
      id: 'deactivate_reversible',
      questionKey: 'guide.superAdmin.userManagement.faq.deactivate_reversible.question',
      answerKey: 'guide.superAdmin.userManagement.faq.deactivate_reversible.answer',
    },
  ],
});

export function SuperAdminUsersHint() {
  const [hint, setHint] = useState<SmartHint | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUsers({ page: 1, include_inactive: true })
      .then((response) => {
        if (cancelled) return;
        const allUsers: User[] = response.data ?? [];
        const inactiveCount = allUsers.filter((u) => !u.is_active).length;
        if (inactiveCount > 0) {
          setHint({
            id: 'super-admin-users-inactive',
            messageKey: 'guide.superAdmin.userManagement.hint.inactive_accounts.message',
            messageVars: { count: inactiveCount },
            severity: 'info',
            cta: { labelKey: 'guide.superAdmin.userManagement.hint.inactive_accounts.cta' },
          });
        } else {
          setHint(null);
        }
      })
      .catch(() => {
        if (!cancelled) setHint(null);
      });
    return () => { cancelled = true; };
  }, []);

  if (!hint) return null;
  return <SmartHintRenderer hint={hint} />;
}

registerSmartHintResolver('SUPER_ADMIN_USERS', SuperAdminUsersHint);
