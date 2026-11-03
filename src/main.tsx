import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { adoptLegacyDatabase } from './db/db';
import './index.css';

// Ask the browser not to evict our IndexedDB data under storage pressure.
navigator.storage?.persist?.().catch(() => {});

// Bring over data saved under the app's previous name before first render.
adoptLegacyDatabase()
  .catch(() => false)
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
