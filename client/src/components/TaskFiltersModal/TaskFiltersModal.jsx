import React, { useEffect, useState } from 'react';
import styles from './TaskFiltersModal.module.css';

const defaultTaskFilters = {
  title: '',
  project: 'all',
  team: 'all',
  assignee: 'all',
  dateFrom: '',
  dateTo: '',
  status: 'all',
  priority: 'all',
};

function TaskFiltersModal({
  isOpen,
  onClose,
  filters = defaultTaskFilters,
  onApplyFilters,
  projectOptions = [],
  teamOptions = [],
  assigneeOptions = [],
}) {
  const [draft, setDraft] = useState({ ...defaultTaskFilters, ...(filters || {}) });

  useEffect(() => {
    if (isOpen) {
      setDraft({ ...defaultTaskFilters, ...(filters || {}) });
    }
  }, [filters, isOpen]);

  if (!isOpen) return null;

  const handleChange = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    if (onApplyFilters) onApplyFilters(draft);
    onClose();
  };

  const handleClear = () => {
    if (onApplyFilters) onApplyFilters(defaultTaskFilters);
    onClose();
  };

  return (
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Filters</h2>
          <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Close">
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
          <label className={styles.label}>
            Card title
            <input
              className={styles.input}
              type="text"
              value={draft.title}
              onChange={(event) => handleChange('title', event.target.value)}
              placeholder="Search by title"
            />
          </label>

          <label className={styles.label}>
            Project
            <select
              className={styles.select}
              value={draft.project}
              onChange={(event) => handleChange('project', event.target.value)}
            >
              <option value="all">All</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Team
            <select
              className={styles.select}
              value={draft.team}
              onChange={(event) => handleChange('team', event.target.value)}
            >
              <option value="all">All</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Assigned user
            <select
              className={styles.select}
              value={draft.assignee}
              onChange={(event) => handleChange('assignee', event.target.value)}
            >
              <option value="all">All</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Date range
            <div className={styles.dateRow}>
              <input
                className={styles.input}
                type="date"
                value={draft.dateFrom}
                onChange={(event) => handleChange('dateFrom', event.target.value)}
              />
              <input
                className={styles.input}
                type="date"
                value={draft.dateTo}
                onChange={(event) => handleChange('dateTo', event.target.value)}
              />
            </div>
          </label>

          <label className={styles.label}>
            Status
            <select
              className={styles.select}
              value={draft.status}
              onChange={(event) => handleChange('status', event.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In-Progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <label className={styles.label}>
            Priority
            <select
              className={styles.select}
              value={draft.priority}
              onChange={(event) => handleChange('priority', event.target.value)}
            >
              <option value="all">All</option>
              <option value="without">Without priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <div className={styles.actionsRow}>
            <button className={styles.clearBtn} type="button" onClick={handleClear}>
              Clear
            </button>
            <button className={styles.searchBtn} type="button" onClick={handleSearch}>
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskFiltersModal;
