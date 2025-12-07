import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import styles from './ScreensPage.module.css';
import FiltersModal from '../../components/FiltersModal/FiltersModal';
import AddColumnModal from '../../components/AddColumnModal/AddColumnModal';
import EditColumnModal from '../../components/EditColumnModal/EditColumnModal';
import AddCardModal from '../../components/AddCardModal/AddCardModal';
import EditCardModal from '../../components/EditCardModal/EditCardModal';
import MoveCardModal from '../../components/MoveCardModal/MoveCardModal';
import Column from '../../components/Column/Column';
import { boardApi } from '../../api/boardApi';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import CardDetailsModal from '../../components/CardDetailsModal/CardDetailsModal';

function ScreensPage({ boards = [], onBoardsChange, boardsLoading = false }) {
  const { boardName } = useParams();
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isEditColumnModalOpen, setIsEditColumnModalOpen] = useState(false);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isEditCardModalOpen, setIsEditCardModalOpen] = useState(false);
  const [isMoveCardModalOpen, setIsMoveCardModalOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedColumnForEdit, setSelectedColumnForEdit] = useState(null);
  const [columnToDelete, setColumnToDelete] = useState(null);
  const [cardToDelete, setCardToDelete] = useState(null);
  const [cardDetails, setCardDetails] = useState(null);
  const [cardToMove, setCardToMove] = useState(null);
  const [cardToMoveColumnId, setCardToMoveColumnId] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadBoard = useCallback(async () => {
    if (!boardName) {
      setBoard(null);
      setColumns([]);
      setLoading(false);
      return;
    }

    const boardMeta = boards.find((b) => b.name === boardName);

    if (!boardMeta) {
      if (!boardsLoading) {
        setBoard(null);
        setColumns([]);
        setLoading(false);
      } else {
        setLoading(true);
      }
      return;
    }

    try {
      setLoading(true);
      const boardWithColumns = await boardApi.getBoard(boardMeta.id);
      setBoard(boardWithColumns);
      setColumns(boardWithColumns.columns || []);
    } catch (error) {
      console.error('Error loading board:', error);
      setBoard(null);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  }, [boardName, boards, boardsLoading]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const updateBoardsList = useCallback(
    (updater) => {
      if (!onBoardsChange) return;
      onBoardsChange((prevBoards) => {
        if (typeof updater === 'function') {
          return updater(prevBoards);
        }
        return updater;
      });
    },
    [onBoardsChange]
  );

  const handleBackgroundChange = async (background) => {
    if (!board) return;
    try {
      const result = await boardApi.updateBoardBackground(board.id, background);
      const updatedBoard = {
        ...board,
        background: result?.background ?? background,
      };
      setBoard(updatedBoard);
      updateBoardsList((prevBoards) =>
        prevBoards.map((b) =>
          b.id === board.id ? { ...b, background: updatedBoard.background } : b
        )
      );
    } catch (error) {
      console.error('Error updating background:', error);
    }
  };

  const handleCreateColumn = async (columnData) => {
    if (!board) return;
    try {
      const newColumn = await boardApi.createColumn(board.id, columnData);
      setColumns((prev) => [...prev, newColumn]);
      setIsAddColumnModalOpen(false);
    } catch (error) {
      console.error('Error creating column:', error);
    }
  };

  const handleEditColumn = async (columnData) => {
    if (!board) return;
    try {
      const updatedColumn = await boardApi.updateColumn(board.id, columnData.id, {
        title: columnData.title,
      });
      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnData.id ? { ...col, ...(updatedColumn || {}) } : col
        )
      );
      setIsEditColumnModalOpen(false);
      setSelectedColumnForEdit(null);
    } catch (error) {
      console.error('Error updating column:', error);
    }
  };

  const handleDeleteColumn = async (columnId) => {
    if (!board) return;
    try {
      await boardApi.deleteColumn(board.id, columnId);
      setColumns((prev) => prev.filter((col) => col.id !== columnId));
    } catch (error) {
      console.error('Error deleting column:', error);
    }
  };

  const handleAddCard = (columnId) => {
    setSelectedColumn(columnId);
    setIsAddCardModalOpen(true);
  };

  const handleCreateCard = async (cardData) => {
    if (!board || !selectedColumn) return;
    try {
      const newCard = await boardApi.createCard(board.id, selectedColumn, cardData);
      setColumns((prev) =>
        prev.map((col) => {
          if (col.id === selectedColumn) {
            return { ...col, cards: [...(col.cards || []), newCard] };
          }
          return col;
        })
      );
      setIsAddCardModalOpen(false);
      setSelectedColumn(null);
    } catch (error) {
      console.error('Error creating card:', error);
    }
  };

  const handleEditCard = (card) => {
    setSelectedCard(card);
    setIsEditCardModalOpen(true);
  };

  const handleUpdateCard = async (cardData) => {
    if (!board) return;
    try {
      const column = columns.find((col) => col.cards?.some((c) => c.id === cardData.id));
      if (!column) return;

      const updatedCard = await boardApi.updateCard(
        board.id,
        column.id,
        cardData.id,
        cardData
      );
      const nextCard = updatedCard || cardData;
      setColumns((prev) =>
        prev.map((col) => {
          if (col.id === column.id) {
            return {
              ...col,
              cards: col.cards.map((c) => (c.id === nextCard.id ? nextCard : c)),
            };
          }
          return col;
        })
      );
      setIsEditCardModalOpen(false);
      setSelectedCard(null);
    } catch (error) {
      console.error('Error updating card:', error);
    }
  };

  const handleDeleteCard = async (cardId) => {
    if (!board) return;
    try {
      const column = columns.find((col) => col.cards?.some((c) => c.id === cardId));
      if (!column) return;

      await boardApi.deleteCard(board.id, column.id, cardId);
      setColumns((prev) =>
        prev.map((col) => {
          if (col.id === column.id) {
            return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
          }
          return col;
        })
      );
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const requestDeleteColumn = (columnId) => setColumnToDelete(columnId);
  const requestDeleteCard = (cardId) => setCardToDelete(cardId);

  const handleMoveButtonClick = (card, columnId) => {
    setCardToMove(card);
    setCardToMoveColumnId(columnId);
    setIsMoveCardModalOpen(true);
  };

  const confirmDeleteColumn = async () => {
    if (!columnToDelete) return;
    await handleDeleteColumn(columnToDelete);
    setColumnToDelete(null);
  };

  const confirmDeleteCard = async () => {
    if (!cardToDelete) return;
    await handleDeleteCard(cardToDelete);
    setCardToDelete(null);
  };

  const columnTitleToDelete = columns.find((c) => c.id === columnToDelete)?.title;
  const cardTitleToDelete = columns
    .flatMap((col) => col.cards || [])
    .find((c) => c.id === cardToDelete)?.title;

  const handleMoveCard = async (cardId, fromColumnId, toColumnId) => {
    if (!board) return;
    try {
      await boardApi.moveCard(board.id, fromColumnId, toColumnId, cardId);
      const movingCard = columns
        .find((col) => col.id === fromColumnId)
        ?.cards?.find((c) => c.id === cardId);
      if (!movingCard) return;

      setColumns((prev) =>
        prev.map((col) => {
          if (col.id === fromColumnId) {
            return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
          }
          if (col.id === toColumnId) {
            return { ...col, cards: [...(col.cards || []), movingCard] };
          }
          return col;
        })
      );
      setIsMoveCardModalOpen(false);
      setCardToMove(null);
      setCardToMoveColumnId(null);
    } catch (error) {
      console.error('Error moving card:', error);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!boardName || !board) {
    return (
      <div className={styles.error}>
        <p>Board not found</p>
      </div>
    );
  }

  const boardBackgroundStyle = board.background
    ? {
        backgroundImage: `url(${process.env.PUBLIC_URL}/images/TaskProDesktop/${board.background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }
    : {};

  return (
    <div className={styles.screensPage} style={boardBackgroundStyle}>
      <div className={styles.boardHeader}>
        <h1 className={styles.boardTitle}>{board.name}</h1>
        <button
          className={styles.filtersBtn}
          type="button"
          onClick={() => setIsFiltersModalOpen(true)}
        >
          <svg className={styles.filterIcon} width="20" height="20" viewBox="0 0 32 32">
            <use href="/sprites.svg#icon-Filter-White"></use>
          </svg>
          <span>Filters</span>
        </button>
      </div>
      <div className={styles.mainDashboard}>
        <div className={styles.columnsContainer}>
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              cards={column.cards || []}
              onEditColumn={(col) => {
                setSelectedColumnForEdit(col);
                setIsEditColumnModalOpen(true);
              }}
              onDeleteColumn={requestDeleteColumn}
              onAddCard={handleAddCard}
              onEditCard={handleEditCard}
              onViewCard={(card) => setCardDetails(card)}
              onDeleteCard={requestDeleteCard}
              onMoveCard={handleMoveCard}
              onMoveButtonClick={handleMoveButtonClick}
              allColumns={columns}
              priorityFilter={priorityFilter}
            />
          ))}
          <button
            className={styles.addColumnBtn}
            type="button"
            onClick={() => setIsAddColumnModalOpen(true)}
          >
            <div className={styles.addColumnIconContainer}>
              <svg className={styles.addColumnIcon} width="18" height="18" viewBox="0 0 32 32">
                <use href="/sprites.svg#icon-big-plus"></use>
              </svg>
            </div>
            <span>Add another column</span>
          </button>
        </div>
      </div>

      <FiltersModal
        isOpen={isFiltersModalOpen}
        onClose={() => setIsFiltersModalOpen(false)}
        selectedPriority={priorityFilter}
        onPriorityChange={setPriorityFilter}
      />
      <AddColumnModal
        isOpen={isAddColumnModalOpen}
        onClose={() => setIsAddColumnModalOpen(false)}
        onCreate={handleCreateColumn}
      />
      <EditColumnModal
        isOpen={isEditColumnModalOpen}
        onClose={() => {
          setIsEditColumnModalOpen(false);
          setSelectedColumnForEdit(null);
        }}
        onEdit={handleEditColumn}
        column={selectedColumnForEdit}
      />
      <AddCardModal
        isOpen={isAddCardModalOpen}
        onClose={() => {
          setIsAddCardModalOpen(false);
          setSelectedColumn(null);
        }}
        onCreate={handleCreateCard}
      />
      <EditCardModal
        isOpen={isEditCardModalOpen}
        onClose={() => {
          setIsEditCardModalOpen(false);
          setSelectedCard(null);
        }}
        onEdit={handleUpdateCard}
        card={selectedCard}
      />
      <MoveCardModal
        isOpen={isMoveCardModalOpen}
        onClose={() => {
          setIsMoveCardModalOpen(false);
          setCardToMove(null);
          setCardToMoveColumnId(null);
        }}
        onMove={(targetColumnId) => {
          if (cardToMove && cardToMoveColumnId) {
            handleMoveCard(cardToMove.id, cardToMoveColumnId, targetColumnId);
          }
        }}
        columns={columns}
        currentColumnId={cardToMoveColumnId}
        cardTitle={cardToMove?.title}
      />

      <ConfirmModal
        isOpen={Boolean(columnToDelete)}
        title="Delete column"
        message={`Are you sure you want to delete "${columnTitleToDelete || 'this column'}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteColumn}
        onCancel={() => setColumnToDelete(null)}
      />

      <ConfirmModal
        isOpen={Boolean(cardToDelete)}
        title="Delete card"
        message={`Are you sure you want to delete "${cardTitleToDelete || 'this card'}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteCard}
        onCancel={() => setCardToDelete(null)}
      />

      <CardDetailsModal
        isOpen={Boolean(cardDetails)}
        onClose={() => setCardDetails(null)}
        card={cardDetails}
      />
    </div>
  );
}

export default ScreensPage;
