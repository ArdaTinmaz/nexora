import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';
import NewBoardModal from '../NewBoardModal/NewBoardModal';
import EditBoardModal from '../EditBoardModal/EditBoardModal';
import NeedHelpModal from '../NeedHelpModal/NeedHelpModal';
import { boardApi } from '../../api/boardApi';
import ConfirmModal from '../ConfirmModal/ConfirmModal';

const iconMap = {
  'project': 'icon-Project',
  'star': 'icon-star-04',
  'puzzle': 'icon-puzzle-piece-02',
  'hexagon': 'icon-hexagon-01',
  'lightning': 'icon-icon',
  'container': 'icon-container',
  'ring': 'icon-Ring-Green',
  'ring-blue': 'icon-Ring-blue',
};

function Sidebar({
  boards,
  companyProjects = [],
  currentBoardId,
  currentCompanyProjectId,
  boardsLoading = false,
  companyProjectsLoading = false,
  onBoardsChange,
}) {
  const navigate = useNavigate();
  const [isNewBoardModalOpen, setIsNewBoardModalOpen] = useState(false);
  const [isEditBoardModalOpen, setIsEditBoardModalOpen] = useState(false);
  const [isNeedHelpModalOpen, setIsNeedHelpModalOpen] = useState(false);
  const [boardToEdit, setBoardToEdit] = useState(null);
  const [boardToDelete, setBoardToDelete] = useState(null);
  const [isCompanyOpen, setIsCompanyOpen] = useState(true);
  const [isPersonalOpen, setIsPersonalOpen] = useState(true);

  const handleCreateBoard = () => {
    setIsNewBoardModalOpen(true);
  };

  const handleCreateBoardSubmit = async (boardData) => {
    try {
      const payload = {
        name: boardData.title,
        icon: boardData.icon,
        iconName: boardData.iconName || iconMap[boardData.icon] || 'icon-Project',
        background: boardData.background,
      };
      const createdBoard = await boardApi.createBoard(payload);
      if (!createdBoard?.id) {
        throw new Error('Board response did not include an id.');
      }
      const newBoard = createdBoard;
      onBoardsChange((prev) => [...prev, newBoard]);
      navigate(`/home/${encodeURIComponent(newBoard.name)}`);
    } catch (error) {
      console.error('Error creating board:', error);
    }
  };

  const handleEditBoard = (board, e) => {
    e.stopPropagation();
    setBoardToEdit(board);
    setIsEditBoardModalOpen(true);
  };

  const handleEditCompanyProject = async (project, e) => {
    e.stopPropagation();
    navigate(`/home/company/${project.id}?editBoard=1`);
  };

  const handleEditBoardSubmit = async (boardData) => {
    try {
      const payload = {
        name: boardData.name,
        icon: boardData.icon,
        iconName: boardData.iconName || iconMap[boardData.icon] || 'icon-Project',
        background: boardData.background,
      };
      const updatedBoard = await boardApi.updateBoard(boardData.id, payload);
      if (!updatedBoard?.id) {
        throw new Error('Board update did not return the updated entity.');
      }
      const boardToStore = updatedBoard;
      onBoardsChange((prev) =>
        prev.map((b) => (b.id === boardData.id ? boardToStore : b))
      );

      // Eğer mevcut board yeniden adlandırıldıysa, URL'i yeni isme yönlendir
      if (currentBoardId === boardData.id) {
        navigate(`/home/${encodeURIComponent(boardToStore.name)}`);
      }
    } catch (error) {
      console.error('Error updating board:', error);
    }
  };

  const handleDeleteBoard = async (boardId, e) => {
    e.stopPropagation();
    const target = boards.find((b) => b.id === boardId);
    setBoardToDelete(target || { id: boardId });
  };

  const handleNeedHelp = () => {
    setIsNeedHelpModalOpen(true);
  };

  const handleNeedHelpSubmit = (data) => {
    console.log('Help request:', data);
    // API çağrısı buraya eklenecek
  };

  const handleLogout = () => {
    navigate('/welcome');
  };

  const confirmDeleteBoard = async () => {
    if (!boardToDelete) return;
    try {
      await boardApi.deleteBoard(boardToDelete.id);
      const updatedBoards = boards.filter((b) => b.id !== boardToDelete.id);
      onBoardsChange(updatedBoards);
      if (currentBoardId === boardToDelete.id) {
        if (updatedBoards.length > 0) {
          navigate(`/home/${encodeURIComponent(updatedBoards[0].name)}`);
        } else {
          navigate('/home');
        }
      }
    } catch (error) {
      console.error('Error deleting board:', error);
    } finally {
      setBoardToDelete(null);
    }
  };

  return (
    <>
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.logoContainer}>
          <svg className={styles.logoIcon} width="32" height="32" viewBox="0 0 32 32">
            <use href="/sprites.svg#icon-icon"></use>
          </svg>
          <span className={styles.logoText}>Nexora</span>
        </div>

        {/* Projects section */}
        <div className={styles.boardsSection}>
          <div className={styles.sectionBlock}>
            <button
              className={`${styles.sectionToggle} ${isCompanyOpen ? styles.sectionOpen : ''}`}
              type="button"
              onClick={() => setIsCompanyOpen((prev) => !prev)}
              aria-expanded={isCompanyOpen}
            >
              <span className={styles.sectionTitle}>Company projects</span>
              <span className={styles.sectionChevron} />
            </button>

            {isCompanyOpen && (
              <>
                {companyProjectsLoading ? (
                  <p className={styles.sectionEmpty}>Loading company projects...</p>
                ) : companyProjects.length > 0 ? (
                  <ul className={styles.boardList}>
                    {companyProjects.map((project) => {
                      const roleValue = String(project.role || '').toLowerCase();
                      const canEdit = typeof project.canEdit === 'boolean'
                        ? project.canEdit
                        : ['team_leader', 'admin'].includes(roleValue);
                      return (
                        <li
                          key={project.id}
                          className={`${styles.boardItem} ${styles.companyItem} ${
                            currentCompanyProjectId === project.id ? styles.active : ''
                          }`}
                          onClick={() => navigate(`/home/company/${project.id}`)}
                        >
                          <div className={styles.boardIcon}>
                            <svg width="18" height="18" viewBox="0 0 32 32">
                              <use href={`/sprites.svg#${project.iconName || iconMap[project.icon] || 'icon-Project'}`}></use>
                            </svg>
                          </div>
                          <span className={styles.boardName}>{project.name}</span>
                          {canEdit && (
                            <div className={styles.boardActions}>
                              <button
                                className={styles.boardActionBtn}
                                type="button"
                                onClick={(e) => handleEditCompanyProject(project, e)}
                              >
                                <svg width="16" height="16" viewBox="0 0 32 32">
                                  <use href="/sprites.svg#icon-pencil-01"></use>
                                </svg>
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className={styles.sectionEmpty}>No company projects assigned.</p>
                )}
              </>
            )}
          </div>

          <div className={styles.sectionBlock}>
            <button
              className={`${styles.sectionToggle} ${isPersonalOpen ? styles.sectionOpen : ''}`}
              type="button"
              onClick={() => setIsPersonalOpen((prev) => !prev)}
              aria-expanded={isPersonalOpen}
            >
              <span className={styles.sectionTitle}>My boards</span>
              <span className={styles.sectionChevron} />
            </button>

            {isPersonalOpen && (
              <>
                <button 
                  className={styles.createBoardBtn}
                  onClick={handleCreateBoard}
                  type="button"
                >
                  <span className={styles.createBoardText}>Create a new board</span>
                  <div className={styles.plusIconContainer}>
                    <svg className={styles.plusIcon} width="20" height="20" viewBox="0 0 32 32">
                      <use href="/sprites.svg#icon-big-plus"></use>
                    </svg>
                  </div>
                </button>

                {boardsLoading ? (
                  <p className={styles.sectionEmpty}>Loading your boards...</p>
                ) : boards.length > 0 ? (
                  <ul className={styles.boardList}>
                    {boards.map((board) => (
                      <li 
                        key={board.id} 
                        className={`${styles.boardItem} ${
                          currentBoardId === board.id ? styles.active : ''
                        }`}
                        onClick={() => navigate(`/home/${encodeURIComponent(board.name)}`)}
                      >
                        <div className={styles.boardIcon}>
                          <svg width="18" height="18" viewBox="0 0 32 32">
                            <use href={`/sprites.svg#${board.iconName || iconMap[board.icon] || 'icon-Project'}`}></use>
                          </svg>
                        </div>
                        <span className={styles.boardName}>{board.name}</span>
                        <div className={styles.boardActions}>
                          <button 
                            className={styles.boardActionBtn} 
                            type="button"
                            onClick={(e) => handleEditBoard(board, e)}
                          >
                            <svg width="16" height="16" viewBox="0 0 32 32">
                              <use href="/sprites.svg#icon-pencil-01"></use>
                            </svg>
                          </button>
                          <button 
                            className={styles.boardActionBtn} 
                            type="button"
                            onClick={(e) => handleDeleteBoard(board.id, e)}
                          >
                            <svg width="16" height="16" viewBox="0 0 32 32">
                              <use href="/sprites.svg#icon-trash-04"></use>
                            </svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.sectionEmpty}>No personal boards yet.</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className={styles.footerActions}>
          <button 
            className={styles.logoutBtn}
            onClick={handleLogout}
            type="button"
          >
            <svg className={styles.logoutIcon} width="32" height="32" viewBox="0 0 32 32">
              <use href="/sprites.svg#icon-login"></use>
            </svg>
            <span className={styles.logoutText}>Log out</span>
          </button>
          <button
            className={styles.helpIconBtn}
            type="button"
            onClick={handleNeedHelp}
            aria-label="Need help"
          >
            <svg className={styles.helpIconLarge} width="28" height="28" viewBox="0 0 32 32">
              <use href="/sprites.svg#icon-help-circle"></use>
            </svg>
          </button>
        </div>
      </aside>

      {/* Modals */}
      <NewBoardModal
        isOpen={isNewBoardModalOpen}
        onClose={() => setIsNewBoardModalOpen(false)}
        onCreate={handleCreateBoardSubmit}
      />
      <EditBoardModal
        isOpen={isEditBoardModalOpen}
        onClose={() => setIsEditBoardModalOpen(false)}
        onEdit={handleEditBoardSubmit}
        board={boardToEdit}
      />
      <NeedHelpModal
        isOpen={isNeedHelpModalOpen}
        onClose={() => setIsNeedHelpModalOpen(false)}
        onSubmit={handleNeedHelpSubmit}
      />

      <ConfirmModal
        isOpen={Boolean(boardToDelete)}
        title="Delete board"
        message={`Are you sure you want to delete "${boardToDelete?.name || 'this board'}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteBoard}
        onCancel={() => setBoardToDelete(null)}
      />
    </>
  );
}

export default Sidebar;
