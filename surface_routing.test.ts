import { describe, expect, it } from 'vitest';
import { hostedSurfaceForBranch, isPublicWebsiteHost } from './src/config/surfaceRouting';
describe('production surface routing', () => {
 it('pins each production branch to its intended surface', () => {
  expect(hostedSurfaceForBranch('main-website')).toBe('website');
  expect(hostedSurfaceForBranch('customer-app')).toBe('customer');
  expect(hostedSurfaceForBranch('staff-terminal')).toBe('staff');
  expect(hostedSurfaceForBranch()).toBeUndefined();
  expect(hostedSurfaceForBranch('feature/test')).toBeUndefined();
 });
 it('keeps only the public marketing domain exempt from the browser login blanket', () => {
  expect(isPublicWebsiteHost('www.stakeys.co.uk')).toBe(true);
  expect(isPublicWebsiteHost('stakeys.co.uk')).toBe(true);
  expect(isPublicWebsiteHost('WWW.STAKEYS.CO.UK.')).toBe(true);
  for (const host of ['localhost','www.stakeys-cycles.co.uk','www.stakeyswheels.co.uk','stakeys.co.uk.evil.example','fake-stakeys.co.uk']) expect(isPublicWebsiteHost(host)).toBe(false);
 });
});
