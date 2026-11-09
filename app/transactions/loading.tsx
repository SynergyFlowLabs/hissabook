import AppLoading from '@/components/app-loading';

// Route-level fallback: shown the moment a navigation to this screen starts,
// before its JavaScript has run, so a slow first paint shows the app's shape
// instead of a white screen. The screen's own skeleton takes over on mount.
export default function Loading() {
  return <AppLoading />;
}
