import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll } from 'vitest'
import { server } from './mocks/server'

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' })
})

// Reset handlers after each test to ensure test isolation
afterEach(() => {
  server.resetHandlers()
  cleanup()
})

// Stop MSW server after all tests
afterAll(() => {
  server.close()
})
