import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./src/context/WebsiteContentStore', () => ({useWebsiteContent: () => ({products: [
  {id:'chain',name:'Workshop Chain',price:24.99,category:'Parts',stock:12,image:''},
  {id:'light',name:'Cycle Light',price:19.99,category:'Accessories',stock:0,image:''},
]})}));
import { StaffStockTab } from './src/components/staff/StaffStockTab';
beforeEach(cleanup);
describe('staff stock browser', () => {
  it('filters live products by search and category and shows actual stock', () => {
    render(<StaffStockTab onManage={() => {}} />);
    expect(screen.getByText('In stock: 12')).toBeTruthy();
    expect(screen.getByText('Out of stock')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', {name:'Search stock'}), {target:{value:'chain'}});
    expect(screen.getByText('Workshop Chain')).toBeTruthy();
    expect(screen.queryByText('Cycle Light')).toBeNull();
    fireEvent.change(screen.getByRole('searchbox'), {target:{value:''}});
    fireEvent.click(screen.getByRole('button', {name:/^Accessories$/}));
    expect(screen.getByText('Cycle Light')).toBeTruthy();
    expect(screen.queryByText('Workshop Chain')).toBeNull();
  });
  it('opens stock management from a product', () => {
    const onManage=vi.fn();render(<StaffStockTab onManage={onManage} />);
    fireEvent.click(screen.getByRole('button', {name:'Manage Workshop Chain'}));
    expect(onManage).toHaveBeenCalledOnce();
  });
});
