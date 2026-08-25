import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Component tests run in a browser-like DOM; setupTests installs the custom
  // jest-dom matchers and JSX runtime shim before each suite.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
})
