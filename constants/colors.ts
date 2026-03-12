const Colors = {
  bg: '#0B0E14',
  surface: '#131821',
  card: '#1A2030',
  elevated: '#232D40',
  border: '#2A3350',
  borderLight: '#354060',

  primary: '#10B981',
  primaryLight: '#34D399',
  primaryDark: '#059669',
  primaryBg: 'rgba(16, 185, 129, 0.12)',

  accent: '#F59E0B',
  accentBg: 'rgba(245, 158, 11, 0.12)',

  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',

  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.12)',

  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  cash: '#10B981',
  cardPay: '#3B82F6',
  mobile: '#8B5CF6',
  comp: '#F59E0B',

  statusDraft: '#64748B',
  statusLive: '#10B981',
  statusPaused: '#F59E0B',
  statusClosed: '#EF4444',

  statusDraftBg: 'rgba(100, 116, 139, 0.15)',
  statusLiveBg: 'rgba(16, 185, 129, 0.15)',
  statusPausedBg: 'rgba(245, 158, 11, 0.15)',
  statusClosedBg: 'rgba(239, 68, 68, 0.15)',
};

export default Colors;

export function getPaymentColor(method: string): string {
  switch (method) {
    case 'cash': return Colors.cash;
    case 'card': return Colors.cardPay;
    case 'mobile': return Colors.mobile;
    case 'comp': return Colors.comp;
    default: return Colors.textMuted;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'draft': return Colors.statusDraft;
    case 'live': return Colors.statusLive;
    case 'paused': return Colors.statusPaused;
    case 'closed': return Colors.statusClosed;
    default: return Colors.textMuted;
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case 'draft': return Colors.statusDraftBg;
    case 'live': return Colors.statusLiveBg;
    case 'paused': return Colors.statusPausedBg;
    case 'closed': return Colors.statusClosedBg;
    default: return 'rgba(100, 116, 139, 0.15)';
  }
}
