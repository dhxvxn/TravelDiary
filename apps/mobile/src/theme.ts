import { useColorScheme } from 'react-native';

const light = {
  dark: false,
  bg: '#f6f4ef',
  surface: '#ffffff',
  surface2: '#f0ede6',
  text: '#1d1b18',
  muted: '#6b665d',
  border: '#e2ddd2',
  accent: '#2e6f5e',
  accentText: '#ffffff',
};

const dark: typeof light = {
  dark: true,
  bg: '#151614',
  surface: '#1f201d',
  surface2: '#292a26',
  text: '#ecebe6',
  muted: '#a19d93',
  border: '#353631',
  accent: '#6cc3a8',
  accentText: '#0f1a16',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
