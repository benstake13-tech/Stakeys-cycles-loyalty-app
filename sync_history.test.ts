import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const dirs: string[] = [];
afterEach(() => { dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'stakeys-history-'));
  dirs.push(dir);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.com');
  writeFileSync(join(dir, 'source.txt'), 'same source'); git('add', '.'); git('commit', '-m', 'legacy staff');
  git('branch', '-M', 'staff-terminal');
  const baseline = git('rev-parse', 'HEAD');
  git('checkout', '-b', 'customer-app'); git('commit', '--allow-empty', '-m', 'legacy customer');
  const customerBaseline = git('rev-parse', 'HEAD');
  git('checkout', '-b', 'main-website'); git('commit', '--allow-empty', '-m', 'legacy website');
  const websiteBaseline = git('rev-parse', 'HEAD');
  mkdirSync(join(dir, 'scripts'));
  cpSync('scripts/check-history.sh', join(dir, 'scripts/check-history.sh'));
  writeFileSync(join(dir, 'scripts/sync-history-baseline.tsv'), `staff-terminal ${baseline}\ncustomer-app ${customerBaseline}\nmain-website ${websiteBaseline}\n`);
  const check = () => spawnSync('bash', ['scripts/check-history.sh'], { cwd: dir, encoding: 'utf8' });
  return { dir, git, check };
}
describe('synchronized branch history gate', () => {
  it('accepts matching new sequences after reviewed tree-identical baselines without rewriting legacy history', () => {
    const { git, check } = fixture();
    for (const branch of ['staff-terminal', 'customer-app', 'main-website']) {
      git('checkout', branch); git('commit', '--allow-empty', '-m', 'shared upgrade');
    }
    expect(check().status).toBe(0);
  });
  it('rejects a missing or duplicate new cherry-pick', () => {
    const { git, check } = fixture();
    git('checkout', 'staff-terminal'); git('commit', '--allow-empty', '-m', 'new feature');
    expect(check().status).toBe(1);
    expect(check().stdout).toContain('HISTORY DRIFT');
  });
  it('rejects baselines whose source trees differ', () => {
    const { dir, git, check } = fixture();
    writeFileSync(join(dir, 'source.txt'), 'different source'); git('add', 'source.txt'); git('commit', '-m', 'drift');
    const website = git('rev-parse', 'HEAD');
    const staff = git('rev-parse', 'staff-terminal');
    const customer = git('rev-parse', 'customer-app');
    writeFileSync(join(dir, 'scripts/sync-history-baseline.tsv'), `staff-terminal ${staff}\ncustomer-app ${customer}\nmain-website ${website}\n`);
    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('do not have matching source trees');
  });
});
