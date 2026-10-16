import { fireEvent, screen, within } from '@testing-library/react';

export function openStaffDrawer() {
  const dock = screen.queryByRole('navigation', { name: 'Staff dock' });
  if (dock) fireEvent.click(within(dock).getByRole('button', { name: 'More Apps' }));
  else fireEvent.click(within(screen.getByRole('navigation', { name: 'Staff phone navigation' })).getByRole('button', { name: 'Open staff apps' }));
  return screen.getByRole('dialog', { name: 'All apps' });
}
export function openStaffApp(label: string) {
  fireEvent.click(within(openStaffDrawer()).getByRole('button', { name: label }));
}
