import type { admin as es } from '../es/admin';

export const admin = {
  statuses: {
    pending: 'Pending',
    active: 'Active',
    suspended: 'Suspended',
  },
  roles: {
    user: 'User',
    admin: 'Admin',
  },
  tabs: {
    pending: 'Pending',
    allUsers: 'All users',
    usage: 'Usage',
  },
  toasts: {
    statusChanged: '{{name}}: account {{status}}',
    statusError: 'Could not change the status',
    roleChangedAdmin: '{{name}} is now an admin',
    roleChangedUser: '{{name}} is now a user',
    roleError: 'Could not change the role',
  },
  pending: {
    emptyTitle: 'No pending requests',
    emptyBody: 'When someone signs in with Google they will show up here.',
    since: 'since {{date}}',
    reject: 'Reject',
    approve: 'Approve',
  },
  table: {
    user: 'User',
    whatsapp: 'WhatsApp',
    status: 'Status',
    role: 'Role',
    joined: 'Joined',
    adminYou: 'Admin (you)',
    note: 'You cannot change your own role or status, and the last admin cannot be demoted — assign another admin first.',
  },
  usage: {
    kinds: {
      agent: 'Agent',
      title: 'Titles',
      transcription: 'Voice',
    },
    last7: 'Last 7 days',
    last30: 'Last 30 days',
    last90: 'Last 90 days',
    calls_one: 'call',
    calls_other: 'calls',
    estimatedCost: 'estimated cost',
    emptyTitle: 'No AI usage in this period',
    emptyBody: 'Every agent message, title and voice note will show up here with its cost.',
    table: {
      calls: 'Calls',
      tokensIn: 'Tokens in',
      tokensOut: 'Tokens out',
      breakdown: 'Breakdown',
      estCost: 'Est. cost',
    },
    note: 'ESTIMATED costs using local per-model prices (not the provider invoice). Models without a known price record tokens but cost $0.',
  },
} satisfies typeof es;
