import React from 'react';

export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation">
      <button
        type="button"
        aria-label="Close modal overlay"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl p-6" role="dialog" aria-modal="true" aria-labelledby={title ? "modal-title" : undefined}>
        <div className="card">
          {title && <h3 id="modal-title" className="text-lg font-semibold mb-3">{title}</h3>}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
