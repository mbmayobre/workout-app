/**
 * Entry point. The browser loads index.html, which loads this file, which
 * draws the <App /> component into the empty <div id="root">.
 *
 * <StrictMode> is a development aid: it runs some code twice on purpose to
 * surface bugs early. It has no effect in the production build.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
