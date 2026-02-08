import React, { useState, useEffect } from 'react';
import styles from './EditCardModal.module.css';

const priorities = [
  { id: 'without', label: 'Without priority', color: '#808080' },
  { id: 'low', label: 'Low', color: '#8FA1D0' },
  { id: 'medium', label: 'Medium', color: '#E09CB5' },
  { id: 'high', label: 'High', color: '#BEDBB0' },
];

const normalizeToDateInput = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const dateFromTs = new Date(Number(value));
    return Number.isNaN(dateFromTs.getTime()) ? '' : dateFromTs.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const dateFromTs = new Date(value);
    return Number.isNaN(dateFromTs.getTime()) ? '' : dateFromTs.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && value.includes('T')) {
    return value.split('T')[0];
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

function EditCardModal({ isOpen, onClose, onEdit, card }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('without');
  const [deadline, setDeadline] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (card) {
      setTitle(card.title || '');
      setDescription(card.description || '');
      setPriority(card.priority || 'without');
      setDeadline(normalizeToDateInput(card.deadline));
    }
  }, [card]);

  if (!isOpen || !card) return null;

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onEdit({
      ...card,
      title: title.trim(),
      description: description.trim(),
      priority,
      deadline: deadline || null,
    });
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.headerLabel}>Pop Up</span>
          <h2 className={styles.title}>Edit card</h2>
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
              className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
              placeholder="Title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors({ ...errors, title: '' });
              }}
              autoFocus
            />
            {errors.title && <span className={styles.errorText}>{errors.title}</span>}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Description</label>
            <textarea
              className={`${styles.textarea} ${errors.description ? styles.inputError : ''}`}
              placeholder="Description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors({ ...errors, description: '' });
              }}
              rows={4}
            />
            {errors.description && <span className={styles.errorText}>{errors.description}</span>}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Label color</label>
            <div className={styles.priorityList}>
              {priorities.map((pri) => (
                <button
                  key={pri.id}
                  type="button"
                  className={`${styles.priorityBtn} ${priority === pri.id ? styles.selected : ''}`}
                  onClick={() => setPriority(pri.id)}
                >
                  <div
                    className={styles.priorityCircle}
                    style={{ backgroundColor: pri.color }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Deadline</label>
            <div className={styles.dateInputWrapper}>
              <input
                type="date"
                className={styles.dateInput}
                value={deadline}
                min={getMinDate()}
                onChange={(e) => setDeadline(e.target.value)}
              />
              {deadline && (
                <span className={styles.dateDisplay}>
                  {formatDateForDisplay(deadline)}
                </span>
              )}
            </div>
          </div>

          <button type="submit" className={styles.submitBtn}>
            <div className={styles.plusIconContainer}>
              <svg className={styles.plusIcon} width="20" height="20" viewBox="0 0 32 32">
                <use href="/sprites.svg#icon-plus"></use>
              </svg>
            </div>
            <span className={styles.submitText}>Edit</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default EditCardModal;
