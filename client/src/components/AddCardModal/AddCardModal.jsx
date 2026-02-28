import React, { useState } from 'react';
import styles from './AddCardModal.module.css';
import { spriteHref } from '../../utils/assets';

const priorities = [
  { id: 'without', label: 'Without priority', color: '#808080' },
  { id: 'low', label: 'Low', color: '#8FA1D0' },
  { id: 'medium', label: 'Medium', color: '#E09CB5' },
  { id: 'high', label: 'High', color: '#BEDBB0' },
];

function AddCardModal({ isOpen, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('without');
  const [deadline, setDeadline] = useState('');
  const [errors, setErrors] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);

  if (!isOpen) return null;

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
    onCreate({
      title: title.trim(),
      description: description.trim(),
      priority,
      deadline: deadline || null,
    });
    setTitle('');
    setDescription('');
    setPriority('without');
    setDeadline('');
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
          <h2 className={styles.title}>Add card</h2>
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
                <use href={spriteHref('icon-plus')}></use>
              </svg>
            </div>
            <span className={styles.submitText}>Add</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddCardModal;

