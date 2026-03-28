/**
 * P2P Server Playwright Fixture
 *
 * Spawns a fresh p2p_server.ts process on a free OS port before each test
 * and terminates it afterwards. Each test gets an isolated server instance.
 */

import { test as base } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import * as net from 'net';
import { resolve } from 'path';

const SCRIPT = resolve(process.cwd(), 'scripts/p2p_server.ts');

// ── Port discovery ────────────────────────────────────────────────────────────

/**
 * Ask the OS for a free ephemeral port.
 * Binding on port 0 causes the OS to assign an available port.
 */
function findFreePort(): Promise<number> {
  return new Promise((resolveP, rejectP) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const info = srv.address() as net.AddressInfo;
      srv.close(() => resolveP(info.port));
    });
    srv.on('error', rejectP);
  });
}

// ── Server process ────────────────────────────────────────────────────────────

/**
 * Spawn the P2P server and resolve once it reports it is listening.
 * Rejects if the process errors or does not start within 15 seconds.
 */
function spawnServer(port: number): Promise<ChildProcess> {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn('npx', ['tsx', SCRIPT, '--port', String(port)], {
      shell: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    proc.stdout!.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('listening')) resolveP(proc);
    });
    proc.on('error', rejectP);

    setTimeout(
      () => rejectP(new Error(`P2P server did not start on port ${port}`)),
      15_000,
    );
  });
}

// ── Fixture type ──────────────────────────────────────────────────────────────

/** Values provided by the p2pServer fixture to each test. */
export interface P2PServerFixture {
  /** TCP port the server is listening on. */
  readonly port: number;
  /** Full WebSocket URL for clients to connect to. */
  readonly url: string;
}

type P2PFixtures = { p2pServer: P2PServerFixture };

// ── Extended test object ──────────────────────────────────────────────────────

export const test = base.extend<P2PFixtures>({
  /**
   * Provides a live P2P server scoped to a single test.
   * The server runs on a unique OS-assigned port so parallel tests never clash.
   */
  // eslint-disable-next-line no-empty-pattern
  p2pServer: async ({}, use) => {
    const port = await findFreePort();
    const proc = await spawnServer(port);
    await use({ port, url: `ws://localhost:${port}` });
    proc.kill();
    // Brief pause to let the OS reclaim the port before the next test.
    await new Promise<void>((r) => setTimeout(r, 200));
  },
});

export { expect } from '@playwright/test';
