import React, { useEffect, useState } from 'react';
import Header from './Header';
import { ToastProvider } from './ToastProvider';
import { useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const location = useLocation();
  const [invert, setInvert] = useState(false);

  useEffect(() => {
    try {
      const key = localStorage.getItem('invertHeadingPath');
      setInvert(key === location.pathname);
    } catch (e) {
      setInvert(false);
    }
  }, [location]);

  return (
    <div className={`page-shell min-h-screen bg-obsidian text-text lg:pl-0 ${invert ? 'invert-headings' : ''}`}>
      {/* Skip link for keyboard users */}
      <a href="#main" className="sr-only focus:not-sr-only">Skip to main content</a>
      <Header />
      <ToastProvider>
        <main id="main" role="main" className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </ToastProvider>
    </div>
  );
}
