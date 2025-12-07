import React, { useState, useEffect } from 'react';
import styles from './FiltersModal.module.css';

const priorities = [
  { id: 'without', label: 'Without priority', color: '#808080' },
  { id: 'low', label: 'Low', color: '#8FA1D0' },
  { id: 'medium', label: 'Medium', color: '#E09CB5' },
  { id: 'high', label: 'High', color: '#BEDBB0' },
];

function FiltersModal({ isOpen, onClose, selectedPriority, onPriorityChange }) {
  const [priority, setPriority] = useState(selectedPriority || 'all');

  useEffect(() => {
    setPriority(selectedPriority || 'all');
  }, [selectedPriority]);

  if (!isOpen) return null;

  const handlePrioritySelect = (pri) => {
    setPriority(pri);
    onPriorityChange(pri);
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
          <h2 className={styles.title}>Filters</h2>
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
          {/* Priority filter */}
          <div className={styles.section}>
            <div className={styles.priorityHeader}>
              <label className={styles.label}>Label color</label>
              <button
                type="button"
                className={styles.showAllBtn}
                onClick={() => handlePrioritySelect('all')}
              >
                Show all
              </button>
            </div>
            <div className={styles.priorityList}>
              {priorities.map((pri) => (
                <button
                  key={pri.id}
                  type="button"
                  className={`${styles.priorityBtn} ${priority === pri.id ? styles.selected : ''}`}
                  onClick={() => handlePrioritySelect(pri.id)}
                >
                  <div
                    className={styles.priorityCircle}
                    style={{ backgroundColor: pri.color }}
                  />
                  <span className={styles.priorityLabel}>{pri.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FiltersModal;
