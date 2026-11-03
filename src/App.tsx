import { useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { MemoryEditorHost } from './components/MemoryEditor';
import { useMediaQuery, useSettings } from './hooks/data';
import { FrameScreen } from './screens/FrameScreen';
import { MoreScreen } from './screens/MoreScreen';
import { PeopleScreen } from './screens/PeopleScreen';
import { PersonScreen } from './screens/PersonScreen';
import { ReflectScreen } from './screens/ReflectScreen';
import { TodayScreen } from './screens/TodayScreen';
import { MemoryScreen } from './screens/MemoryScreen';
import { Onboarding } from './screens/Onboarding';
import { SettingsScreen } from './screens/SettingsScreen';
import { TimelineScreen } from './screens/TimelineScreen';
import { UnplacedScreen } from './screens/UnplacedScreen';
import { AppProvider } from './state/app';
import { PeopleProvider } from './state/people';

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

/** Open on Today once per launch; after that, the app goes where you go. */
function LaunchToToday() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem('lantern.today') === '1';
      sessionStorage.setItem('lantern.today', '1');
    } catch {
      /* storage unavailable: just don't redirect */
      seen = true;
    }
    if (!seen && pathname === '/') navigate('/today', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
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
      <PeopleProvider>
      <HashRouter>
        <ScrollToTop />
        {!settings.onboarded ? (
          <Onboarding />
        ) : (
          <AppShell>
            <LaunchToToday />
            <Routes>
              <Route path="/today" element={<TodayScreen />} />
              <Route path="/" element={<TimelineScreen />} />
              <Route path="/reflect" element={<ReflectScreen />} />
              <Route path="/people" element={<PeopleScreen />} />
              <Route path="/people/:id" element={<PersonScreen />} />
              <Route path="/more" element={<MoreScreen />} />
              <Route path="/unplaced" element={<UnplacedScreen />} />
              <Route path="/frame" element={<FrameScreen />} />
              <Route path="/chapters" element={<FrameScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/memory/:id" element={<MemoryScreen />} />
              <Route path="*" element={<TimelineScreen />} />
            </Routes>
            <MemoryEditorHost />
          </AppShell>
        )}
      </HashRouter>
      </PeopleProvider>
    </AppProvider>
  );
}
