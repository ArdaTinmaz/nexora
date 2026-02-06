import React, { useEffect, useMemo, useState } from 'react';
import styles from './TasksPage.module.css';
import { taskApi } from '../../api/taskApi';
import { teamApi } from '../../api/teamApi';
import { companyBoardApi } from '../../api/companyBoardApi';

const priorityLabels = {
  without: 'Without priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function TasksPage({ companyProjects = [] }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leadTeams, setLeadTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [createDraft, setCreateDraft] = useState({
    teamId: '',
    projectId: '',
    assignedTo: '',
    title: '',
    description: '',
    priority: 'without',
    deadline: '',
  });
  const [transferState, setTransferState] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  const projectNameMap = useMemo(() => {
    return (companyProjects || []).reduce((acc, project) => {
      acc[project.id] = project.name;
      return acc;
    }, {});
  }, [companyProjects]);

  const projectOptions = useMemo(() => {
    const ids = new Set();
    (leadTeams || []).forEach((team) => {
      if (team.projectId) ids.add(team.projectId);
      (team.projectHistory || []).forEach((entry) => {
        if (entry) ids.add(entry);
      });
    });
    return [...ids].map((id) => ({
      id,
      name: projectNameMap[id] || 'Project',
    }));
  }, [leadTeams, projectNameMap]);

  const teamsForProject = useMemo(() => {
    if (!createDraft.projectId) return leadTeams;
    return leadTeams.filter((team) => {
      if (team.projectId === createDraft.projectId) return true;
      return (team.projectHistory || []).includes(createDraft.projectId);
    });
  }, [leadTeams, createDraft.projectId]);

  const loadTasks = async (isMountedRef) => {
    try {
      setLoading(true);
      const data = await taskApi.listAssigned();
      if (isMountedRef.current) {
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      if (isMountedRef.current) {
        setTasks([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const isMountedRef = { current: true };

    const loadTeams = async () => {
      try {
        const data = await teamApi.myTeams();
        if (!isMountedRef.current) return;
        const list = Array.isArray(data) ? data : [];
        const leads = list.filter((team) => team.role === 'team_leader');
        setLeadTeams(leads);
        if (leads.length && !createDraft.projectId) {
          const nextProjectId =
            leads[0].projectId || (leads[0].projectHistory || [])[0] || '';
          setCreateDraft((prev) => ({
            ...prev,
            projectId: nextProjectId,
          }));
        }
      } catch (error) {
        console.error('Error fetching teams:', error);
      }
    };

    loadTasks(isMountedRef);
    loadTeams();

    return () => {
      isMountedRef.current = false;
    };
  }, [createDraft.teamId, refreshKey]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!createDraft.teamId) {
        setMembers([]);
        return;
      }
      try {
        const data = await teamApi.members(createDraft.teamId);
        const list = Array.isArray(data) ? data : [];
        const unique = new Map();
        list.forEach((member) => {
          if (!unique.has(member.id)) {
            unique.set(member.id, member);
          }
        });
        const uniqueMembers = Array.from(unique.values());
        setMembers(uniqueMembers);
        const firstMember = uniqueMembers[0]?.id;
        setCreateDraft((prev) => ({
          ...prev,
          assignedTo: prev.assignedTo || firstMember || '',
        }));
      } catch (error) {
        console.error('Error fetching team members:', error);
      }
    };

    loadMembers();
  }, [createDraft.teamId]);

  useEffect(() => {
    if (!projectOptions.length) return;
    const hasProject = projectOptions.some((project) => project.id === createDraft.projectId);
    if (!createDraft.projectId || !hasProject) {
      setCreateDraft((prev) => ({
        ...prev,
        projectId: projectOptions[0].id,
      }));
      return;
    }

    const hasTeam = teamsForProject.some((team) => team.id === createDraft.teamId);
    if (!hasTeam) {
      const nextTeamId = teamsForProject[0]?.id || '';
      setCreateDraft((prev) => ({
        ...prev,
        teamId: nextTeamId,
        assignedTo: '',
      }));
    }
  }, [projectOptions, teamsForProject, createDraft.projectId, createDraft.teamId]);

  const handleCreateTask = async (event) => {
    event.preventDefault();
    setStatusMessage('');

    if (!createDraft.projectId) {
      setStatusMessage('Select a project for this task.');
      return;
    }
    if (!createDraft.teamId) {
      setStatusMessage('Select a team for this task.');
      return;
    }

    try {
      await taskApi.create({
        title: createDraft.title,
        description: createDraft.description,
        priority: createDraft.priority,
        deadline: createDraft.deadline ? new Date(createDraft.deadline).getTime() : null,
        teamId: createDraft.teamId,
        projectId: createDraft.projectId,
        assignedTo: createDraft.assignedTo,
      });
      setStatusMessage('');
      setCreateDraft((prev) => ({
        ...prev,
        title: '',
        description: '',
        deadline: '',
      }));
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error creating task:', error);
      setStatusMessage(error.message || 'Failed to assign task.');
    }
  };

  const ensureColumns = async (task) => {
    setTransferState((prev) => ({
      ...prev,
      [task.id]: { ...(prev[task.id] || {}), loading: true },
    }));

    try {
      const board = await companyBoardApi.getBoard(task.projectId);
      const columns = board.columns || [];
      setTransferState((prev) => ({
        ...prev,
        [task.id]: {
          columns,
          columnId: columns[0]?.id || '',
          loading: false,
        },
      }));
    } catch (error) {
      console.error('Error loading board columns:', error);
      setTransferState((prev) => ({
        ...prev,
        [task.id]: { ...(prev[task.id] || {}), loading: false, error: error.message },
      }));
    }
  };

  const handleTransfer = async (task) => {
    const draft = transferState[task.id];
    if (!draft?.columnId) return;

    try {
      const result = await taskApi.transfer(task.id, draft.columnId);
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? { ...item, status: result.status, cardId: result.card?.id }
            : item
        )
      );
      setTransferState((prev) => ({
        ...prev,
        [task.id]: { ...draft, success: true },
      }));
    } catch (error) {
      console.error('Error transferring task:', error);
      setTransferState((prev) => ({
        ...prev,
        [task.id]: { ...draft, error: error.message || 'Transfer failed' },
      }));
    }
  };

  const renderTransfer = (task) => {
    const draft = transferState[task.id];
    if (!draft?.columns) {
      return (
        <button
          className={styles.transferBtn}
          type="button"
          onClick={() => ensureColumns(task)}
        >
          {draft?.loading ? 'Loading columns...' : 'Load columns'}
        </button>
      );
    }

    if (!draft.columns.length) {
      return <p className={styles.metaMuted}>No columns found for this board.</p>;
    }

    return (
      <div className={styles.transferRow}>
        <select
          className={styles.select}
          value={draft.columnId}
          onChange={(event) =>
            setTransferState((prev) => ({
              ...prev,
              [task.id]: { ...draft, columnId: event.target.value },
            }))
          }
        >
          {draft.columns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.title}
            </option>
          ))}
        </select>
        <button
          className={styles.transferBtn}
          type="button"
          disabled={!draft.columnId || task.cardId}
          onClick={() => handleTransfer(task)}
        >
          {task.cardId ? 'Transferred' : 'Transfer'}
        </button>
      </div>
    );
  };

  return (
    <div className={styles.tasksPage}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tasks</h1>
          <p className={styles.subtitle}>
            Manage team assignments and move them into company boards.
          </p>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.taskList}>
          {loading ? (
            <div className={styles.emptyState}>Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className={styles.emptyState}>No tasks assigned to you yet.</div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className={styles.taskCard}>
                <div className={styles.taskHeader}>
                  <div>
                    <h3 className={styles.taskTitle}>{task.title || 'Untitled task'}</h3>
                    <p className={styles.taskDesc}>{task.description || 'No description.'}</p>
                  </div>
                  <span className={styles.statusBadge}>{task.status || 'pending'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>
                    Project:{' '}
                    <strong>{task.projectName || projectNameMap[task.projectId] || 'N/A'}</strong>
                  </span>
                  <span className={styles.metaLabel}>
                    Assigned by: <strong>{task.assignedByName || 'Team lead'}</strong>
                  </span>
                  <span className={styles.metaLabel}>
                    Priority: <strong>{priorityLabels[task.priority] || 'Without priority'}</strong>
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>
                    Team: <strong>{task.teamName || 'N/A'}</strong>
                  </span>
                  <span className={styles.metaLabel}>
                    Deadline:{' '}
                    <strong>
                      {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}
                    </strong>
                  </span>
                </div>
                <div className={styles.transferBlock}>
                  <p className={styles.metaMuted}>
                    Transfer this task into a company board column.
                  </p>
                  {renderTransfer(task)}
                  {transferState[task.id]?.error && (
                    <p className={styles.errorText}>{transferState[task.id].error}</p>
                  )}
                  {transferState[task.id]?.success && (
                    <p className={styles.successText}>Task transferred to board.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {leadTeams.length > 0 && (
          <div className={styles.createPanel}>
            <h2 className={styles.panelTitle}>Assign New Task</h2>
            <p className={styles.panelSubtitle}>
              Only team leaders can add task cards here.
            </p>
            <form className={styles.form} onSubmit={handleCreateTask}>
              <label className={styles.label}>
                Project
                <select
                  className={styles.select}
                  value={createDraft.projectId}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({
                      ...prev,
                      projectId: event.target.value,
                      teamId: '',
                      assignedTo: '',
                    }))
                  }
                >
                  {projectOptions.length === 0 ? (
                    <option value="">No project</option>
                  ) : (
                    projectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className={styles.label}>
                Team
                <select
                  className={styles.select}
                  value={createDraft.teamId}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({
                      ...prev,
                      teamId: event.target.value,
                      assignedTo: '',
                    }))
                  }
                >
                  {teamsForProject.length === 0 ? (
                    <option value="">No team</option>
                  ) : (
                    teamsForProject.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className={styles.label}>
                Assignee
                <select
                  className={styles.select}
                  value={createDraft.assignedTo}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({ ...prev, assignedTo: event.target.value }))
                  }
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.email || member.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.label}>
                Title
                <input
                  className={styles.input}
                  value={createDraft.title}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({ ...prev, title: event.target.value }))
                  }
                  required
                />
              </label>

              <label className={styles.label}>
                Description
                <textarea
                  className={styles.textarea}
                  rows="4"
                  value={createDraft.description}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </label>

              <div className={styles.row}>
                <label className={styles.label}>
                  Priority
                  <select
                    className={styles.select}
                    value={createDraft.priority}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({ ...prev, priority: event.target.value }))
                    }
                  >
                    <option value="without">Without</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>

                <label className={styles.label}>
                  Deadline
                  <input
                    className={styles.input}
                    type="date"
                    value={createDraft.deadline}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({ ...prev, deadline: event.target.value }))
                    }
                  />
                </label>
              </div>

              <button className={styles.primaryBtn} type="submit">
                Create task
              </button>
              {statusMessage && <p className={styles.statusText}>{statusMessage}</p>}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default TasksPage;
