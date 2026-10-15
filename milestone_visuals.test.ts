import { describe, it, expect } from 'vitest';
import { pedalPose, milestoneFrame, milestoneSvgDocument } from './src/utils/milestoneVisuals';

describe('notification motion geometry', () => {
  it('keeps both leg segments connected to the pedal for the whole revolution', () => {
    for (let i = 0; i < 72; i++) {
      const angle = i * Math.PI / 36;
      const {hip,knee,pedal} = pedalPose(angle, Math.sin(angle * 2) * 1.1);
      expect(Math.hypot(knee.x - hip.x, knee.y - hip.y)).toBeCloseTo(55, 7);
      expect(Math.hypot(pedal.x - knee.x, pedal.y - knee.y)).toBeCloseTo(56, 7);
      expect(Math.hypot(pedal.x - 220, pedal.y - 164)).toBeCloseTo(18, 7);
    }
  });
  it('shows the final outcome after the rider leaves and finishes all drawing', () => {
    const frame = milestoneFrame(2700);
    expect(frame.rideOpacity).toBe(0);
    expect(frame.resultOpacity).toBe(1);
    expect(frame.resultTransform).toBe('translate(240 122) scale(1) translate(-240 -122)');
    expect(frame.ringOffset).toBe(0);
    expect(frame.drawOffset).toBe(0);
    expect(frame.sparks.every(spark=>spark.opacity===0)).toBe(true);
  });
  it('renders every event without invalid SVG values or conflicting identifier characters', () => {
    for (const kind of ['booking','garage','listing','sale','reward','voucher','prize','welcome'] as const) {
      for (const time of [0,600,1330,1750,2200,2700]) {
        const svg = milestoneSvgDocument(kind,time,':react:test:');
        expect(svg).not.toMatch(/NaN|Infinity/);
        expect(svg).toContain('id="reacttest-ink"');
        expect(svg).toContain('viewBox="0 0 480 240"');
      }
    }
  });
});
