import React from 'react';
import styles from './ConfirmModal.module.css';

function ConfirmModal({
  isOpen,
  title = 'Confirm action',
  message = '',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && onCancel) {
      onCancel();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerLabel}>Confirm</span>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeBtn} type="button" onClick={onCancel}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {message && <p className={styles.message}>{message}</p>}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={styles.deleteBtn} type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
