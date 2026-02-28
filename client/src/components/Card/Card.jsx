import React from 'react';
import { API_ORIGIN } from '../../config';
import styles from './Card.module.css';
import { spriteHref } from '../../utils/assets';

const priorityColors = {
  without: { color: '#808080', label: 'without' },
  low: { color: '#8FA1D0', label: 'Low' },
  medium: { color: '#E09CB5', label: 'Medium' },
  high: { color: '#BEDBB0', label: 'High' },
};

const toDateObject = (value) => {
  if (!value) return null;
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = new Date(Number(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const date = toDateObject(value);
  if (!date) return '';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const isDeadlineToday = (value) => {
  const deadline = toDateObject(value);
  if (!deadline) return false;
  const today = new Date();
  return (
    today.getFullYear() === deadline.getFullYear() &&
    today.getMonth() === deadline.getMonth() &&
    today.getDate() === deadline.getDate()
  );
};

const resolveAvatarUrl = (avatarURL) => {
  if (!avatarURL) return '';
  if (/^(?:https?:|data:|blob:|file:)/i.test(avatarURL)) return avatarURL;
  if (avatarURL.startsWith('/')) return `${API_ORIGIN}${avatarURL}`;
  if (avatarURL.startsWith('uploads/')) return `${API_ORIGIN}/${avatarURL}`;
  return `${API_ORIGIN}/uploads/${avatarURL}`;
};

function Card({
  card,
  onEdit,
  onDelete,
  onMoveButtonClick,
  onView,
  onDragStartCard,
  onDragEndCard,
  onToggleCompletion,
  onToggleOwnership,
  currentUserId = '',
  canManage = false,
}) {
  if (!card) return null;

  const priority = priorityColors[card.priority] || priorityColors.without;
  const hasOwner = Boolean(card.ownerId);
  const isOwnedByMe = hasOwner && card.ownerId === currentUserId;
  const canOperateCard = isOwnedByMe || canManage;
  const canReleaseOwnership = isOwnedByMe || canManage;
  const ownerName = card.ownerName || (hasOwner ? 'Owner' : 'Unassigned');
  const ownerAvatar = resolveAvatarUrl(card.ownerAvatarURL);

  const handleCardAction = (event, handler) => {
    event.preventDefault();
    event.stopPropagation();
    if (handler) handler();
  };

  const handleOwnership = (event) => {
    handleCardAction(event, () => {
      if (!onToggleOwnership) return;
      if (!hasOwner) {
        onToggleOwnership(card, 'claim');
        return;
      }
      if (canReleaseOwnership) {
        onToggleOwnership(card, 'release');
      }
    });
  };

  const handleCompletion = (event) => {
    handleCardAction(event, () => {
      if (!onToggleCompletion) return;
      onToggleCompletion(card, !card.completed);
    });
  };

  return (
    <div
      className={`${styles.card} ${card.completed ? styles.cardCompleted : ''}`}
      style={{ borderLeftColor: priority.color }}
      draggable={Boolean(onDragStartCard && canOperateCard)}
      onDragStart={(event) => {
        if (!onDragStartCard || !canOperateCard) return;
        event.dataTransfer.effectAllowed = 'move';
        onDragStartCard(card);
      }}
      onDragEnd={() => {
        if (onDragEndCard) onDragEndCard(card);
      }}
      onClick={() => onView && onView(card)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && onView) {
          event.preventDefault();
          onView(card);
        }
      }}
    >
      <div className={styles.titleRow}>
        <h4 className={styles.cardTitle}>{card.title}</h4>
        {card.completed && <span className={styles.completedBadge}>Completed</span>}
      </div>

      <p className={styles.cardDescription}>{card.description}</p>

      <div className={styles.cardMeta}>
        <div className={styles.metaRow}>
          <div className={styles.metaLeft}>
            <div className={styles.priorityBadge}>
              <div className={styles.priorityDot} style={{ backgroundColor: priority.color }} />
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
              {isDeadlineToday(card.deadline) && (
                <button
                  className={`${styles.actionBtn} ${styles.bellBtn}`}
                  type="button"
                  title="Deadline is today"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
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

              {onToggleCompletion && canOperateCard && (
                <button
                  className={styles.actionBtn}
                  type="button"
                  onClick={handleCompletion}
                  title={card.completed ? 'Set in progress' : 'Set completed'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}

              {onMoveButtonClick && canOperateCard && (
                <button
                  className={styles.actionBtn}
                  type="button"
                  onClick={(event) => handleCardAction(event, () => onMoveButtonClick(card))}
                  title="Move card"
                >
                  <svg width="24" height="24" viewBox="0 0 32 32">
                    <use href={spriteHref('icon-arrow-circle-broken-right')}></use>
                  </svg>
                </button>
              )}

              {onEdit && (
                <button
                  className={styles.actionBtn}
                  type="button"
                  onClick={(event) => handleCardAction(event, () => onEdit(card))}
                  title="Edit card"
                >
                  <svg width="24" height="24" viewBox="0 0 32 32">
                    <use href={spriteHref('icon-pencil-01')}></use>
                  </svg>
                </button>
              )}

              {onDelete && (
                <button
                  className={styles.actionBtn}
                  type="button"
                  onClick={(event) => handleCardAction(event, () => onDelete(card.id))}
                  title="Delete card"
                >
                  <svg width="24" height="24" viewBox="0 0 32 32">
                    <use href={spriteHref('icon-trash-04')}></use>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {(onToggleOwnership || hasOwner) && (
          <div className={styles.ownerRow}>
            <div className={styles.ownerInfo}>
              {ownerAvatar ? (
                <img className={styles.ownerAvatar} src={ownerAvatar} alt={ownerName} />
              ) : (
                <div className={styles.ownerFallback}>
                  {(ownerName || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className={styles.ownerName}>{ownerName}</span>
            </div>

            {onToggleOwnership && (!hasOwner || isOwnedByMe) && (
              <button
                className={styles.ownerActionBtn}
                type="button"
                disabled={hasOwner && !canReleaseOwnership}
                onClick={handleOwnership}
                title={!hasOwner ? 'Claim card' : canReleaseOwnership ? 'Release card' : 'Owned card'}
              >
                {!hasOwner ? 'Claim' : canReleaseOwnership ? 'Release' : 'Owned'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Card;
