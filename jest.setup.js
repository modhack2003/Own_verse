import '@testing-library/jest-dom'

// Shared browser media API used by the consent/reduced-motion hook.
if (typeof window !== 'undefined') Object.defineProperty(window, 'matchMedia', { writable: true, value: jest.fn(query => ({
  matches: false, media: query, onchange: null,
  addEventListener: jest.fn(), removeEventListener: jest.fn(),
  addListener: jest.fn(), removeListener: jest.fn(), dispatchEvent: jest.fn(),
})) });
