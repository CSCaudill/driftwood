import { useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { MemoryEditorHost } from './components/MemoryEditor';
import { useMediaQuery, useSettings } from './hooks/data';
import { ChaptersScreen } from './screens/ChaptersScreen';
import { MemoryScreen } from './screens/MemoryScreen';
import { Onboarding } from './screens/Onboarding';
import { SettingsScreen } from './screens/SettingsScreen';
import { TimelineScreen } from './screens/TimelineScreen';
import { UnplacedScreen } from './screens/UnplacedScreen';
import { AppProvider } from './state/app';

function useTheme() {
  const { theme, loaded } = useSettings();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  useEffect(() => {
    if (!loaded) return;
    const dark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute('content', dark ? '#121618' : '#F2F3EF'));
  }, [theme, prefersDark, loaded]);
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname !== '/') window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  useTheme();
  const settings = useSettings();
  if (!settings.loaded) return null;

  return (
    <AppProvider>
      <HashRouter>
        <ScrollToTop />
        {!settings.onboarded ? (
          <Onboarding />
        ) : (
          <AppShell>
            <Routes>
              <Route path="/" element={<TimelineScreen />} />
              <Route path="/unplaced" element={<UnplacedScreen />} />
              <Route path="/chapters" element={<ChaptersScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/memory/:id" element={<MemoryScreen />} />
              <Route path="*" element={<TimelineScreen />} />
            </Routes>
            <MemoryEditorHost />
          </AppShell>
        )}
      </HashRouter>
    </AppProvider>
  );
}
