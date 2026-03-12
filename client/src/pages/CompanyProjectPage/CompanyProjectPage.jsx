import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import styles from './CompanyProjectPage.module.css';
import FiltersModal from '../../components/FiltersModal/FiltersModal';
import AddColumnModal from '../../components/AddColumnModal/AddColumnModal';
import EditColumnModal from '../../components/EditColumnModal/EditColumnModal';
import AddCardModal from '../../components/AddCardModal/AddCardModal';
import EditCardModal from '../../components/EditCardModal/EditCardModal';
import MoveCardModal from '../../components/MoveCardModal/MoveCardModal';
import Column from '../../components/Column/Column';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import CardDetailsModal from '../../components/CardDetailsModal/CardDetailsModal';
import { backgroundImageStyle, spriteHref } from '../../utils/assets';
import EditBoardModal from '../../components/EditBoardModal/EditBoardModal';
import { companyBoardApi } from '../../api/companyBoardApi';
import { getSession } from '../../desktop/session';

function CompanyProjectPage({ projects = [], loading = false, onProjectsChange }) {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [role, setRole] = useState('');
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [isEditBoardModalOpen, setIsEditBoardModalOpen] = useState(false);
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [dragColumnId, setDragColumnId] = useState('');
  const [dragCard, setDragCard] = useState(null);
  const [columnDropTargetId, setColumnDropTargetId] = useState('');
  const [cardDropTargetId, setCardDropTargetId] = useState('');

  const canManage = role === 'team_leader' || role === 'admin';

  const getCardAssigneeNames = useCallback((card) => {
    if (Array.isArray(card?.assignees) && card.assignees.length) {
      return card.assignees
        .map((assignee) => String(assignee?.name || '').trim())
        .filter(Boolean);
    }
    const fallback = String(card?.ownerName || '').trim();
    return fallback ? [fallback] : [];
  }, []);

  const assigneeOptions = useMemo(() => {
    const names = new Set();
    columns.forEach((column) => {
      (column.cards || []).forEach((card) => {
        getCardAssigneeNames(card).forEach((name) => names.add(name));
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [columns, getCardAssigneeNames]);

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

  const matchesCardFilters = useCallback(
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
        const assigneeNames = getCardAssigneeNames(card);
        if (cardFilters.assignee === 'unassigned') {
          if (assigneeNames.length) return false;
        } else if (!assigneeNames.includes(cardFilters.assignee)) {
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
    [cardFilters, getCardAssigneeNames]
  );

  const loadBoard = useCallback(async () => {
    if (!projectId) {
      setBoard(null);
      setColumns([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const boardWithColumns = await companyBoardApi.getBoard(projectId);
      setBoard(boardWithColumns);
      setColumns(boardWithColumns.columns || []);
      setRole(boardWithColumns.role || '');
      setErrorMsg('');
    } catch (error) {
      console.error('Error loading company board:', error);
      setBoard(null);
      setColumns([]);
      setRole('');
      setErrorMsg(error.message || 'Board not found');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (searchParams.get('editBoard') === '1' && canManage) {
      setIsEditBoardModalOpen(true);
    }
  }, [searchParams, canManage]);

  useEffect(() => {
    getSession('user')
      .then((session) => {
        setCurrentUserId(session?.user?.id || '');
      })
      .catch(() => {
        setCurrentUserId('');
      });
  }, []);

  const closeEditBoardModal = () => {
    setIsEditBoardModalOpen(false);
    if (searchParams.get('editBoard')) {
      const next = new URLSearchParams(searchParams);
      next.delete('editBoard');
      setSearchParams(next, { replace: true });
    }
  };

  const handleCreateColumn = async (columnData) => {
    if (!projectId) return;
    try {
      const newColumn = await companyBoardApi.createColumn(projectId, columnData);
      setColumns((prev) => [...prev, newColumn]);
      setIsAddColumnModalOpen(false);
    } catch (error) {
      console.error('Error creating column:', error);
    }
  };

  const handleEditColumn = async (columnData) => {
    if (!projectId) return;
    try {
      const updatedColumn = await companyBoardApi.updateColumn(
        projectId,
        columnData.id,
        { title: columnData.title }
      );
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

  const handleEditBoardSubmit = async (boardData) => {
    if (!projectId) return;
    try {
      const payload = {
        icon: boardData.icon,
        iconName: boardData.iconName,
        background: boardData.background,
      };
      const updated = await companyBoardApi.updateBoard(projectId, payload);
      setBoard((prev) => ({ ...(prev || {}), ...(updated || {}) }));
      if (onProjectsChange && updated) {
        onProjectsChange((prev) =>
          prev.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  icon: updated.icon ?? project.icon,
                  iconName: updated.iconName ?? project.iconName,
                  background: updated.background ?? project.background,
                }
              : project
          )
        );
      }
      closeEditBoardModal();
    } catch (error) {
      console.error('Error updating board:', error);
    }
  };

  const handleDeleteColumn = async (columnId) => {
    if (!projectId) return;
    try {
      await companyBoardApi.deleteColumn(projectId, columnId);
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
    if (!projectId || !selectedColumn) return;
    try {
      const newCard = await companyBoardApi.createCard(projectId, selectedColumn, cardData);
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
    if (!projectId) return;
    try {
      const column = columns.find((col) => col.cards?.some((c) => c.id === cardData.id));
      if (!column) return;

      const updatedCard = await companyBoardApi.updateCard(
        projectId,
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
    if (!projectId) return;
    try {
      const column = columns.find((col) => col.cards?.some((c) => c.id === cardId));
      if (!column) return;

      await companyBoardApi.deleteCard(projectId, column.id, cardId);
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

  const handleMoveCard = async (cardId, fromColumnId, toColumnId, toIndex) => {
    if (!projectId) return;
    try {
      await companyBoardApi.moveCard(projectId, fromColumnId, toColumnId, cardId, toIndex);
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
    if (!projectId || !card?.id || !columnId) return;
    try {
      const updated = await companyBoardApi.setCardCompletion(
        projectId,
        columnId,
        card.id,
        completed
      );
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

  const handleToggleCardOwnership = async (card, columnId, action) => {
    if (!projectId || !card?.id || !columnId) return;
    try {
      const updated = await companyBoardApi.setCardOwnership(
        projectId,
        columnId,
        card.id,
        action
      );
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
      console.error('Error updating card ownership:', error);
    }
  };

  const handleColumnDragStart = (columnId) => {
    if (!canManage) return;
    setDragColumnId(columnId);
  };

  const handleColumnDragEnd = () => {
    setDragColumnId('');
    setColumnDropTargetId('');
  };

  const handleColumnDragOver = (event, columnId) => {
    if (!canManage || !dragColumnId) return;
    event.preventDefault();
    setColumnDropTargetId(columnId);
  };

  const handleColumnDrop = async (event, targetColumnId) => {
    event.preventDefault();
    if (!canManage || !dragColumnId || dragColumnId === targetColumnId || !projectId) {
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
      await companyBoardApi.reorderColumns(projectId, next.map((col) => col.id));
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

  const requestDeleteColumn = (columnId) => {
    setColumnToDelete(columnId);
  };

  const requestDeleteCard = (cardId) => {
    setCardToDelete(cardId);
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

  const projectName = projects.find((item) => item.id === projectId)?.name || board?.name;
  const boardIconName = board?.iconName || 'icon-Project';

  if (loading || isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!projectId || !board) {
    return (
      <div className={styles.error}>
        <p>{errorMsg || 'Board not found'}</p>
      </div>
    );
  }

  const boardBackgroundStyle = board.background
    ? {
        ...backgroundImageStyle(`images/TaskProDesktop/${board.background}`),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }
    : {};

  return (
    <div className={styles.screensPage} style={boardBackgroundStyle}>
      <div className={styles.boardHeader}>
        <div className={styles.boardHeading}>
          <div className={styles.boardIcon}>
            <svg width="20" height="20" viewBox="0 0 32 32">
              <use href={spriteHref(boardIconName)}></use>
            </svg>
          </div>
          <h1 className={styles.boardTitle}>{projectName || board.name}</h1>
        </div>
        <button
          className={styles.filtersBtn}
          type="button"
          onClick={() => setIsFiltersModalOpen(true)}
        >
          <svg className={styles.filterIcon} width="20" height="20" viewBox="0 0 32 32">
            <use href={spriteHref('icon-Filter-White')}></use>
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
              canManage={canManage}
              currentUserId={currentUserId}
              onEditColumn={canManage ? (col) => {
                setSelectedColumnForEdit(col);
                setIsEditColumnModalOpen(true);
              } : null}
              onDeleteColumn={canManage ? requestDeleteColumn : null}
              onAddCard={canManage ? handleAddCard : null}
              onEditCard={canManage ? handleEditCard : null}
              onViewCard={(card) => setCardDetails(card)}
              onDeleteCard={canManage ? requestDeleteCard : null}
              onMoveButtonClick={(card) => {
                setCardToMove(card);
                setCardToMoveColumnId(column.id);
                setIsMoveCardModalOpen(true);
              }}
              onToggleCardCompletion={handleToggleCardCompletion}
              onToggleCardOwnership={handleToggleCardOwnership}
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
          {canManage && (
            <button
              className={styles.addColumnBtn}
              type="button"
              onClick={() => setIsAddColumnModalOpen(true)}
            >
              <div className={styles.addColumnIconContainer}>
                <svg className={styles.addColumnIcon} width="18" height="18" viewBox="0 0 32 32">
                  <use href={spriteHref('icon-big-plus')}></use>
                </svg>
              </div>
              <span>Add another column</span>
            </button>
          )}
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

      {canManage && (
        <EditBoardModal
          isOpen={isEditBoardModalOpen}
          onClose={closeEditBoardModal}
          onEdit={handleEditBoardSubmit}
          board={board}
          disableTitle
        />
      )}

      {canManage && (
        <>
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
        </>
      )}

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

export default CompanyProjectPage;
