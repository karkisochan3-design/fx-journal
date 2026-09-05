import React, { useEffect } from 'react';
import { IconAlert, IconX } from './Icons.jsx';

export function Modal({ title, subtitle, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={wide ? { maxWidth: 720 } : undefined}
      >
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.02em' }}>{title}</h2>
              {subtitle && <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 3 }}>{subtitle}</p>}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <IconX size={17} />
            </button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  danger = true,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span
          style={{
            flex: 'none',
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--loss-soft)',
            color: 'var(--loss)',
          }}
        >
          <IconAlert size={17} />
        </span>
        <p style={{ fontSize: 13.5, color: 'var(--text-dim)', paddingTop: 7 }}>{message}</p>
      </div>
    </Modal>
  );
}

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => onDismiss(t.id)}>
          <span style={{ flex: 1 }}>{t.message}</span>
          <IconX size={14} />
        </div>
      ))}
    </div>
  );
}
