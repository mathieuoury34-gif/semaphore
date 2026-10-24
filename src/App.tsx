import { useEffect } from 'react';
import { hideSplash } from './splash';
import { HOME, navigate, useRoute } from './ui/router';
import { TabBar, ToastHost } from './ui/kit';
import { BriefScreen } from './screens/Brief';
import { SectorScreen, SectorsScreen } from './screens/Sectors';
import { FavoritesScreen } from './screens/Favorites';
import { SettingsScreen } from './screens/Settings';
import { StorySheet } from './screens/StorySheet';
import { useFeed } from './data/feed';
import { useLang } from './i18n';

function Screen() {
  const route = useRoute();
  const [a, b] = route.parts;
  switch (a) {
    case 'secteurs': return b ? <SectorScreen key={b} id={b} /> : <SectorsScreen />;
    case 'favoris': return <FavoritesScreen />;
    case 'reglages': return <SettingsScreen />;
    default: return <BriefScreen />;
  }
}

export function App() {
  const route = useRoute();
  const f = useFeed();
  const sheet = route.query.get('sheet');
  const lang = useLang();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  useEffect(() => {
    if (!['une', 'secteurs', 'favoris', 'reglages'].includes(route.parts[0])) navigate(HOME, { replace: true });
  }, [route.parts]);
  useEffect(() => { if (f.phase !== 'loading') hideSplash(); }, [f.phase]);

  return (
    <>
      <div className="app-main"><Screen /></div>
      <TabBar />
      {sheet?.startsWith('story:') && <StorySheet id={sheet.slice(6)} />}
      <ToastHost />
    </>
  );
}
