import './styles/base.css';
import './styles/display.css';
import { NOT_FOUND, PAGES, SITE_NAME } from './pages';
import { mountViewer } from './viewer';

type Route = 'home' | 'viewer' | 'editor' | 'docs' | 'notfound';
type Mounted = { update?(): void; destroy(): void };

const app = document.getElementById('app')!;
let route: Route | null = null;
let mounted: Mounted | null = null;
let generation = 0;

function currentRoute(): Route {
  const path = location.pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
  if (path === '/editor') return 'editor';
  if (path === '/docs') return 'docs';
  if (path !== '') return 'notfound';
  const hash = location.hash;
  return hash === '' || hash === '#' ? 'home' : 'viewer';
}

async function load(r: Route): Promise<Mounted> {
  switch (r) {
    case 'viewer':
      return mountViewer(app);
    case 'editor':
      return (await import('./editor/editor')).mountEditor(app);
    case 'docs':
      return (await import('./docs')).mountDocs(app);
    case 'notfound':
      return (await import('./notfound')).mountNotFound(app);
    default:
      return (await import('./home')).mountHome(app);
  }
}

async function render(): Promise<void> {
  const r = currentRoute();
  if (r === route) {
    // The viewer and the not-found page re-render in place when the fragment
    // changes; the editor and docs pages handle their own fragment changes.
    if (r === 'viewer' || r === 'notfound') mounted?.update?.();
    return;
  }
  const gen = ++generation;
  mounted?.destroy();
  mounted = null;
  route = r;
  // The viewer's title never includes the message.
  document.title = r === 'viewer' ? SITE_NAME : r === 'notfound' ? NOT_FOUND.title : PAGES[r].title;
  const m = await load(r);
  if (gen !== generation) {
    m.destroy();
    return;
  }
  mounted = m;
}

window.addEventListener('hashchange', () => void render());
window.addEventListener('popstate', () => void render());
void render();
