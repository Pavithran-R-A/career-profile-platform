import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return pathname;
}

export default function App() {
  const pathname = usePathname();

  let page;
  switch (pathname) {
    case '/':
      page = <Home />;
      break;
    default:
      page = <NotFound />;
  }

  return <Layout>{page}</Layout>;
}
