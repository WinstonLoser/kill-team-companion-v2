import React, { useEffect } from 'react';
import './InfoOverlay.css';

export interface InfoOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}

export function InfoOverlay({ isOpen, onClose, title, children }: InfoOverlayProps) {
  // Prevent scrolling on body when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="info-overlay-backdrop" onClick={onClose}>
      <div className="info-overlay-modal op-card-container" onClick={e => e.stopPropagation()}>
        <div className="op-card-header">
          <div className="op-header-left">
            <div className="op-title-area">
              <h2 className="op-name" style={{ fontSize: '1.5rem' }}>{title}</h2>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="op-body info-overlay-body">
          {children}
        </div>
      </div>
    </div>
  );
}
