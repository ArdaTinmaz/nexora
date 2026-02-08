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
import { AUTH_STORAGE_KEY } from '../../config';

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
  const [cardFilters, setCardFilters] = useState({
    title: '',
    dateFrom: '',
    dateTo: '',
    status: 'all',
    assignee: 'all',
    priority: 'all',
  });
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  const [dragColumnId, setDragColumnId] = useState('');
  const [dragCard, setDragCard] = useState(null);
  const [columnDropTargetId, setColumnDropTargetId] = useState('');
  const [cardDropTargetId, setCardDropTargetId] = useState('');

  const canManage = true;

  const assigneeOptions = React.useMemo(() => {
    const names = new Set();
    columns.forEach((column) => {
      (column.cards || []).forEach((card) => {
        if (card.ownerName && card.ownerName.trim()) {
          names.add(card.ownerName.trim());
        }
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [columns]);

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

  const matchesCardFilters = React.useCallback(
    (card) => {
      const query = cardFilters.title.trim().toLowerCase();
      if (query) {
        const title = String(card.title || '').toLowerCase();
        if (!title.includes(query)) return false;
      }

      if (cardFilters.priority && cardFilters.priority !== 'all') {
        if (card.priority !== cardFilters.priority) return false;
      }

      if (cardFilters.status && cardFilters.status !== 'all') {
        const cardStatus = card.completed ? 'completed' : 'in-progress';
        if (cardStatus !== cardFilters.status) return false;
      }

      if (cardFilters.assignee && cardFilters.assignee !== 'all') {
        if (cardFilters.assignee === 'unassigned') {
          if (card.ownerName && String(card.ownerName).trim()) return false;
        } else if ((card.ownerName || '').trim() !== cardFilters.assignee) {
          return false;
        }
      }

      const dateFrom = toDateObject(cardFilters.dateFrom);
      const dateTo = toDateObject(cardFilters.dateTo);
      if (dateFrom || dateTo) {
        const deadline = toDateObject(card.deadline);
        if (!deadline) return false;
        if (dateFrom && deadline < dateFrom) return false;
        if (dateTo) {
          const endOfDay = new Date(dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (deadline > endOfDay) return false;
        }
      }

      return true;
    },
    [cardFilters]
  );

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

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      setCurrentUserId(parsed?.user?.id || '');
    } catch {
      setCurrentUserId('');
    }
  }, []);

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

  const handleMoveCard = async (cardId, fromColumnId, toColumnId, toIndex) => {
    if (!board) return;
    try {
      await boardApi.moveCard(board.id, fromColumnId, toColumnId, cardId, toIndex);
      setColumns((prev) => {
        if (fromColumnId === toColumnId) {
          return prev.map((col) => {
            if (col.id !== fromColumnId) return col;
            const source = [...(col.cards || [])];
            const fromIndex = source.findIndex((c) => c.id === cardId);
            if (fromIndex === -1) return col;
            const [moving] = source.splice(fromIndex, 1);
            const insertIndex = Number.isInteger(toIndex)
              ? Math.max(0, Math.min(toIndex, source.length))
              : source.length;
            source.splice(insertIndex, 0, moving);
            return { ...col, cards: source };
          });
        }

        let movingCard = null;
        const withoutSource = prev.map((col) => {
          if (col.id !== fromColumnId) return col;
          const sourceCards = [...(col.cards || [])];
          const fromIndex = sourceCards.findIndex((c) => c.id === cardId);
          if (fromIndex !== -1) {
            [movingCard] = sourceCards.splice(fromIndex, 1);
          }
          return { ...col, cards: sourceCards };
        });

        if (!movingCard) return prev;

        return withoutSource.map((col) => {
          if (col.id !== toColumnId) return col;
          const nextCards = [...(col.cards || [])];
          const insertIndex = Number.isInteger(toIndex)
            ? Math.max(0, Math.min(toIndex, nextCards.length))
            : nextCards.length;
          nextCards.splice(insertIndex, 0, { ...movingCard, columnId: toColumnId });
          return { ...col, cards: nextCards };
        });
      });
      setIsMoveCardModalOpen(false);
      setCardToMove(null);
      setCardToMoveColumnId(null);
    } catch (error) {
      console.error('Error moving card:', error);
    }
  };

  const handleToggleCardCompletion = async (card, columnId, completed) => {
    if (!board || !card?.id || !columnId) return;
    try {
      const updated = await boardApi.setCardCompletion(board.id, columnId, card.id, completed);
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          cards: (col.cards || []).map((item) =>
            item.id === card.id ? { ...item, ...(updated || {}) } : item
          ),
        }))
      );
      if (cardDetails?.id === card.id) {
        setCardDetails((prev) => ({ ...(prev || {}), ...(updated || {}) }));
      }
    } catch (error) {
      console.error('Error updating card completion:', error);
    }
  };

  const handleColumnDragStart = (columnId) => {
    setDragColumnId(columnId);
  };

  const handleColumnDragEnd = () => {
    setDragColumnId('');
    setColumnDropTargetId('');
  };

  const handleColumnDragOver = (event, columnId) => {
    if (!dragColumnId) return;
    event.preventDefault();
    setColumnDropTargetId(columnId);
  };

  const handleColumnDrop = async (event, targetColumnId) => {
    event.preventDefault();
    if (!dragColumnId || dragColumnId === targetColumnId || !board) {
      setDragColumnId('');
      setColumnDropTargetId('');
      return;
    }

    const previous = columns;
    const sourceIndex = previous.findIndex((col) => col.id === dragColumnId);
    const targetIndex = previous.findIndex((col) => col.id === targetColumnId);
    if (sourceIndex === -1 || targetIndex === -1) {
      setDragColumnId('');
      setColumnDropTargetId('');
      return;
    }

    const next = [...previous];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setColumns(next);
    setDragColumnId('');
    setColumnDropTargetId('');

    try {
      await boardApi.reorderColumns(board.id, next.map((col) => col.id));
    } catch (error) {
      console.error('Error reordering columns:', error);
      setColumns(previous);
    }
  };

  const handleCardDragStart = (card, fromColumnId) => {
    if (!card?.id || !fromColumnId) return;
    setDragCard({ cardId: card.id, fromColumnId });
  };

  const handleCardDragEnd = () => {
    setDragCard(null);
    setCardDropTargetId('');
  };

  const handleCardDragOver = (event, targetColumnId) => {
    if (!dragCard?.cardId) return;
    event.preventDefault();
    setCardDropTargetId(targetColumnId);
  };

  const handleCardDrop = async (targetColumnId, targetIndex) => {
    if (!dragCard?.cardId || !dragCard?.fromColumnId || !targetColumnId) {
      setDragCard(null);
      setCardDropTargetId('');
      return;
    }

    const { cardId, fromColumnId } = dragCard;
    setDragCard(null);
    setCardDropTargetId('');
    let nextIndex = Number.isInteger(targetIndex) ? targetIndex : undefined;

    if (fromColumnId === targetColumnId && Number.isInteger(nextIndex)) {
      const sourceCards = columns.find((col) => col.id === fromColumnId)?.cards || [];
      const fromIndex = sourceCards.findIndex((card) => card.id === cardId);
      if (fromIndex === -1) return;
      const maxIndex = sourceCards.length - 1;
      const boundedIndex = Math.max(0, Math.min(nextIndex, maxIndex + 1));
      const normalizedIndex = fromIndex < boundedIndex ? boundedIndex - 1 : boundedIndex;
      if (normalizedIndex === fromIndex) return;
      nextIndex = normalizedIndex;
    }

    await handleMoveCard(cardId, fromColumnId, targetColumnId, nextIndex);
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
              onMoveButtonClick={handleMoveButtonClick}
              currentUserId={currentUserId}
              canManage={canManage}
              onToggleCardCompletion={handleToggleCardCompletion}
              onColumnDragStart={handleColumnDragStart}
              onColumnDragEnd={handleColumnDragEnd}
              onColumnDragOver={handleColumnDragOver}
              onColumnDrop={handleColumnDrop}
              isColumnDragTarget={columnDropTargetId === column.id}
              onCardDragStart={handleCardDragStart}
              onCardDragEnd={handleCardDragEnd}
              onCardDragOver={handleCardDragOver}
              onCardDrop={handleCardDrop}
              isCardDropTarget={cardDropTargetId === column.id}
              dragCard={dragCard}
              allColumns={columns}
              priorityFilter="all"
              cardFilterFn={matchesCardFilters}
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
        advanced
        filters={cardFilters}
        assigneeOptions={assigneeOptions}
        onApplyFilters={setCardFilters}
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
