export const colors = {
  // Brand
  primary: "#0D6847",
  primaryHover: "#095237",
  primarySoft: "#EAF3EE",
  primaryBorder: "#C5DDD0",
  mint: "#5CD6A5",
  mintSoft: "#E8FAF2",

  // Monochromes & Surfaces
  canvas: "#F6F5F2",
  card: "#FFFFFF",
  cardHover: "#FAFAF8",
  border: "#E2E0D8",
  borderSubtle: "#ECEAE4",
  borderStrong: "#C8C5BB",

  // Text Hierarchy
  text: "#0C0E0D",
  textSecondary: "#424845",
  textMuted: "#6B726E",
  textLight: "#8C928E",
  textInverse: "#FFFFFF",

  // Semantic Status
  urgent: "#C84B31",
  urgentSoft: "#FCEBE8",
  urgentBorder: "#F4BDB3",

  warning: "#D97706",
  warningSoft: "#FEF3C7",
  warningBorder: "#FDE68A",

  info: "#0284C7",
  infoSoft: "#E0F2FE",
  infoBorder: "#BAE6FD",

  success: "#0D6847",
  successSoft: "#EAF3EE",
};

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const shadows = {
  subtle: {
    shadowColor: "#0C0E0D",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: "#0C0E0D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  floating: {
    shadowColor: "#0C0E0D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const theme = {
  colors,
  spacing,
  radius,
  shadows,
};

export default theme;
