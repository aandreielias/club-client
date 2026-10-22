import { settings } from '../../settings';
import type { TokenSource } from '../http/Transport';
import type { LiveSocket } from '../live/LiveSocket';
import { directory } from './core';
import { mockServer } from './MockServer';
import { MockSocket } from './MockSocket';
import { MockTransport } from './MockTransport';

// Registers every mock module: the core directory plus each features/<name>/mock.ts.
import.meta.glob(['./core.ts', '../../features/*/mock.ts', './calendarItems.ts'], { eager: true });

export function createMockTransport(token: TokenSource): MockTransport {
  return new MockTransport(mockServer, token, settings.api.mockLatencyMs, settings.api.mockOrigin);
}

export function createMockSocket(): LiveSocket {
  return new MockSocket(mockServer.events, (email) => directory.findActive(email), settings.live.mockTokenLifetimeMs);
}
