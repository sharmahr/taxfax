import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/Button';

/**
 * The page runs to eleven screens on a handset, and between the hero and the
 * close there is nothing to press. This is the perforated stub at the foot of
 * a payment voucher: it appears once the hero has gone, carries the fee range
 * so the reader never has to scroll back for it, and stands down again when
 * the closing offer is on screen and can speak for itself. Fixed, so it costs
 * the layout nothing. Phones only — on desktop the masthead is one flick away.
 */
export function MobileAction() {
  const [past, setPast] = useState(false);
  const [atClose, setAtClose] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('top');
    const close = document.getElementById('start');
    if (!hero || !close) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) setPast(!e.isIntersecting);
        else setAtClose(e.isIntersecting);
      }
    });
    io.observe(hero);
    io.observe(close);
    return () => io.disconnect();
  }, []);

  if (!past || atClose) return null;

  return (
    <div className="mk-dock fixed inset-x-0 bottom-0 z-40 border-t border-dashed border-ink/25 bg-paper md:hidden">
      <div className="flex items-center gap-4 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <p className="min-w-0 flex-1 text-[0.75rem] leading-[1.4] text-ink-muted">
          <span className="ticket text-ink">$249&ndash;899</span> a month.
          <span className="block">Stop paying for it in May.</span>
        </p>
        <Button asChild variant="primary" className="h-11 shrink-0 px-5 text-[0.875rem]">
          <Link to="/signup">Start a season</Link>
        </Button>
      </div>
    </div>
  );
}
