/**
 * AFIE Intelligence Platform — Entry Point
 *
 * Mounts the React application.
 * Global CSS is imported here so Vite processes it correctly.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
