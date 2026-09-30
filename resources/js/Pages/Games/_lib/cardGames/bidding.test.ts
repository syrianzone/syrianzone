import { describe, expect, it } from 'vitest';
import { createAuction, currentSeat, legalBids, passAuction, placeBid } from './bidding';

const auction = () => createAuction({ order: [0, 1, 2, 3], min: 7, max: 13 });

describe('createAuction', () => {
  it('opens on the first seat with the whole range available', () => {
    const a = auction();
    expect(currentSeat(a)).toBe(0);
    expect(legalBids(a)).toEqual([7, 8, 9, 10, 11, 12, 13]);
    expect(a.declarer).toBeNull();
  });

  it('rejects an impossible range or table', () => {
    expect(() => createAuction({ order: [0], min: 7, max: 13 })).toThrow();
    expect(() => createAuction({ order: [0, 1], min: 13, max: 7 })).toThrow();
  });
});

describe('bidding', () => {
  it('advances the turn and only offers higher bids', () => {
    const a = placeBid(auction(), 0, 8);
    expect(currentSeat(a)).toBe(1);
    expect(a.highBid).toBe(8);
    expect(legalBids(a)).toEqual([9, 10, 11, 12, 13]);
  });

  it('refuses a bid that does not beat the high bid', () => {
    const a = placeBid(auction(), 0, 9);
    expect(() => placeBid(a, 1, 9)).toThrow();
    expect(() => placeBid(a, 1, 3)).toThrow();
  });

  it('refuses a bid out of turn', () => {
    expect(() => placeBid(auction(), 2, 8)).toThrow();
  });
});

describe('settling', () => {
  it('gives the contract to the last bidder once everyone else passes', () => {
    let a = auction();
    a = placeBid(a, 0, 7);
    a = passAuction(a, 1);
    a = passAuction(a, 2);
    expect(a.complete).toBe(false);
    a = passAuction(a, 3);
    expect(a.complete).toBe(true);
    expect(a.declarer).toBe(0);
    expect(a.highBid).toBe(7);
  });

  it('lets the highest of several bids win', () => {
    let a = auction();
    a = placeBid(a, 0, 7);
    a = placeBid(a, 1, 9);
    a = passAuction(a, 2);
    a = passAuction(a, 3);
    a = passAuction(a, 0);
    expect(a.complete).toBe(true);
    expect(a.declarer).toBe(1);
  });

  it('has no declarer when everyone passes', () => {
    let a = auction();
    a = passAuction(a, 0);
    a = passAuction(a, 1);
    a = passAuction(a, 2);
    a = passAuction(a, 3);
    expect(a.complete).toBe(true);
    expect(a.declarer).toBeNull();
  });

  it('refuses a pass from the high bidder, and any action once over', () => {
    const a = placeBid(auction(), 0, 7);
    const settled = (() => {
      let s = passAuction(a, 1);
      s = passAuction(s, 2);
      s = passAuction(s, 3);
      return s;
    })();
    expect(settled.complete).toBe(true);
    expect(() => passAuction(settled, 0)).toThrow();
    expect(() => placeBid(settled, 0, 8)).toThrow();
  });
});
