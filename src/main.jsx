import React from 'react';
import { createRoot } from 'react-dom/client';
import AscentraPlatform from './App.jsx';
import './responsive.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AscentraPlatform />
  </React.StrictMode>
);
