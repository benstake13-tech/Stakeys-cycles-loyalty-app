import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarketplaceAuction, auctionTimeLeft, minimumAuctionBid, type MarketplaceAuctionRow } from './MarketplaceAuction';

const base: MarketplaceAuctionRow = {
  listing_id:'bike-1', start_price:100, duration_hours:72, status:'live',
  starts_at:'2026-10-17T10:00:00Z', ends_at:'2026-10-20T10:00:00Z',
  highest_bid:null, bid_count:0, extension_count:0, winning_bid_id:null,
};
const now = new Date('2026-10-17T11:00:00Z').getTime();
const props = {
  auction:base, now, isSeller:false, isStaff:false, canBid:true,
  hasBid:false, isLeading:false, isWinner:false, busy:false,
  onBid:vi.fn(async()=>true),
};

describe('marketplace auction bids',()=>{
  it('directs public-site visitors to the app without offering website sign-in',()=>{
    const onUseApp=vi.fn();
    render(<MarketplaceAuction {...props} {...({publicBrowseOnly:true} as any)} canBid={false} onUseApp={onUseApp}/>);
    fireEvent.click(screen.getByRole('button',{name:'Use the customer app to bid'}));
    expect(onUseApp).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button',{name:'Sign in to bid'})).toBeNull();
  });
  it('uses the opening bid, then a 2% step rounded up to pounds',()=>{
    expect(minimumAuctionBid(base)).toBe(100);
    expect(minimumAuctionBid({...base,highest_bid:101,bid_count:1})).toBe(104);
    expect(auctionTimeLeft(base.ends_at,now)).toBe('2d 23h left');
    expect(auctionTimeLeft(base.ends_at,new Date(base.ends_at!).getTime())).toBe('Closing now');
  });
  it('accepts a bid at the minimum and shows the countdown',()=>{
    const onBid=vi.fn(async()=>true);
    render(<MarketplaceAuction {...props} onBid={onBid}/>);
    expect(screen.getByText('2d 23h left')).toBeTruthy();
    fireEvent.change(screen.getByRole('spinbutton',{name:'Your auction bid'}),{target:{value:'100'}});
    fireEvent.click(screen.getByRole('button',{name:'Place bid'}));
    expect(onBid).toHaveBeenCalledWith(100);
  });
  it('does not offer bidding to sellers or after the deadline',()=>{
    const {rerender}=render(<MarketplaceAuction {...props} isSeller/>);
    expect(screen.queryByRole('button',{name:'Place bid'})).toBeNull();
    rerender(<MarketplaceAuction {...props} now={new Date(base.ends_at!).getTime()}/>);
    expect(screen.queryByRole('button',{name:'Place bid'})).toBeNull();
    expect(screen.getByText('Closing now')).toBeTruthy();
  });
});
