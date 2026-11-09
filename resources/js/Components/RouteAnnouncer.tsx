import { useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';

/**
 * Announces client-side (Inertia) navigations to screen readers and moves focus
 * to the main landmark, so a page change is perceivable without a full reload.
 *
 * On the first render it does nothing (the browser already announced the
 * initial document). A different pathname focuses #main-content and announces
 * the title. Query-only changes belong to the current page's live regions and
 * must not take focus away from a search field or filter control.
 */
export default function RouteAnnouncer() {
  const { url } = usePage();
  const pathname = url.split(/[?#]/)[0];
  const firstRender = useRef(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // let the page commit and the <Head> title update before announcing
    const timer = window.setTimeout(() => {
      setMessage(document.title);
      const main = document.getElementById('main-content');
      if (main) {
        main.focus({ preventScroll: true });
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <div role="status" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
