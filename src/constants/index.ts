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
  edgeDetectColor: string;
  tabBar: string;
  header: string;
  headerText: string;
  card: string;
}

/**
 * THEME SYSTEM
 * -------------
 * "default" matches the app logo (teal/emerald shield) - this is now the
 * primary brand theme used everywhere (splash, icon background, dashboard).
 * "dark" is the dark-mode counterpart of the default teal theme.
 * Additional accent themes (blue, green, purple, red) let users personalize
 * while keeping the same UI structure.
 *
 * NOTE: "system" is handled in useTheme.tsx by resolving to 'light' or 'dark'
 * based on the device's color scheme - it is not a key in this Themes map.
 */
export const Themes: Record<ThemeType, ThemeColors> = {
  // DEFAULT - matches the app logo (teal shield on dark teal background)
  light: {
    primary: '#0D7377', primaryLight: '#5DD5D9', primaryDark: '#0A4D50',
    secondary: '#7FBA8C', success: '#10B981', warning: '#F59E0B', error: '#EF4444',
    background: '#F4FBFA', surface: '#FFFFFF', surfaceSecondary: '#E6F4F3',
    border: '#CFEDEA', text: '#0A2E32', textSecondary: '#3F6F73', textTertiary: '#8FB9BB',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.5)',
    scanOverlay: 'rgba(0,0,0,0.6)', cornerColor: '#39E6CC', edgeDetectColor: '#39E6CC',
    tabBar: '#FFFFFF', header: '#0D7377', headerText: '#FFFFFF', card: '#FFFFFF',
  },
  // DARK - same teal accent, dark surfaces
  dark: {
    primary: '#39E6CC', primaryLight: '#7FF5E3', primaryDark: '#0D7377',
    secondary: '#7FBA8C', success: '#34D399', warning: '#FBBF24', error: '#F87171',
    background: '#0A1F22', surface: '#102E31', surfaceSecondary: '#1B3F43',
    border: '#2B5256', text: '#E7FBF9', textSecondary: '#9FD4D1', textTertiary: '#5E8C8E',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.7)',
    scanOverlay: 'rgba(0,0,0,0.7)', cornerColor: '#39E6CC', edgeDetectColor: '#39E6CC',
    tabBar: '#102E31', header: '#102E31', headerText: '#E7FBF9', card: '#102E31',
  },
  // BLUE accent theme
  blue: {
    primary: '#0284C7', primaryLight: '#38BDF8', primaryDark: '#0369A1',
    secondary: '#6366F1', success: '#10B981', warning: '#F59E0B', error: '#EF4444',
    background: '#F0F9FF', surface: '#FFFFFF', surfaceSecondary: '#E0F2FE',
    border: '#BAE6FD', text: '#0C4A6E', textSecondary: '#0369A1', textTertiary: '#7DD3FC',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.5)',
    scanOverlay: 'rgba(0,0,0,0.6)', cornerColor: '#38BDF8', edgeDetectColor: '#38BDF8',
    tabBar: '#FFFFFF', header: '#0284C7', headerText: '#FFFFFF', card: '#FFFFFF',
  },
  // GREEN accent theme
  green: {
    primary: '#059669', primaryLight: '#34D399', primaryDark: '#047857',
    secondary: '#0891B2', success: '#10B981', warning: '#F59E0B', error: '#EF4444',
    background: '#F0FDF4', surface: '#FFFFFF', surfaceSecondary: '#DCFCE7',
    border: '#BBF7D0', text: '#14532D', textSecondary: '#166534', textTertiary: '#86EFAC',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.5)',
    scanOverlay: 'rgba(0,0,0,0.6)', cornerColor: '#34D399', edgeDetectColor: '#34D399',
    tabBar: '#FFFFFF', header: '#059669', headerText: '#FFFFFF', card: '#FFFFFF',
  },
  // PURPLE accent theme
  purple: {
    primary: '#9333EA', primaryLight: '#C084FC', primaryDark: '#7E22CE',
    secondary: '#EC4899', success: '#10B981', warning: '#F59E0B', error: '#EF4444',
    background: '#FAF5FF', surface: '#FFFFFF', surfaceSecondary: '#F3E8FF',
    border: '#E9D5FF', text: '#3B0764', textSecondary: '#6B21A8', textTertiary: '#D8B4FE',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.5)',
    scanOverlay: 'rgba(0,0,0,0.6)', cornerColor: '#C084FC', edgeDetectColor: '#C084FC',
    tabBar: '#FFFFFF', header: '#9333EA', headerText: '#FFFFFF', card: '#FFFFFF',
  },
  // RED accent theme (replaces orange)
  red: {
    primary: '#DC2626', primaryLight: '#F87171', primaryDark: '#991B1B',
    secondary: '#EA580C', success: '#10B981', warning: '#F59E0B', error: '#B91C1C',
    background: '#FEF2F2', surface: '#FFFFFF', surfaceSecondary: '#FEE2E2',
    border: '#FECACA', text: '#450A0A', textSecondary: '#991B1B', textTertiary: '#FCA5A5',
    white: '#FFFFFF', black: '#000000', overlay: 'rgba(0,0,0,0.5)',
    scanOverlay: 'rgba(0,0,0,0.6)', cornerColor: '#F87171', edgeDetectColor: '#F87171',
    tabBar: '#FFFFFF', header: '#DC2626', headerText: '#FFFFFF', card: '#FFFFFF',
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
  { id: 'scans', name: 'Scans', icon: 'scan-outline', color: '#0D7377' },
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
