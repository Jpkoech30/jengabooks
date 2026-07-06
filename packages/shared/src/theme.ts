export const THEME = {
  primary: {
    50: '#E6F0EA',
    100: '#CCE1D5',
    200: '#99C3AB',
    300: '#66A581',
    400: '#338757',
    500: '#0A5C36',  // Acacia Green - Primary
    600: '#084A2B',
    700: '#064523',
    800: '#04301A',
    900: '#032E17',
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
  semantic: {
    success: '#0A7D3C',
    warning: '#D97706',
    error: '#BB1E10',  // Kenyan Red
    info: '#3B82F6',
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
