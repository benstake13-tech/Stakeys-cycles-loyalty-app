import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { send, check, phone } = vi.hoisted(() => ({ send: vi.fn(), check: vi.fn(), phone: vi.fn() }));
vi.mock('@capacitor/core', async importOriginal => ({ ...await importOriginal<any>(), Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } }));
vi.mock('./src/utils/pushNotifications', async importOriginal => ({ ...await importOriginal<any>(), getNativePushDeliveryDiagnostics: phone }));
vi.mock('./src/utils/nativePushTest', () => ({ sendNativeAndroidTestPush: send }));
vi.mock('./src/utils/pushRepair', async importOriginal => ({ ...await importOriginal<any>(), runPushRepair: check }));
vi.mock('./src/context/ShopContext', () => ({ useShop: () => ({ currentUser: { uid: 'staff', role: 'staff' }, ownerConfig: { ownerEmail: 'owner@example.test' }, checkServiceHealth: vi.fn(), refreshDatabaseState: vi.fn() }) }));
import { StaffDiagnosticsTab } from './src/components/StaffDiagnosticsTab';

beforeEach(() => { localStorage.clear(); send.mockReset(); check.mockResolvedValue([]); });
afterEach(cleanup);
it('dispatches only from the explicit native button and separates acceptance from receipt', async () => {
  send.mockResolvedValue({ messageId: 'msg-1', recipients: 2, appId: 'android-app' });
  render(<StaffDiagnosticsTab />);
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Check each step'));
  await waitFor(() => expect(check).toHaveBeenCalledOnce());
  expect(send).not.toHaveBeenCalled();
  await waitFor(() => expect((screen.getByTestId('test-native-android-push') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByTestId('test-native-android-push'));
  await screen.findByTestId('native-push-test-result');
  expect(send).toHaveBeenCalledOnce();
  expect(screen.getByText('Accepted by OneSignal. Check the tray on your signed-in Android phones; receipt is still pending.')).toBeTruthy();
  fireEvent.click(screen.getByText('I received it on an Android device'));
  expect(screen.getByText('Receipt confirmed by you on an Android device.')).toBeTruthy();
});

it('keeps a provider rejection visible beside the test result instead of relying on a toast', async () => {
  send.mockRejectedValue(new Error('All included players are not subscribed'));
  render(<StaffDiagnosticsTab />);
  fireEvent.click(screen.getByTestId('test-native-android-push'));
  const alert = await screen.findByTestId('native-push-test-error');
  expect(alert.textContent).toContain('All included players are not subscribed');
  expect(screen.queryByTestId('native-push-test-result')).toBeNull();
  expect(send).toHaveBeenCalledOnce();
});

it('checks native receipt and blocked channels without sending another notification', async () => {
  send.mockResolvedValue({ messageId: 'msg-1', recipients: 2, appId: 'android-app' });
  phone.mockResolvedValue({ notificationsEnabled: true, hasPushToken: true, interruptionFilter: 1,
    lastMessageId: 'msg-1', receivedAt: Date.now(), lastMessageInTray: false,
    channels: [{ id: 'push', name: 'Staff pushes', importance: 0 }] });
  render(<StaffDiagnosticsTab />);
  fireEvent.click(screen.getByTestId('test-native-android-push'));
  await screen.findByTestId('native-push-test-result');
  fireEvent.click(screen.getByText('Check Android receipt and channels'));
  const diagnostics = await screen.findByTestId('phone-push-diagnostics');
  expect(diagnostics.textContent).toContain('This test reached the Android OneSignal receiver.');
  expect(diagnostics.textContent).toContain('Channel Staff pushes: BLOCKED');
  expect(send).toHaveBeenCalledOnce();
  expect(phone).toHaveBeenCalledOnce();
});
