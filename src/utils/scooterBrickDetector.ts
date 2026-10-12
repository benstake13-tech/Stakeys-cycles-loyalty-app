/**
 * Read-only brick detector for the BLE diagnostic bench.
 *
 * A soft-brick is not a single flag you can read — it is a *signature* of the
 * things a controller cannot do. This module scores that signature from
 * observations the bench already collects (did the device advertise? did GATT
 * connect? did the status/version commands answer? is it reporting a
 * firmware-error code?) and returns a verdict plus the evidence behind it.
 *
 * It never writes to the device, and it always pairs a "soft-bricked" verdict
 * with the correct recovery — an ST-Link/wired flash, not another BLE attempt.
 */

export type BrickVerdict = 'healthy' | 'suspicious' | 'soft-bricked' | 'unresponsive';

export interface BrickEvidence {
  label: string;
  ok: boolean;
  detail: string;
}

export interface BrickReport {
  verdict: BrickVerdict;
  score: number;
  evidence: BrickEvidence[];
  /** What the tech should do next. */
  recommendation: string;
}

export interface BrickObservation {
  /** The device showed up in a BLE scan. */
  advertised: boolean;
  /** GATT connected successfully. */
  gattConnected: boolean;
  /** The status notification produced a parseable frame. */
  statusReadable: boolean;
  /** How many firmware versions came back (0..3). */
  versionsRead: number;
  /** Active fault code from the status frame, if any. */
  errorCode: number | null;
  /** Firmware version string the controller reported for the ESC, if any. */
  escVersion: string | null;
}

/** Fault codes that specifically indicate a half-written / corrupt firmware. */
export const FIRMWARE_FAULT_CODES: Record<number, string> = {
  10: 'Dashboard/controller comms lost (can follow a failed flash)',
  21: 'BMS comms fault',
  25: 'Communication failure during firmware update — controller may be half-flashed',
  26: 'Controller flash/memory write fault',
  27: 'ESC config invalid (CPUID mismatch — often after a board swap)',
  31: 'Controller program/firmware execution error',
  51: 'BLE firmware incompatible with controller (DRV) firmware',
};

/**
 * Score the observations into a verdict. Weighting: an unresponsive device
 * (advertises or connects, but answers nothing) is the strongest signal of a
 * brick; a device that answers but reports a firmware-error code is next.
 */
export function evaluateBrick(obs: BrickObservation): BrickReport {
  const firmwareFault = obs.errorCode !== null && FIRMWARE_FAULT_CODES[obs.errorCode] !== undefined;

  if (!obs.advertised) {
    return {
      verdict: 'unresponsive',
      score: 0,
      evidence: [
        { label: 'Device advertised', ok: false, detail: 'No BLE advertisement seen — the controller may have no power or a dead radio.' },
      ],
      recommendation:
        'Check power, battery and the switch first. If it still shows nothing, it is a wired job: open the deck and check the controller supply before assuming a firmware fault.',
    };
  }

  if (!obs.gattConnected) {
    return {
      verdict: 'soft-bricked',
      score: 1,
      evidence: [
        { label: 'Device advertised', ok: true, detail: 'Seen in the BLE scan.' },
        { label: 'GATT connected', ok: false, detail: 'Advertised but refused the GATT connection.' },
      ],
      recommendation:
        'A controller that advertises but will not connect is the classic soft-brick. Do not keep retrying over BLE — recover with an ST-Link/UART flash of the stock image.',
    };
  }

  const evidence: BrickEvidence[] = [
    { label: 'Device advertised', ok: true, detail: 'Seen in the BLE scan.' },
    { label: 'GATT connected', ok: true, detail: 'GATT connection established.' },
    {
      label: 'Status frame readable',
      ok: obs.statusReadable,
      detail: obs.statusReadable ? 'Controller answered the status read.' : 'Connected, but no valid status frame came back.',
    },
    {
      label: 'Firmware versions',
      ok: obs.versionsRead > 0,
      detail: obs.versionsRead > 0 ? `${obs.versionsRead} version(s) reported.` : 'No version response — the application is not running.',
    },
  ];

  if (firmwareFault) {
    evidence.push({
      label: `Active fault ${obs.errorCode}`,
      ok: false,
      detail: FIRMWARE_FAULT_CODES[obs.errorCode!],
    });
  }

  if (!obs.statusReadable && obs.versionsRead === 0) {
    return {
      verdict: 'soft-bricked',
      score: 4,
      evidence,
      recommendation:
        'The controller connects but runs no application code — a half-written flash. Recover with a wired (ST-Link/UART) flash of the stock firmware; further BLE writes will not help.',
    };
  }

  if (firmwareFault) {
    return {
      verdict: 'suspicious',
      score: 3,
      evidence,
      recommendation:
        `The controller reports fault ${obs.errorCode} (${FIRMWARE_FAULT_CODES[obs.errorCode!]}). Back up first, then re-flash stock firmware to clear it before replacing any hardware.`,
    };
  }

  if (!obs.statusReadable || obs.versionsRead === 0) {
    return {
      verdict: 'suspicious',
      score: 1,
      evidence,
      recommendation:
        'Partial responses — the application is running but some reads failed. Retry once; if it repeats, treat it as an intermittent controller fault.',
    };
  }

  return {
    verdict: 'healthy',
    score: 0,
    evidence,
    recommendation: 'Controller is responding normally. Back up the firmware before any work.',
  };
}
