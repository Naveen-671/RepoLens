import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

/**
 * Boots the React application into the root DOM container.
 */
function bootstrap() {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root container #root was not found');
  }

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();