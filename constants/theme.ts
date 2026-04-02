// constants/theme.ts
import { Platform } from 'react-native';
import { CategoryKey, CATEGORY_LABELS } from '../types';

// ── テーマカラー ──
export const C = {
  bg: '#F0F4FA',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSub: '#475569',
  textMuted: '#94A3B8',
  accent: '#3B82F6',
  accentLight: '#60A5FA',
  accentSoft: '#EFF6FF',
  accentDark: '#1D4ED8',
  gradStart: '#3B82F6',
  gradEnd: '#8B5CF6',
  pink: '#F43F5E',
  pinkSoft: '#FFF1F2',
  purple: '#8B5CF6',
  purpleSoft: '#F5F3FF',
  gold: '#F59E0B',
  goldSoft: '#FFFBEB',
  blue: '#38BDF8',
  blueSoft: '#F0F9FF',
  orange: '#F97316',
  orangeSoft: '#FFF7ED',
  cyan: '#06B6D4',
  cyanSoft: '#ECFEFF',
  emerald: '#10B981',
  emeraldSoft: '#ECFDF5',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
};

export const CATEGORY_COLORS: Record<CategoryKey, string> = {
  brightening: C.pink,
  moisturizing: C.blue,
  anti_inflammatory: C.cyan,
  antioxidant: C.gold,
  exfoliating: C.orange,
  anti_aging: C.purple,
  oil_based: C.emerald,
  uv_filter: C.amber,
};

export const CATEGORY_BG: Record<CategoryKey, string> = {
  brightening: C.pinkSoft,
  moisturizing: C.blueSoft,
  anti_inflammatory: C.cyanSoft,
  antioxidant: C.goldSoft,
  exfoliating: C.orangeSoft,
  anti_aging: C.purpleSoft,
  oil_based: C.emeraldSoft,
  uv_filter: C.amberSoft,
};

export const CATEGORY_ICONS: Record<CategoryKey, string> = {
  brightening: '✨',
  moisturizing: '💧',
  anti_inflammatory: '🛡',
  antioxidant: '🍇',
  exfoliating: '🧴',
  anti_aging: '⏳',
  oil_based: '🫧',
  uv_filter: '☀️',
};

// ── iOS向けシャドウ ──
export const shadow = (opacity = 0.08, radius = 12, offsetY = 4) =>
  Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: { elevation: Math.round(radius / 2) },
    default: {},
  }) as Record<string, unknown>;

// ── 制限 ──
export const FREE_DAILY_SCAN_LIMIT = 5;
export const FREE_SHELF_LIMIT = 5;
export const INTERSTITIAL_SCAN_INTERVAL = 2;
export const INTERSTITIAL_DETAIL_INTERVAL = 5;

// ── AsyncStorage キー ──
export const STORAGE_KEY = '@clearlab_shelf';
export const SCAN_COUNT_KEY = '@clearlab_scan_count';
export const LIFETIME_SCAN_KEY = '@clearlab_lifetime_scans';
export const REVIEW_REQUESTED_KEY = '@clearlab_review_requested';
export const REVIEW_TRIGGER_COUNT = 3;
