import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, matchPath } from 'react-router-dom';
import styles from './HomePage.module.css';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import ScreensPage from '../ScreensPage/ScreensPage';
import { boardApi } from '../../api/boardApi';
import { projectApi } from '../../api/projectApi';
import ChatWidgetLite from '../../realtime/ChatWidgetLite';
import CompanyProjectPage from '../CompanyProjectPage/CompanyProjectPage';
import TasksPage from '../TasksPage/TasksPage';

function HomePage() {
  const location = useLocation();
  const [boards, setBoards] = useState([]);
  const [isBoardsLoading, setIsBoardsLoading] = useState(true);
  const [companyProjects, setCompanyProjects] = useState([]);
  const [isCompanyLoading, setIsCompanyLoading] = useState(true);

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

    const fetchCompanyProjects = async () => {
      setIsCompanyLoading(true);
      try {
        const data = await projectApi.listAssigned();
        if (isMounted) {
          setCompanyProjects(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching company projects:', error);
        if (isMounted) {
          setCompanyProjects([]);
        }
      } finally {
        if (isMounted) {
          setIsCompanyLoading(false);
        }
      }
    };

    fetchBoards();
    fetchCompanyProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  // Get current board ID from URL
  const companyMatch = matchPath('/home/company/:projectId', location.pathname);
  const currentCompanyProjectId = companyMatch?.params?.projectId || null;
  const currentBoardId = companyMatch
    ? null
    : boards.find((b) => location.pathname.includes(encodeURIComponent(b.name)))?.id;

  return (
    <div className={styles.homePage}>
      <Sidebar 
        boards={boards} 
        companyProjects={companyProjects}
        currentBoardId={currentBoardId}
        currentCompanyProjectId={currentCompanyProjectId}
        boardsLoading={isBoardsLoading}
        companyProjectsLoading={isCompanyLoading}
        onBoardsChange={setBoards}
      />
      <main className={styles.mainContent}>
        <Header />
        <div className={styles.contentWrapper}>
          <Routes>
            <Route
              path="tasks"
              element={<TasksPage companyProjects={companyProjects} />}
            />
            <Route
              path="company/:projectId"
              element={
                <CompanyProjectPage
                  projects={companyProjects}
                  loading={isCompanyLoading}
                  onProjectsChange={setCompanyProjects}
                />
              }
            />
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
                isBoardsLoading || isCompanyLoading ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateText}>Loading your projects...</p>
                  </div>
                ) : boards.length === 0 && companyProjects.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateText}>
                      Before starting your project, it is essential to{' '}
                      <span className={styles.emptyStateAccent}>create a board</span>{' '}
                      to visualize and track all the necessary tasks and milestones. This board serves as a powerful tool to organize the workflow and ensure effective collaboration among team members.
                    </p>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateText}>No project selected</p>
                  </div>
                )
              } 
            />
          </Routes>
        </div>
      </main>
      <ChatWidgetLite />
    </div>
  );
}

export default HomePage;
