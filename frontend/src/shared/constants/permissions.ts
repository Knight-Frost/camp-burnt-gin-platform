export const PERMISSIONS = {
  // Camper permissions
  VIEW_ALL_CAMPERS: 'campers:view:all',
  VIEW_OWN_CAMPERS: 'campers:view:own',
  CREATE_CAMPER: 'campers:create',
  UPDATE_OWN_CAMPER: 'campers:update:own',
  DELETE_OWN_CAMPER: 'campers:delete:own',
  DELETE_ANY_CAMPER: 'campers:delete:any',

  // Application permissions
  VIEW_ALL_APPLICATIONS: 'applications:view:all',
  VIEW_OWN_APPLICATIONS: 'applications:view:own',
  CREATE_APPLICATION: 'applications:create',
  UPDATE_OWN_APPLICATION: 'applications:update:own',
  SIGN_APPLICATION: 'applications:sign',
  REVIEW_APPLICATION: 'applications:review',
  DELETE_APPLICATION: 'applications:delete',

  // Medical permissions
  VIEW_ALL_MEDICAL_RECORDS: 'medical:view:all',
  VIEW_OWN_MEDICAL_RECORDS: 'medical:view:own',
  UPDATE_MEDICAL_RECORD: 'medical:update',
  CREATE_MEDICAL_RECORD: 'medical:create',
  DELETE_MEDICAL_RECORD: 'medical:delete',

  // Document permissions
  UPLOAD_DOCUMENT: 'documents:upload',
  DOWNLOAD_DOCUMENT: 'documents:download',
  DELETE_DOCUMENT: 'documents:delete',

  // Admin permissions
  MANAGE_CAMPS: 'camps:manage',
  MANAGE_SESSIONS: 'sessions:manage',
  GENERATE_REPORTS: 'reports:generate',

  // Super Admin permissions
  MANAGE_USERS: 'users:manage',
  ASSIGN_ROLES: 'roles:assign',
  VIEW_AUDIT_LOGS: 'audit:view',
  MANAGE_SYSTEM_CONFIG: 'system:config',

  // Inbox permissions
  CREATE_CONVERSATION: 'inbox:create:conversation',
  SEND_MESSAGE: 'inbox:send:message',
  MODERATE_MESSAGES: 'inbox:moderate',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
