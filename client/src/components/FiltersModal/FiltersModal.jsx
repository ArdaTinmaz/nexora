import React, { useState, useEffect } from 'react';
import styles from './FiltersModal.module.css';

const priorities = [
  { id: 'without', label: 'Without priority', color: '#808080' },
  { id: 'low', label: 'Low', color: '#8FA1D0' },
  { id: 'medium', label: 'Medium', color: '#E09CB5' },
  { id: 'high', label: 'High', color: '#BEDBB0' },
];

const defaultAdvancedFilters = {
  title: '',
  dateFrom: '',
  dateTo: '',
  status: 'all',
  assignee: 'all',
  priority: 'all',
};

function FiltersModal({
  isOpen,
  onClose,
  selectedPriority,
  onPriorityChange,
  advanced = false,
  filters = defaultAdvancedFilters,
  assigneeOptions = [],
  onApplyFilters,
}) {
  const [priority, setPriority] = useState(selectedPriority || 'all');
  const [advancedFilters, setAdvancedFilters] = useState({
    ...defaultAdvancedFilters,
    ...(filters || {}),
  });

  useEffect(() => {
    setPriority(selectedPriority || 'all');
  }, [selectedPriority]);

  useEffect(() => {
    setAdvancedFilters({
      ...defaultAdvancedFilters,
      ...(filters || {}),
    });
  }, [filters, isOpen]);

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

  const handleAdvancedChange = (key, value) => {
    setAdvancedFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSearch = () => {
    if (onApplyFilters) {
      onApplyFilters(advancedFilters);
    }
    onClose();
  };

  const handleClear = () => {
    setAdvancedFilters(defaultAdvancedFilters);
    if (onApplyFilters) {
      onApplyFilters(defaultAdvancedFilters);
    }
    onClose();
  };

  const renderLegacyPriority = () => (
    <div className={styles.content}>
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
  );

  const renderAdvancedFilters = () => (
    <div className={styles.content}>
      <div className={styles.section}>
        <label className={styles.label}>Card title</label>
        <input
          className={styles.input}
          type="text"
          placeholder="Search by card title"
          value={advancedFilters.title}
          onChange={(event) => handleAdvancedChange('title', event.target.value)}
        />
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Date range</label>
        <div className={styles.dateRow}>
          <input
            className={styles.input}
            type="date"
            value={advancedFilters.dateFrom}
            onChange={(event) => handleAdvancedChange('dateFrom', event.target.value)}
          />
          <input
            className={styles.input}
            type="date"
            value={advancedFilters.dateTo}
            onChange={(event) => handleAdvancedChange('dateTo', event.target.value)}
          />
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Status</label>
        <select
          className={styles.select}
          value={advancedFilters.status}
          onChange={(event) => handleAdvancedChange('status', event.target.value)}
        >
          <option value="all">All</option>
          <option value="in-progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Assigned person</label>
        <select
          className={styles.select}
          value={advancedFilters.assignee}
          onChange={(event) => handleAdvancedChange('assignee', event.target.value)}
        >
          <option value="all">All</option>
          <option value="unassigned">Unassigned</option>
          {assigneeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Priority</label>
        <select
          className={styles.select}
          value={advancedFilters.priority}
          onChange={(event) => handleAdvancedChange('priority', event.target.value)}
        >
          <option value="all">All</option>
          {priorities.map((pri) => (
            <option key={pri.id} value={pri.id}>
              {pri.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.actionsRow}>
        <button className={styles.clearBtn} type="button" onClick={handleClear}>
          Clear
        </button>
        <button className={styles.searchBtn} type="button" onClick={handleSearch}>
          Search
        </button>
      </div>
    </div>
  );

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

        {advanced ? renderAdvancedFilters() : renderLegacyPriority()}
      </div>
    </div>
  );
}

export default FiltersModal;
