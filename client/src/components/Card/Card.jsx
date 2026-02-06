import React from 'react';
import styles from './Card.module.css';

const priorityColors = {
  without: { color: '#808080', label: 'without' },
  low: { color: '#8FA1D0', label: 'Low' },
  medium: { color: '#E09CB5', label: 'Medium' },
  high: { color: '#BEDBB0', label: 'High' },
};

function Card({ card, onEdit, onDelete, onMove, onMoveButtonClick, onView, columns, currentColumnId, isFirstCard = false, isLastCard = false }) {

  const isDeadlineToday = () => {
    if (!card.deadline) return false;
    const today = new Date();
    const deadline = new Date(card.deadline);
    return (
      today.getFullYear() === deadline.getFullYear() &&
      today.getMonth() === deadline.getMonth() &&
      today.getDate() === deadline.getDate()
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit && card) {
      onEdit(card);
    }
  };

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete && card?.id) {
      onDelete(card.id);
    }
  };

  const handleMoveButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onMoveButtonClick && card) {
      onMoveButtonClick(card);
    }
  };

  const priority = priorityColors[card?.priority] || priorityColors.without;

  if (!card) return null;

  return (
    <>
      <div
        className={styles.card}
        style={{ borderLeftColor: priority.color }}
        onClick={() => onView && card && onView(card)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && onView) {
            e.preventDefault();
            onView(card);
          }
        }}
      >
        <h4 className={styles.cardTitle}>{card.title}</h4>
        <p className={styles.cardDescription}>{card.description}</p>
        
        <div className={styles.cardMeta}>
          <div className={styles.metaRow}>
            <div className={styles.metaLeft}>
              <div className={styles.priorityBadge}>
                <div
                  className={styles.priorityDot}
                  style={{ backgroundColor: priority.color }}
                />
                <span 
                  className={styles.priorityLabel}
                  style={card.priority === 'without' ? { color: '#808080' } : {}}
                >
                  {priority.label}
                </span>
              </div>
              {card.deadline && (
                <div className={styles.deadline}>
                  <span className={styles.deadlineText}>{formatDate(card.deadline)}</span>
                </div>
              )}
            </div>
            <div className={styles.metaRight}>
              <div className={styles.actionButtons}>
                {/* Bell button - only show if deadline is today, placed first */}
                {isDeadlineToday() && (
                  <button
                    className={`${styles.actionBtn} ${styles.bellBtn}`}
                    type="button"
                    title="Deadline is today"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13.73 21a2 2 0 0 1-3.46 0"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}

                {/* Move button */}
                {onMoveButtonClick && (
                  <button
                    className={styles.actionBtn}
                    type="button"
                    onClick={handleMoveButtonClick}
                    title="Move card"
                  >
                    <svg width="24" height="24" viewBox="0 0 32 32">
                      <use href="/sprites.svg#icon-arrow-circle-broken-right"></use>
                    </svg>
                  </button>
                )}

                {/* Edit button */}
                {onEdit && (
                  <button
                    className={styles.actionBtn}
                    type="button"
                    onClick={handleEdit}
                    title="Edit card"
                  >
                    <svg width="24" height="24" viewBox="0 0 32 32">
                      <use href="/sprites.svg#icon-pencil-01"></use>
                    </svg>
                  </button>
                )}

                {/* Delete button */}
                {onDelete && (
                  <button
                    className={styles.actionBtn}
                    type="button"
                    onClick={handleDelete}
                    title="Delete card"
                  >
                    <svg width="24" height="24" viewBox="0 0 32 32">
                      <use href="/sprites.svg#icon-trash-04"></use>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Card;
