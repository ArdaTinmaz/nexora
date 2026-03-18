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
import DashboardPage from '../DashboardPage/DashboardPage';
import { pushRecentHomeItem } from '../../utils/recentHomeItems';

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

  // Get current board/project ID from URL
  const companyMatch = matchPath('/home/company/:projectId', location.pathname);
  const boardMatch = matchPath('/home/:boardName', location.pathname);
  const currentCompanyProjectId = companyMatch?.params?.projectId || null;
  const rawBoardName = boardMatch?.params?.boardName || '';
  const decodedBoardName = rawBoardName ? decodeURIComponent(rawBoardName) : '';
  const isReservedRoute = rawBoardName === 'tasks' || rawBoardName === 'company';
  const currentBoardId = companyMatch || !rawBoardName || isReservedRoute
    ? null
    : boards.find(
        (board) =>
          board.name === decodedBoardName || encodeURIComponent(board.name) === rawBoardName
      )?.id || null;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (currentBoardId) {
      const board = boards.find((item) => item.id === currentBoardId);
      if (!board) return;
      pushRecentHomeItem({
        type: 'board',
        id: board.id,
        label: board.name,
        path: `/home/${encodeURIComponent(board.name)}`,
      });
      return;
    }

    if (currentCompanyProjectId) {
      const companyProject = companyProjects.find((item) => item.id === currentCompanyProjectId);
      if (!companyProject) return;
      pushRecentHomeItem({
        type: 'company',
        id: companyProject.id,
        label: companyProject.name,
        path: `/home/company/${companyProject.id}`,
      });
    }
  }, [boards, companyProjects, currentBoardId, currentCompanyProjectId]);

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
                <DashboardPage
                  boards={boards}
                  companyProjects={companyProjects}
                  boardsLoading={isBoardsLoading}
                  companyProjectsLoading={isCompanyLoading}
                />
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
