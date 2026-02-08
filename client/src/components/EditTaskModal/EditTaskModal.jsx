import React, { useEffect, useState } from 'react';
import styles from './EditTaskModal.module.css';

const toInputDate = (value) => {
  if (!value) return '';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

function EditTaskModal({
  isOpen,
  task,
  loading = false,
  errorMessage = '',
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    priority: 'without',
    status: 'pending',
    deadline: '',
  });
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!task) return;
    setDraft({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'without',
      status: task.status || 'pending',
      deadline: toInputDate(task.deadline),
    });
    setLocalError('');
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      setLocalError('Title is required.');
      return;
    }
    setLocalError('');
    onSave({
      ...draft,
      title: draft.title.trim(),
    });
  };

  const handleOverlayClick = (event) => {
    if (event.target !== event.currentTarget || loading) return;
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Edit Task</h2>
          <button className={styles.closeBtn} type="button" onClick={onClose} disabled={loading}>
            X
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Title
            <input
              className={styles.input}
              value={draft.title}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </label>

          <label className={styles.label}>
            Description
            <textarea
              className={styles.textarea}
              rows="4"
              value={draft.description}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </label>

          <div className={styles.row}>
            <label className={styles.label}>
              Priority
              <select
                className={styles.select}
                value={draft.priority}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, priority: event.target.value }))
                }
              >
                <option value="without">Without</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className={styles.label}>
              Status
              <select
                className={styles.select}
                value={draft.status}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, status: event.target.value }))
                }
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In-Progress</option>
                <option value="completed">Completed</option>
              </select>
            </label>

            <label className={styles.label}>
              Deadline
              <input
                className={styles.input}
                type="date"
                value={draft.deadline}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, deadline: event.target.value }))
                }
              />
            </label>
          </div>

          {(localError || errorMessage) && (
            <p className={styles.errorText}>{localError || errorMessage}</p>
          )}

          <div className={styles.actions}>
            <button
              className={styles.cancelBtn}
              type="button"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button className={styles.saveBtn} type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditTaskModal;
