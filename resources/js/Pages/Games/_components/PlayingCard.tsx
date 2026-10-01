import React from 'react';
import { PIP_LAYOUTS, RANK_LABEL, SUIT_LABEL, isCourt, isRed, type Card } from '../_lib/cards';

export interface PlayingCardProps {
  card: Card;
  /** Force the back — an opponent's hand, or a card with no up/down state of its own. */
  faceDown?: boolean;
  /** True while a dragged card would legally land on this card. */
  dropTarget?: boolean;
  /** The card can be picked up: a grab cursor, and a real button for the keyboard. */
  interactive?: boolean;
  /** Draw a plain box instead of a button — a drag ghost, a decorative stack. */
  decorative?: boolean;
  /**
   * Draw every card as one big rank with its suit under it, the way a court
   * card reads, instead of the pip pattern — easier on a small screen.
   */
  large?: boolean;
  picked?: boolean;
  hinted?: boolean;
  /** Extra classes for a board-specific state (a legal-to-play glow, say). */
  className?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}

/**
 * One playing card, face or back. It carries no game rules: the caller decides
 * whether it is up (`card.faceUp`) or forced down (`faceDown`), whether it is
 * interactive, and what a tap does. Sized by the surrounding board, which sets
 * `--sz-card-w`.
 */
export default function PlayingCard({
  card,
  faceDown,
  dropTarget,
  interactive,
  decorative,
  large,
  picked,
  hinted,
  className: extra,
  onClick,
  onDoubleClick,
  onPointerDown,
}: PlayingCardProps) {
  if (faceDown || !card.faceUp) {
    return <div className="sz-card sz-card--back" aria-hidden="true" />;
  }

  const className = `sz-card sz-card--face ${isRed(card) ? 'sz-card--red' : 'sz-card--black'} ${
    interactive ? 'cursor-grab active:cursor-grabbing' : ''
  } ${picked ? 'sz-card--picked' : ''} ${hinted ? 'sz-card--hinted' : ''} ${
    dropTarget ? 'sz-card--drop' : ''
  } ${extra ?? ''}`;

  const body = (
    <>
      <span className="sz-card__corner">
        {RANK_LABEL[card.rank]}
        <span className="sz-card__corner-suit">{SUIT_LABEL[card.suit]}</span>
      </span>
      <CardFaceArt card={card} large={large} />
    </>
  );

  if (decorative) {
    return (
      <div className={className} aria-hidden="true">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={(e) => {
        // The card sits inside a clickable pile; without this the same tap
        // would be handled twice and cancel itself out.
        e.stopPropagation();
        onClick?.();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
      aria-pressed={picked}
      className={className}
    >
      {body}
    </button>
  );
}

/**
 * The body of a card: a traditional pip arrangement for the numbers, one large
 * pip for an ace, and the court letter with its suit for a jack, queen or king.
 */
function CardFaceArt({ card, large }: { card: Card; large?: boolean }) {
  const suit = SUIT_LABEL[card.suit];

  // The large face gives every card the court treatment — one big rank with its
  // suit under it — which reads far better on a small screen than pips.
  if (large) {
    return (
      <span className="sz-card__court">
        <span className="sz-card__court-letter">{RANK_LABEL[card.rank]}</span>
        <span className="sz-card__court-suit">{suit}</span>
      </span>
    );
  }

  if (card.rank === 1) {
    return <span className="sz-card__ace">{suit}</span>;
  }

  if (isCourt(card.rank)) {
    return (
      <span className="sz-card__court">
        <span className="sz-card__court-letter">{RANK_LABEL[card.rank]}</span>
        <span className="sz-card__court-suit">{suit}</span>
      </span>
    );
  }

  return (
    <span className="sz-card__pips">
      {PIP_LAYOUTS[card.rank].map((pip, i) => (
        <span
          key={i}
          className={`sz-card__pip ${pip.flip ? 'sz-card__pip--flip' : ''}`}
          style={{ left: `${pip.x}%`, top: `${pip.y}%` }}
        >
          {suit}
        </span>
      ))}
    </span>
  );
}
