import { useCallback, useEffect, useMemo, useState } from 'react';

/* ------------------------------ theme ------------------------------ */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('fxj.theme');
    if (saved) return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0b0f16' : '#f6f8fb');
    localStorage.setItem('fxj.theme', theme);
  }, [theme]);

  return [theme, useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])];
}

/* --------------------------- settings ------------------------------ */
export function useSetting(key, fallback) {
  const [value, setValue] = useState(() => {
    const raw = localStorage.getItem(`fxj.${key}`);
    return raw === null ? fallback : JSON.parse(raw);
  });
  useEffect(() => {
    localStorage.setItem(`fxj.${key}`, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

/* ------------------------------ toasts ----------------------------- */
let toastId = 0;
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, kind = 'info', ttl = 3200) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  }, []);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  return { toasts, push, dismiss };
}

/* --------------------------- hash routing -------------------------- */
export function useHashRoute(defaultRoute = 'dashboard') {
  const parse = () => {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const [name, param] = raw.split('/');
    return { name: name || defaultRoute, param: param || null };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) window.location.hash = `#/${defaultRoute}`;
    return () => window.removeEventListener('hashchange', onChange);
  }, [defaultRoute]);
  const navigate = useCallback((to) => {
    window.location.hash = `#/${to}`;
  }, []);
  return [route, navigate];
}

/* ---------------------------- media query -------------------------- */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/* ----------------------- debounced value --------------------------- */
export function useDebounced(value, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/* ------------------------- click outside --------------------------- */
export function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler(e);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export function useMemoizedFilter(trades, filters) {
  return useMemo(() => trades, [trades, filters]);
}
