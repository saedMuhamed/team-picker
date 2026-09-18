/**
 * Every user-facing string, in one place.
 * Somali where the paper sheets are Somali, English elsewhere.
 */
export const S = {
  // Sheet column headers — these are printed on the PDF and must not change.
  col: {
    no: 'No',
    name: 'Magaca',
    xaalada: 'Xaalada',
    joogtaynta: 'Joogtaynta',
    heerkaKubada: 'Heerka Kubada',
  },

  // Roles / labels
  team: 'Kooxda',
  captain: 'Kabtanka',
  captainShort: 'C',
  player: 'Player',
  players: 'Players',

  // Auth
  signIn: 'Sign in',
  signOut: 'Sign out',
  email: 'Email',
  password: 'Password',
  signingIn: 'Signing in…',
  loginTitle: 'Team Picker',
  loginSubtitle: 'Sign in to manage your team',

  // Dashboard
  dashboard: 'Teams',
  view: 'View',
  downloadPdf: 'Download PDF',
  downloadAll: 'Download all teams (PDF)',
  preparingPdf: 'Preparing PDF…',
  yourTeam: 'Your team',

  // Team view
  back: 'Back to teams',
  addCaptain: 'Add captain',
  addPlayer: 'Add player',
  rosterFull: 'Roster is full',
  viewOnly: 'View only',
  editing: 'Editing',
  saving: 'Saving…',
  saved: 'All changes saved',
  emptySlot: 'Empty slot',
  rosterSize: 'Roster slots',
  namePlaceholder: 'Player name',

  // Access
  access: 'Access',
  accessSubtitle: 'Decide which captains can edit their roster right now.',
  canEdit: 'Can edit',
  assignedTeam: 'Assigned team',
  noTeam: 'No team assigned',
  unassignedHint:
    'Assign this captain to a team so they can see and export their sheet.',

  // Dialogs
  confirm: 'Confirm',
  cancel: 'Cancel',
  deletePlayerTitle: 'Remove player?',
  deletePlayerBody: (name: string) =>
    `${name} will be removed from the roster and the players below will move up.`,
  deleteCaptainBody: (name: string, next: string) =>
    `${name} is the captain. Removing them makes ${next} the new captain.`,
  promoteTitle: 'Change captain?',
  promoteBody: (name: string) =>
    `Moving ${name} into position 1 makes them the captain of this team.`,

  // Misc
  loading: 'Loading…',
  notFound: 'Page not found',
  noAccess: 'You do not have access to this page.',
  retry: 'Retry',
} as const
