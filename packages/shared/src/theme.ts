export const THEME = {
  primary: {
    50: '#E6F0EA',
    100: '#CCE1D5',
    200: '#99C3AB',
    300: '#66A581',
    400: '#338757',
    500: '#0A5C36',  // Acacia Green - Primary
    600: '#084A2B',
    700: '#0A4D2E',
    800: '#04301A',
    900: '#0A3B1F',
  },
  secondary: {
    50: '#FEF5E0',
    100: '#FDEBB7',
    200: '#FBD78A',
    300: '#F9C35D',
    400: '#F5AF30',
    500: '#E8A317',  // Golden Savannah Amber - Secondary
    600: '#C98A0C',
    700: '#A87203',
    800: '#875900',
    900: '#664000',
  },
  accent: {
    red: {
      50: '#FEF2F2',
      100: '#FEE2E2',
      200: '#FECACA',
      300: '#FCA5A5',
      400: '#F87171',
      500: '#BB1E10',  // Kenyan Red
      600: '#991A0D',
      700: '#7A140A',
      800: '#5C0F08',
      900: '#3D0A05',
    },
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
  },
  semantic: {
    success: '#059669',  // Emerald-600
    warning: '#D97706',  // Amber-600
    error: '#BB1E10',    // Kenyan Red
    info: '#2563EB',     // Blue-600
  },
  surface: {
    light: '#FBF8F1',  // Warm off-white, reduces glare
    dark: '#1A1A1F',   // Deep charcoal
  },
  badge: {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
  },
} as const;

export type ThemeColor = keyof typeof THEME.primary;
export type SemanticColor = keyof typeof THEME.semantic;
