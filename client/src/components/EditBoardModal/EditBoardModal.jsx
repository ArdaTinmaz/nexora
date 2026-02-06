import React, { useState, useEffect } from 'react';
import styles from './EditBoardModal.module.css';

const icons = [
  { id: 'project', name: 'icon-Project' },
  { id: 'star', name: 'icon-star-04' },
  { id: 'puzzle', name: 'icon-puzzle-piece-02' },
  { id: 'hexagon', name: 'icon-hexagon-01' },
  { id: 'lightning', name: 'icon-lightning-02' },
  { id: 'container', name: 'icon-container' },
  { id: 'loading', name: 'icon-loading-03' },
  { id: 'colors', name: 'icon-colors' },
];

const backgrounds = Array.from({ length: 15 }, (_, i) => `Desktop${i + 1}.jpg`);

function EditBoardModal({ isOpen, onClose, onEdit, board, disableTitle = false }) {
  const [title, setTitle] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [selectedBackground, setSelectedBackground] = useState(null);

  useEffect(() => {
    if (board) {
      setTitle(board.name || '');
      setSelectedIcon(board.icon || null);
      setSelectedBackground(board.background || null);
    }
  }, [board]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextTitle = disableTitle ? board?.name || title : title.trim();
    if (!nextTitle) return;
    onEdit({
      ...board,
      name: nextTitle,
      icon: selectedIcon,
      iconName: icons.find(i => i.id === selectedIcon)?.name || 'icon-Project',
      background: selectedBackground,
    });
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
          <h2 className={styles.title}>Edit board</h2>
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
            <input
              type="text"
              className={styles.input}
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={disableTitle}
              autoFocus
            />
          </div>

          <div className={styles.section}>
            <label className={styles.label}>Icons</label>
            <div className={styles.iconGrid}>
              {icons.map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  className={`${styles.iconBtn} ${selectedIcon === icon.id ? styles.selected : ''}`}
                  onClick={() => setSelectedIcon(icon.id)}
                >
                  <svg 
                    width="18" 
                    height="18" 
                    viewBox="0 0 32 32"
                  >
                    <use href={`/sprites.svg#${icon.name}`}></use>
                  </svg>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.label}>Background</label>
            <div className={styles.backgroundGrid}>
              {/* Empty background option */}
              <button
                type="button"
                className={`${styles.backgroundBtn} ${selectedBackground === null ? styles.selected : ''}`}
                onClick={() => setSelectedBackground(null)}
              >
                <div className={styles.emptyBackground}>
                  <svg width="16" height="16" viewBox="0 0 32 32">
                    <use href="/sprites.svg#icon-plus"></use>
                  </svg>
                </div>
              </button>
              {/* Background images */}
              {backgrounds.map((bg) => (
                <button
                  key={bg}
                  type="button"
                  className={`${styles.backgroundBtn} ${selectedBackground === bg ? styles.selected : ''}`}
                  onClick={() => setSelectedBackground(bg)}
                >
                  <img
                    src={`${process.env.PUBLIC_URL}/images/TaskProDesktop/${bg}`}
                    alt={bg}
                    className={styles.backgroundImage}
                  />
                </button>
              ))}
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

export default EditBoardModal;
