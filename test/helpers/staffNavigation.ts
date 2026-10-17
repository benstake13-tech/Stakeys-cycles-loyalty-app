import { fireEvent, screen, within } from '@testing-library/react';

export function openStaffDrawer() {
  const dock = screen.queryByRole('navigation', { name: 'Staff dock' });
  if (dock) fireEvent.click(within(dock).getByRole('button', { name: 'More Apps' }));
  else fireEvent.click(within(screen.getByRole('navigation', { name: 'Staff phone navigation' })).getByRole('button', { name: 'Open staff apps' }));
  return screen.getByRole('dialog', { name: 'All apps' });
}
export function openStaffApp(label: string) {
  const drawer = openStaffDrawer();
  let app = within(drawer).queryByRole('button', { name: label });
  if (!app) {
    for (const folder of within(drawer).getAllByRole('button').filter(button => button.getAttribute('aria-expanded') === 'false')) {
      fireEvent.click(folder);
      app = within(drawer).queryByRole('button', { name: label });
      if (app) break;
    }
  }
  if (!app) throw new Error(`Staff app ${label} is missing from the drawer`);
  fireEvent.click(app);
}
