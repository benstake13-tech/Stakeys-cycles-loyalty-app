import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { handleOAuthCallbackPage } from './utils/oauthService';
import { staffBookingAudio } from './utils/staffAlertAudio';
import './index.css';

// Prime the booking stinger on the first user gesture so a later booking alert
// is allowed to play (browsers block audio until the page is interacted with).
staffBookingAudio.installAutoplayUnlock();

// If we're inside the OAuth popup landing on /oauth/callback, relay the code
// back to the opener and stop before mounting the full app.
if (handleOAuthCallbackPage()) {
  // Popup relays the result and closes itself; nothing more to render.
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
