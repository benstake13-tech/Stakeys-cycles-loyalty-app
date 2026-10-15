import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EscooterDiagnosticTile } from './src/components/EscooterDiagnosticTile';
import type { FirmwareDeps } from './src/utils/scooterFirmware';

function makeDeps() {
  const saved: Array<{ name: string; size: number }> = [];
  const deps: FirmwareDeps = {
    hash: async (d) => `h${d.length}`,
    hashBytes: async (b) => `b${b.length}`,
    fetchBytes: async () => new Uint8Array([1, 2, 3, 4, 5]),
    saver: {
      save: (blob, name) => saved.push({ name, size: blob.size }),
    },
  };
  return { deps, saved };
}

describe('EscooterDiagnosticTile — firmware panels (simulator)', () => {
  it('reads versions in simulator mode and compares them to stock', async () => {
    render(<EscooterDiagnosticTile startInDemo firmwareDeps={makeDeps().deps} />);
    fireEvent.change(screen.getByTestId('escooter-model'), { target: { value: 'M365 Pro 2' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('escooter-read-versions'));
    });
    expect(screen.getByTestId('escooter-fw-esc').textContent).toContain('1.3.9');
    expect(screen.getByTestId('escooter-fw-esc').textContent).toContain('outdated');
    expect(screen.getByTestId('escooter-firmware-msg').textContent).toMatch(/read ESC 1\.3\.9 and BMS 1\.2\.7/i);
  });

  it('always takes a backup, saving a JSON file to the device', async () => {
    const { deps, saved } = makeDeps();
    render(<EscooterDiagnosticTile startInDemo firmwareDeps={deps} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('escooter-backup'));
    });
    expect(saved.length).toBe(1);
    expect(saved[0].name).toMatch(/stakeys-backup-/);
    expect(screen.getByTestId('escooter-firmware-msg').textContent).toMatch(/Diagnostic snapshot saved/);
  });

  it('blocks a manual download until backed up and risk accepted, then saves the file', async () => {
    const { deps, saved } = makeDeps();
    render(<EscooterDiagnosticTile startInDemo firmwareDeps={deps} />);
    fireEvent.change(screen.getByTestId('escooter-manual-url'), { target: { value: 'https://example.com/fw.bin' } });

    // No backup yet → blocked, nothing saved.
    await act(async () => {
      fireEvent.click(screen.getByTestId('escooter-download-manual'));
    });
    expect(saved.length).toBe(0);
    expect(screen.getByTestId('escooter-firmware-msg').textContent).toMatch(/flashing warning|backup/i);

    // Back up, accept the risk, then the download runs.
    await act(async () => {
      fireEvent.click(screen.getByTestId('escooter-backup'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('escooter-risk'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('escooter-download-manual'));
    });
    expect(saved.some((s) => s.name.match(/stakeys-fw-/))).toBe(true);
  });

  it('shows the flashing gate blockers until connected, backed up and accepted', () => {
    render(<EscooterDiagnosticTile firmwareDeps={makeDeps().deps} />);
    const gate = screen.getByTestId('escooter-gate').textContent;
    expect(gate).toMatch(/Connect to the scooter/);
    expect(gate).toMatch(/Take a backup/);
    expect(gate).toMatch(/brick/);
  });

  it('runs a full diagnostic sweep in simulator mode and shows the report', async () => {
    render(<EscooterDiagnosticTile startInDemo firmwareDeps={makeDeps().deps} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('escooter-sweep'));
    });
    // The simulator reports fault code 14, so the sweep should flag it.
    expect(screen.getByTestId('escooter-report').textContent).toMatch(/faulty|attention|healthy/);
    expect(screen.getByTestId('escooter-check-faults').textContent).toMatch(/Fault 14/);
  });

  it('runs a brick check and renders the verdict with evidence', () => {
    render(<EscooterDiagnosticTile startInDemo firmwareDeps={makeDeps().deps} />);
    const brick = screen.getByTestId('escooter-brick');
    expect(brick.textContent).toMatch(/Brick check/);
    expect(brick.textContent).toMatch(/Device advertised|GATT connected/);
  });
});
