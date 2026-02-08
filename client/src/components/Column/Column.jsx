import React from 'react';
import styles from './Column.module.css';
import Card from '../Card/Card';

function Column({
  column,
  cards,
  onEditColumn,
  onDeleteColumn,
  onAddCard,
  onEditCard,
  onViewCard,
  onDeleteCard,
  onMoveButtonClick,
  allColumns,
  priorityFilter,
  cardFilterFn,
  currentUserId,
  canManage = false,
  onToggleCardCompletion,
  onToggleCardOwnership,
  onColumnDragStart,
  onColumnDragEnd,
  onColumnDragOver,
  onColumnDrop,
  isColumnDragTarget = false,
  onCardDragStart,
  onCardDragEnd,
  onCardDragOver,
  onCardDrop,
  isCardDropTarget = false,
  dragCard,
}) {
  const filteredCards = cards.filter((card) => {
    const priorityMatches = !(priorityFilter && priorityFilter !== 'all') || card.priority === priorityFilter;
    const customMatches = typeof cardFilterFn === 'function' ? cardFilterFn(card) : true;
    return priorityMatches && customMatches;
  });

  const handleEditColumn = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (onEditColumn && column) {
      onEditColumn(column);
    }
  };

  const handleDeleteColumn = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (onDeleteColumn && column?.id) {
      onDeleteColumn(column.id);
    }
  };

  if (!column) return null;

  const renderDropSlot = (slotIndex, key, showHint = false) => (
    <div
      key={key}
      className={`${styles.cardDropSlot} ${showHint ? styles.cardDropSlotHint : ''}`}
      onDragOver={(event) => {
        if (onCardDragOver) {
          onCardDragOver(event, column.id, slotIndex);
        } else if (onCardDrop) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        if (!onCardDrop) return;
        event.preventDefault();
        event.stopPropagation();
        onCardDrop(column.id, slotIndex);
      }}
    >
      {showHint ? 'Drop card here' : ''}
    </div>
  );

  return (
    <div className={`${styles.column} ${isColumnDragTarget ? styles.columnDragOver : ''}`}>
      <div
        className={styles.columnHeader}
        draggable={Boolean(canManage && onColumnDragStart)}
        onDragStart={() => {
          if (canManage && onColumnDragStart) {
            onColumnDragStart(column.id);
          }
        }}
        onDragEnd={() => {
          if (canManage && onColumnDragEnd) {
            onColumnDragEnd();
          }
        }}
        onDragOver={(event) => {
          if (canManage && onColumnDragOver) {
            onColumnDragOver(event, column.id);
          }
        }}
        onDrop={(event) => {
          if (canManage && onColumnDrop) {
            onColumnDrop(event, column.id);
          }
        }}
      >
        <h3 className={styles.columnTitle}>{column.title}</h3>
        {(onEditColumn || onDeleteColumn) && (
          <div className={styles.columnActions}>
            {onEditColumn && (
              <button
                className={styles.columnActionBtn}
                type="button"
                onClick={handleEditColumn}
                title="Edit column"
              >
                <svg width="16" height="16" viewBox="0 0 32 32">
                  <use href="/sprites.svg#icon-pencil-01"></use>
                </svg>
              </button>
            )}
            {onDeleteColumn && (
              <button
                className={styles.columnActionBtn}
                type="button"
                onClick={handleDeleteColumn}
                title="Delete column"
              >
                <svg width="16" height="16" viewBox="0 0 32 32">
                  <use href="/sprites.svg#icon-trash-04"></use>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className={`${styles.cardsContainer} ${isCardDropTarget ? styles.cardsDropActive : ''}`}
        onDragOver={(event) => {
          if (onCardDragOver) {
            onCardDragOver(event, column.id);
          } else if (onCardDrop) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          if (!onCardDrop) return;
          event.preventDefault();
          onCardDrop(column.id, cards.length);
        }}
      >
        {filteredCards.length === 0
          ? renderDropSlot(cards.length, 'empty-drop-slot', true)
          : filteredCards.flatMap((card, visibleIndex) => {
            const actualIndex = cards.findIndex((item) => item.id === card.id);
            const insertBeforeIndex = actualIndex >= 0 ? actualIndex : visibleIndex;
            const insertAfterIndex = insertBeforeIndex + 1;

            return [
              visibleIndex === 0
                ? renderDropSlot(insertBeforeIndex, `slot-before-${card.id}`)
                : null,
              <div
                key={card.id}
                className={styles.cardDragSlot}
                onDragOver={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const shouldPlaceAfter = event.clientY - rect.top > rect.height / 2;
                  let dynamicIndex = shouldPlaceAfter ? insertAfterIndex : insertBeforeIndex;
                  if (dragCard?.fromColumnId === column.id) {
                    const fromIndex = cards.findIndex((item) => item.id === dragCard.cardId);
                    if (fromIndex !== -1) {
                      dynamicIndex = fromIndex < insertBeforeIndex ? insertAfterIndex : insertBeforeIndex;
                    }
                  }
                  if (onCardDragOver) {
                    onCardDragOver(event, column.id, dynamicIndex);
                  } else if (onCardDrop) {
                    event.preventDefault();
                  }
                }}
                onDrop={(event) => {
                  if (!onCardDrop) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const shouldPlaceAfter = event.clientY - rect.top > rect.height / 2;
                  let dynamicIndex = shouldPlaceAfter ? insertAfterIndex : insertBeforeIndex;
                  if (dragCard?.fromColumnId === column.id) {
                    const fromIndex = cards.findIndex((item) => item.id === dragCard.cardId);
                    if (fromIndex !== -1) {
                      dynamicIndex = fromIndex < insertBeforeIndex ? insertAfterIndex : insertBeforeIndex;
                    }
                  }
                  onCardDrop(column.id, dynamicIndex);
                }}
              >
                <Card
                  card={card}
                  onEdit={onEditCard}
                  onView={onViewCard}
                  onDelete={onDeleteCard}
                  onMoveButtonClick={(nextCard) => {
                    if (onMoveButtonClick && nextCard) {
                      onMoveButtonClick(nextCard, column.id);
                    }
                  }}
                  onDragStartCard={(nextCard) => {
                    if (onCardDragStart && nextCard) {
                      onCardDragStart(nextCard, column.id);
                    }
                  }}
                  onDragEndCard={() => {
                    if (onCardDragEnd) {
                      onCardDragEnd();
                    }
                  }}
                  onToggleCompletion={(nextCard, completed) => {
                    if (onToggleCardCompletion && nextCard) {
                      onToggleCardCompletion(nextCard, column.id, completed);
                    }
                  }}
                  onToggleOwnership={(nextCard, action) => {
                    if (onToggleCardOwnership && nextCard) {
                      onToggleCardOwnership(nextCard, column.id, action);
                    }
                  }}
                  currentUserId={currentUserId}
                  canManage={canManage}
                  columns={allColumns}
                />
              </div>,
              renderDropSlot(insertAfterIndex, `slot-after-${card.id}`),
            ].filter(Boolean);
          })}
      </div>

      {onAddCard && (
        <button
          className={styles.addCardBtn}
          type="button"
          onClick={() => {
            if (column?.id) {
              onAddCard(column.id);
            }
          }}
        >
          <div className={styles.addCardIconContainer}>
            <svg className={styles.addCardIcon} width="20" height="20" viewBox="0 0 32 32">
              <use href="/sprites.svg#icon-big-plus"></use>
            </svg>
          </div>
          <span className={styles.addCardText}>Add another card</span>
        </button>
      )}
    </div>
  );
}

export default Column;
