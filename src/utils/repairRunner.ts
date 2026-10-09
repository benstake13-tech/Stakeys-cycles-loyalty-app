/**
 * Executes a resolved RepairTarget's side effects from a single place so the
 * boot-time health banner and the Test Bench offer identical actions.
 *
 * The caller injects the environment-specific bits (clipboard, the push-repair
 * runner, navigation) so this stays framework-agnostic and easy to test.
 */
import type { RepairTarget } from './repairTargets';

export interface RepairRunnerDeps {
  /** Copy the Supabase repair SQL to the clipboard. */
  copySql?: (sql: string) => void;
  /** Run the in-app push-repair chain before opening the OneSignal dashboard. */
  runPushRepair?: () => Promise<void>;
  /** Navigate to the email/notification settings. */
  onEmail?: () => void;
  /** Opens an external URL (defaults to window.open). Injectable for tests. */
  openUrl?: (url: string) => void;
}

export async function executeRepairTarget(target: RepairTarget, deps: RepairRunnerDeps = {}): Promise<void> {
  const open = deps.openUrl ?? ((url: string) => window.open(url, '_blank', 'noopener'));

  if (target.service === 'supabase') {
    const sql = target.copySql?.();
    if (sql) deps.copySql?.(sql);
    if (target.openUrl) open(target.openUrl);
    return;
  }

  if (target.service === 'onesignal') {
    if (deps.runPushRepair) await deps.runPushRepair();
    if (target.openUrl) open(target.openUrl);
    return;
  }

  if (target.service === 'email') {
    deps.onEmail?.();
    return;
  }
  // service === 'none' — nothing to do.
}
