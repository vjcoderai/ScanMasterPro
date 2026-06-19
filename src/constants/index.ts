export const Colors = {
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  secondary: '#06B6D4',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
  scanOverlay: 'rgba(0,0,0,0.6)',
  cornerColor: '#4F46E5',
  dark: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceSecondary: '#334155',
    border: '#475569',
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

export const AspectRatios = [
  { label: 'Free', value: 'free', width: 0, height: 0 },
  { label: 'A4', value: 'a4', width: 210, height: 297 },
  { label: 'Letter', value: 'letter', width: 216, height: 279 },
  { label: '1:1', value: '1:1', width: 1, height: 1 },
  { label: '4:3', value: '4:3', width: 4, height: 3 },
  { label: '16:9', value: '16:9', width: 16, height: 9 },
  { label: '3:2', value: '3:2', width: 3, height: 2 },
  { label: 'ID Card', value: 'id', width: 85, height: 54 },
];

export const DOCUMENTS_STORAGE_KEY = '@scanmaster_documents';
export const SETTINGS_STORAGE_KEY = '@scanmaster_settings';
export const SCANS_DIRECTORY = 'scans';
export const EXPORTS_DIRECTORY = 'exports';
