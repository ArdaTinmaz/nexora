import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import styles from './HomePage.module.css';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import ScreensPage from '../ScreensPage/ScreensPage';
import { boardApi } from '../../api/boardApi';

function HomePage() {
  const location = useLocation();
  const [boards, setBoards] = useState([]);
  const [isBoardsLoading, setIsBoardsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchBoards = async () => {
      setIsBoardsLoading(true);
      try {
        const data = await boardApi.getBoards();
        if (isMounted) {
          setBoards(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching boards:', error);
        if (isMounted) {
          setBoards([]);
        }
      } finally {
        if (isMounted) {
          setIsBoardsLoading(false);
        }
      }
    };

    fetchBoards();

    return () => {
      isMounted = false;
    };
  }, []);

  // Get current board ID from URL
  const currentBoardId = boards.find(b => 
    location.pathname.includes(encodeURIComponent(b.name))
  )?.id;

  return (
    <div className={styles.homePage}>
      <Sidebar 
        boards={boards} 
        currentBoardId={currentBoardId}
        onBoardsChange={setBoards}
      />
      <main className={styles.mainContent}>
        <Header />
        <div className={styles.contentWrapper}>
          <Routes>
            <Route 
              path=":boardName" 
              element={
                <ScreensPage 
                  boards={boards}
                  onBoardsChange={setBoards}
                  boardsLoading={isBoardsLoading}
                />
              } 
            />
            <Route 
              index 
              element={
                isBoardsLoading ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateText}>Loading your boards...</p>
                  </div>
                ) : boards.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateText}>
                      Before starting your project, it is essential to{' '}
                      <span className={styles.emptyStateAccent}>create a board</span>{' '}
                      to visualize and track all the necessary tasks and milestones. This board serves as a powerful tool to organize the workflow and ensure effective collaboration among team members.
                    </p>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateText}>No board selected</p>
                  </div>
                )
              } 
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default HomePage;
