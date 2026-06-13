import { ThemeType } from '../types';

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  white: string;
  black: string;
  overlay: string;
  scanOverlay: string;
  cornerColor: string;
  tabBar: string;
  header: string;
  headerText: string;
  card: string;
}

export const Themes: Record<ThemeType, ThemeColors> = {
  light: {
    primary: '#4F46E5', primaryLight: '#818CF8', primaryDark: '#3730A3',
    secondary: '#06B6D4', success: '#10B981', warning: '#F59E0B', error: '#EF4444',
    background: '#F8FAFC', surface: '#FFFFFF', surfaceSecondary: '#F1F5F9',
    border: '#E2E8F0', text: '#0F172A', textSecondary: '#64748B', textTertiary: '#94A3B8',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.5)',
    scanOverlay: 'rgba(0,0,0,0.6)', cornerColor: '#4F46E5',
    tabBar: '#FFFFFF', header: '#4F46E5', headerText: '#FFFFFF', card: '#FFFFFF',
  },
  dark: {
    primary: '#818CF8', primaryLight: '#A5B4FC', primaryDark: '#4F46E5',
    secondary: '#22D3EE', success: '#34D399', warning: '#FBBF24', error: '#F87171',
    background: '#0F172A', surface: '#1E293B', surfaceSecondary: '#334155',
    border: '#475569', text: '#F8FAFC', textSecondary: '#CBD5E1', textTertiary: '#94A3B8',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.7)',
    scanOverlay: 'rgba(0,0,0,0.7)', cornerColor: '#818CF8',
    tabBar: '#1E293B', header: '#1E293B', headerText: '#F8FAFC', card: '#1E293B',
  },
  blue: {
    primary: '#0284C7', primaryLight: '#38BDF8', primaryDark: '#0369A1',
    secondary: '#6366F1', success: '#10B981', warning: '#F59E0B', error: '#EF4444',
    background: '#F0F9FF', surface: '#FFFFFF', surfaceSecondary: '#E0F2FE',
    border: '#BAE6FD', text: '#0C4A6E', textSecondary: '#0369A1', textTertiary: '#7DD3FC',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.5)',
    scanOverlay: 'rgba(0,0,0,0.6)', cornerColor: '#0284C7',
    tabBar: '#FFFFFF', header: '#0284C7', headerText: '#FFFFFF', card: '#FFFFFF',
  },
  green: {
    primary: '#059669', primaryLight: '#34D399', primaryDark: '#047857',
    secondary: '#0891B2', success: '#10B981', warning: '#F59E0B', error: '#EF4444',
    background: '#F0FDF4', surface: '#FFFFFF', surfaceSecondary: '#DCFCE7',
    border: '#BBF7D0', text: '#14532D', textSecondary: '#166534', textTertiary: '#86EFAC',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.5)',
    scanOverlay: 'rgba(0,0,0,0.6)', cornerColor: '#059669',
    tabBar: '#FFFFFF', header: '#059669', headerText: '#FFFFFF', card: '#FFFFFF',
  },
  purple: {
    primary: '#9333EA', primaryLight: '#C084FC', primaryDark: '#7E22CE',
    secondary: '#EC4899', success: '#10B981', warning: '#F59E0B', error: '#EF4444',
    background: '#FAF5FF', surface: '#FFFFFF', surfaceSecondary: '#F3E8FF',
    border: '#E9D5FF', text: '#3B0764', textSecondary: '#6B21A8', textTertiary: '#D8B4FE',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.5)',
    scanOverlay: 'rgba(0,0,0,0.6)', cornerColor: '#9333EA',
    tabBar: '#FFFFFF', header: '#9333EA', headerText: '#FFFFFF', card: '#FFFFFF',
  },
  orange: {
    primary: '#EA580C', primaryLight: '#FB923C', primaryDark: '#C2410C',
    secondary: '#EAB308', success: '#10B981', warning: '#F59E0B', error: '#EF4444',
    background: '#FFF7ED', surface: '#FFFFFF', surfaceSecondary: '#FFEDD5',
    border: '#FED7AA', text: '#431407', textSecondary: '#9A3412', textTertiary: '#FDBA74',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.5)',
    scanOverlay: 'rgba(0,0,0,0.6)', cornerColor: '#EA580C',
    tabBar: '#FFFFFF', header: '#EA580C', headerText: '#FFFFFF', card: '#FFFFFF',
  },
};

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const BorderRadius = { sm: 6, md: 12, lg: 16, xl: 24, full: 9999 };
export const FontSize = { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 30 };

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

export const FOLDERS = [
  { id: 'scans', name: 'Scans', icon: 'scan-outline', color: '#4F46E5' },
  { id: 'merged', name: 'Merged', icon: 'git-merge-outline', color: '#059669' },
  { id: 'compressed', name: 'Compressed', icon: 'archive-outline', color: '#D97706' },
  { id: 'converted', name: 'Converted', icon: 'document-attach-outline', color: '#0891B2' },
  { id: 'custom', name: 'Other', icon: 'folder-outline', color: '#9333EA' },
];

export const DOCUMENTS_STORAGE_KEY = '@scanmaster_documents_v2';
export const SETTINGS_STORAGE_KEY = '@scanmaster_settings_v2';
export const SCANS_DIRECTORY = 'scans';
export const EXPORTS_DIRECTORY = 'exports';
export const MERGED_DIRECTORY = 'merged';
export const COMPRESSED_DIRECTORY = 'compressed';
