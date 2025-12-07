import React, { useState } from 'react';
import styles from './AddColumnModal.module.css';

function AddColumnModal({ isOpen, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError('');
    onCreate({ title: title.trim() });
    setTitle('');
    onClose();
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
          <h2 className={styles.title}>Add column</h2>
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

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Title</label>
            <input
              type="text"
              className={`${styles.input} ${error ? styles.inputError : ''}`}
              placeholder="Title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              autoFocus
            />
            {error && <span className={styles.errorText}>{error}</span>}
          </div>

          <button type="submit" className={styles.submitBtn}>
            <div className={styles.plusIconContainer}>
              <svg className={styles.plusIcon} width="20" height="20" viewBox="0 0 32 32">
                <use href="/sprites.svg#icon-plus"></use>
              </svg>
            </div>
            <span className={styles.submitText}>Add</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddColumnModal;

