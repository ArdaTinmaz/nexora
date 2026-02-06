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
  onMoveCard,
  onMoveButtonClick,
  allColumns,
  priorityFilter,
}) {
  const filteredCards = priorityFilter && priorityFilter !== 'all'
    ? cards.filter((card) => card.priority === priorityFilter)
    : cards;

  const handleEditColumn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEditColumn && column) {
      onEditColumn(column);
    }
  };

  const handleDeleteColumn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDeleteColumn && column?.id) {
      onDeleteColumn(column.id);
    }
  };

  if (!column) return null;

  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
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

      <div className={styles.cardsContainer}>
        {filteredCards.map((card, index) => (
            <Card
              key={card.id}
              card={card}
              onEdit={onEditCard}
              onView={onViewCard}
              onDelete={onDeleteCard}
              onMove={(cardId, targetColumnId) => {
                if (onMoveCard && cardId && targetColumnId) {
                  onMoveCard(cardId, column.id, targetColumnId);
                }
            }}
            onMoveButtonClick={(card) => {
              if (onMoveButtonClick && card) {
                onMoveButtonClick(card, column.id);
              }
            }}
            columns={allColumns}
            currentColumnId={column.id}
            isFirstCard={index === 0}
            isLastCard={index === filteredCards.length - 1}
          />
        ))}
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
