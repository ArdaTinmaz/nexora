import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import { IS_DESKTOP_APP } from './config';

const shouldUseHashRouter =
  IS_DESKTOP_APP ||
  (typeof window !== 'undefined' && window.location.protocol === 'file:');

const Router = shouldUseHashRouter ? HashRouter : BrowserRouter;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </Router>
  </React.StrictMode>
);
