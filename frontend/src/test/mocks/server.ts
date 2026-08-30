import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/**
 * Mock Service Worker server for Node.js test environment.
 * Intercepts HTTP requests in tests to provide deterministic responses.
 */
export const server = setupServer(...handlers)
