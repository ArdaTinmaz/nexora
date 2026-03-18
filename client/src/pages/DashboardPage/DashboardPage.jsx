import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DashboardPage.module.css';
import { taskApi } from '../../api/taskApi';
import { notificationApi } from '../../api/notificationApi';
import { getSession } from '../../desktop/session';
import { readRecentHomeItems } from '../../utils/recentHomeItems';

const DAY_MS = 24 * 60 * 60 * 1000;

const toTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

const formatDate = (value) => {
  const ts = toTimestamp(value);
  if (!ts) return 'No deadline';
  return new Date(ts).toLocaleDateString();
};

function DashboardPage({
  boards = [],
  companyProjects = [],
  boardsLoading = false,
  companyProjectsLoading = false,
}) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [userName, setUserName] = useState('there');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setLoading(true);

      const [tasksResult, notificationsResult, sessionResult] = await Promise.allSettled([
        taskApi.listAssigned(),
        notificationApi.list(120),
        getSession('user'),
      ]);

      if (!isMounted) return;

      const nextTasks = tasksResult.status === 'fulfilled' && Array.isArray(tasksResult.value)
        ? tasksResult.value
        : [];
      const notificationList = notificationsResult.status === 'fulfilled'
        ? notificationsResult.value?.notifications
        : [];
      const nextActivities = Array.isArray(notificationList)
        ? notificationList
            .filter((item) => item?.category !== 'message')
        : [];
      const sessionUser = sessionResult.status === 'fulfilled'
        ? sessionResult.value?.user
        : null;

      setTasks(nextTasks);
      setActivities(nextActivities);
      setUserName(sessionUser?.name || 'there');
      setUserId(sessionUser?.id || sessionUser?._id || '');
      setLoading(false);
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const dayRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + DAY_MS;
    const weekEnd = start.getTime() + 7 * DAY_MS;
    return { start: start.getTime(), end, weekEnd };
  }, []);

  const myTasks = useMemo(() => {
    if (!userId) return tasks;
    return tasks.filter((task) => String(task.assignedTo || '') === String(userId));
  }, [tasks, userId]);

  const activeTasks = useMemo(
    () => myTasks.filter((task) => (task.status || 'pending') !== 'pending'),
    [myTasks]
  );

  const todayDue = useMemo(
    () =>
      activeTasks.filter((task) => {
        const ts = toTimestamp(task.deadline);
        return ts && ts >= dayRange.start && ts < dayRange.end && task.status !== 'completed';
      }),
    [activeTasks, dayRange]
  );

  const overdue = useMemo(
    () =>
      activeTasks.filter((task) => {
        const ts = toTimestamp(task.deadline);
        return ts && ts < dayRange.start && task.status !== 'completed';
      }),
    [activeTasks, dayRange]
  );

  const completed = useMemo(
    () => activeTasks.filter((task) => task.status === 'completed'),
    [activeTasks]
  );

  const upcoming = useMemo(
    () =>
      activeTasks
        .filter((task) => {
          const ts = toTimestamp(task.deadline);
          return ts && ts >= dayRange.start && ts < dayRange.weekEnd && task.status !== 'completed';
        })
        .sort((a, b) => toTimestamp(a.deadline) - toTimestamp(b.deadline))
        .slice(0, 7),
    [activeTasks, dayRange]
  );

  const recentItems = useMemo(() => {
    const boardMap = new Map((boards || []).map((board) => [String(board.id), board]));
    const companyMap = new Map((companyProjects || []).map((project) => [String(project.id), project]));

    return readRecentHomeItems()
      .map((entry) => {
        if (entry.type === 'board') {
          const board = boardMap.get(entry.id);
          if (!board && !entry.path) return null;
          return {
            key: `board:${entry.id}`,
            label: board?.name || entry.label || 'Board',
            meta: 'My board',
            path: board ? `/home/${encodeURIComponent(board.name)}` : entry.path,
          };
        }

        const company = companyMap.get(entry.id);
        if (!company && !entry.path) return null;
        return {
          key: `company:${entry.id}`,
          label: company?.name || entry.label || 'Company project',
          meta: 'Company project',
          path: company ? `/home/company/${company.id}` : entry.path,
        };
      })
      .filter(Boolean)
      .slice(0, 3);
  }, [boards, companyProjects]);

  return (
    <div className={styles.dashboard}>
      <section className={styles.hero}>
        <h1 className={styles.title}>Welcome back, {userName}</h1>
        <p className={styles.subtitle}>
          This is your workspace overview for today. Jump into tasks or continue recent projects.
        </p>
      </section>

      <section className={styles.todayGrid}>
        <article className={styles.statCard}>
          <p className={styles.statLabel}>Due today</p>
          <p className={styles.statValue}>{todayDue.length}</p>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabel}>Overdue</p>
          <p className={`${styles.statValue} ${styles.statDanger}`}>{overdue.length}</p>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabel}>Completed</p>
          <p className={`${styles.statValue} ${styles.statSuccess}`}>{completed.length}</p>
        </article>
      </section>

      <section className={styles.mainLayout}>
        <div className={styles.leftPanel}>
          <article className={`${styles.card} ${styles.quickCard}`}>
            <div className={styles.cardHeader}>
              <h2>Quick actions</h2>
            </div>
            <div className={styles.actions}>
              <button type="button" onClick={() => navigate('/home/tasks?new=1')}>
                Create task
              </button>
              <button type="button" onClick={() => window.dispatchEvent(new Event('nexora:create-board'))}>
                Create board
              </button>
              <button type="button" onClick={() => navigate('/home/tasks')}>
                Open tasks
              </button>
              <button type="button" onClick={() => window.dispatchEvent(new Event('nexora:need-help'))}>
                Need help
              </button>
            </div>
          </article>

          <article className={`${styles.card} ${styles.upcomingCard}`}>
            <div className={styles.cardHeader}>
              <h2>Upcoming (7 days)</h2>
            </div>
            {loading ? (
              <p className={styles.empty}>Loading upcoming tasks...</p>
            ) : upcoming.length === 0 ? (
              <p className={styles.empty}>No upcoming deadlines for the next 7 days.</p>
            ) : (
              <div className={styles.scrollAreaUpcoming}>
                <ul className={styles.list}>
                  {upcoming.map((task) => (
                    <li key={task.id} className={styles.listItem}>
                      <div>
                        <p className={styles.itemTitle}>{task.title || 'Untitled task'}</p>
                        <p className={styles.itemMeta}>{task.projectName || 'Project'} • {task.teamName || 'Team'}</p>
                      </div>
                      <span className={styles.itemDate}>{formatDate(task.deadline)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <article className={`${styles.card} ${styles.continueCard}`}>
            <div className={styles.cardHeader}>
              <h2>Continue where you left off</h2>
            </div>
            {boardsLoading || companyProjectsLoading ? (
              <p className={styles.empty}>Loading recent items...</p>
            ) : recentItems.length === 0 ? (
              <p className={styles.empty}>No recent boards or projects yet.</p>
            ) : (
              <ul className={styles.list}>
                {recentItems.map((item) => (
                  <li key={item.key} className={styles.listItem}>
                    <div>
                      <p className={styles.itemTitle}>{item.label}</p>
                      <p className={styles.itemMeta}>{item.meta}</p>
                    </div>
                    <button
                      type="button"
                      className={styles.openBtn}
                      onClick={() => navigate(item.path)}
                    >
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>

        <div className={styles.rightPanel}>
          <article className={`${styles.card} ${styles.activityCard}`}>
            <div className={styles.cardHeader}>
              <h2>Team activity</h2>
            </div>
            {loading ? (
              <p className={styles.empty}>Loading activity...</p>
            ) : activities.length === 0 ? (
              <p className={styles.empty}>No recent activity yet.</p>
            ) : (
              <div className={styles.scrollAreaActivity}>
                <ul className={styles.list}>
                  {activities.map((item) => (
                    <li key={item.id} className={styles.activityItem}>
                      <div>
                        <p className={styles.itemTitle}>{item.title || 'Update'}</p>
                        <p className={styles.itemMeta}>{item.message || ''}</p>
                        <p className={styles.timeMeta}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                        </p>
                      </div>
                      {item.link && (
                        <button
                          type="button"
                          className={styles.openBtn}
                          onClick={() => navigate(item.link)}
                        >
                          View
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
