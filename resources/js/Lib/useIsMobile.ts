import { useEffect, useState } from 'react';

/**
 * Mobile breakpoint mirror (matches Tailwind's `max-sm`) for picking the
 * sheet-bottom vs dialog-center container.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}
