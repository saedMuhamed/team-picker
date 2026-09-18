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
  username: 'Username',
  usernameHint: 'Captains: your username. Admin: your email address.',
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

  // Final teams
  final: 'Final',
  finalTeam: 'Final team',
  draft: 'Draft',
  finalize: 'Finalize team',
  unfinalize: 'Reopen for editing',
  finalizedOn: (date: string) => `Finalized ${date}`,
  finalizeTitle: 'Finalize this team?',
  finalizeBody: (name: string, count: number) =>
    `${name} will be locked with ${count} player${count === 1 ? '' : 's'}. ` +
    'Nobody can add, edit, remove or reorder them until you reopen it, and ' +
    'the sheet becomes available to print.',
  unfinalizeTitle: 'Reopen this team?',
  unfinalizeBody: (name: string) =>
    `${name} goes back to draft. The roster can be changed again, and the ` +
    'sheet cannot be printed until you finalize it once more.',
  lockedHint: 'This team is final. Reopen it to make changes.',
  pdfNeedsFinal: 'Finalize the team to print its sheet',
  noFinalTeams: 'No teams are finalized yet.',

  // Waiting list
  waitingList: 'Waiting list',
  waitingSubtitle:
    'Players not yet picked for a team. Assign one to a team when you pick it.',
  waitingEmpty: 'Nobody is waiting. Add the first player below.',
  addToWaiting: 'Add to waiting list',
  level: 'Level',
  payment: 'Payment',
  amount: 'Amount',
  assignTo: 'Assign to…',
  assignedOk: (name: string, team: string) => `${name} added to ${team}.`,
  removeWaitingTitle: 'Remove from waiting list?',
  removeWaitingBody: (name: string) =>
    `${name} will be removed from the waiting list. This does not affect any team.`,
  levelLabel: {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    pro: 'Pro',
  } as const,
  paymentLabel: {
    paid: 'Paid',
    pending: 'Pending',
    unpaid: 'Unpaid',
  } as const,

  // Custom columns
  columns: 'Columns',
  columnsSubtitle:
    'Extra columns, shared by every team and the waiting list. They appear on screen only — the printed sheet keeps its five paper columns.',
  addColumn: 'Add column',
  columnName: 'Column name',
  renameColumn: 'Rename',
  removeColumn: 'Remove',
  noColumns: 'No extra columns yet.',
  removeColumnTitle: 'Remove this column?',
  removeColumnBody: (label: string) =>
    `"${label}" disappears from every team and the waiting list, and the ` +
    'values already typed into it are deleted. This cannot be undone.',

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
