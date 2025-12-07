import React from 'react';
import styles from './CardDetailsModal.module.css';

const priorityMeta = {
  without: { label: 'Without priority', color: '#808080' },
  low: { label: 'Low', color: '#8FA1D0' },
  medium: { label: 'Medium', color: '#E09CB5' },
  high: { label: 'High', color: '#BEDBB0' },
};

function CardDetailsModal({ isOpen, onClose, card }) {
  if (!isOpen || !card) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Card details</h2>
          <button className={styles.closeBtn} type="button" onClick={onClose}>
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

        <div className={styles.section}>
          <p className={styles.label}>Title</p>
          <p className={styles.value}>{card.title}</p>
        </div>

        <div className={styles.section}>
          <p className={styles.label}>Description</p>
          <p className={`${styles.value} ${styles.description}`}>
            {card.description || 'No description'}
          </p>
        </div>

        <div className={styles.section}>
          <p className={styles.label}>Priority</p>
          <div className={styles.priorityPill}>
            <span
              className={styles.priorityDot}
              style={{ backgroundColor: priorityMeta[card.priority]?.color || '#808080' }}
            />
            <span className={styles.value}>
              {priorityMeta[card.priority]?.label || priorityMeta.without.label}
            </span>
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.label}>Deadline</p>
          <p className={styles.value}>{card.deadline ? formatDate(card.deadline) : 'No deadline'}</p>
        </div>
      </div>
    </div>
  );
}

export default CardDetailsModal;
