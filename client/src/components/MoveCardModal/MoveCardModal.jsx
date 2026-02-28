import React, { useEffect } from 'react';
import styles from './MoveCardModal.module.css';
import { spriteHref } from '../../utils/assets';

function MoveCardModal({ isOpen, onClose, onMove, columns, currentColumnId, cardTitle }) {
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

  const availableColumns = columns.filter((col) => col.id !== currentColumnId);

  const handleColumnClick = (targetColumnId) => {
    if (onMove && targetColumnId) {
      onMove(targetColumnId);
      onClose();
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.headerLabel}>Pop Up</span>
          <h2 className={styles.title}>Move card</h2>
          <button className={styles.closeBtn} onClick={onClose} type="button">
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

        <div className={styles.content}>
          {cardTitle && (
            <p className={styles.cardTitleText}>Select column to move "{cardTitle}"</p>
          )}
          
          <div className={styles.columnsList}>
            {availableColumns.length === 0 ? (
              <p className={styles.noColumnsText}>No other columns available</p>
            ) : (
              availableColumns.map((column) => (
                <button
                  key={column.id}
                  className={styles.columnButton}
                  type="button"
                  onClick={() => handleColumnClick(column.id)}
                >
                  <span className={styles.columnButtonText}>{column.title}</span>
                  <span className={styles.columnButtonArrow}>
                    <svg width="16" height="16" viewBox="0 0 32 32">
                      <use href={spriteHref('icon-arrow-circle-broken-right')}></use>
                    </svg>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MoveCardModal;

