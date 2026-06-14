import React from 'react'
import '@testing-library/jest-dom'

// @vitejs/plugin-react v6 does not inject the JSX runtime automatically when
// Vitest runs components through jsdom. Assigning React to globalThis lets
// component files compiled with the classic JSX transform (React.createElement)
// find React in scope without an explicit import in every file.
globalThis.React = React
