import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './TasksPage.module.css';
import { taskApi } from '../../api/taskApi';
import { teamApi } from '../../api/teamApi';
import { companyBoardApi } from '../../api/companyBoardApi';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import EditTaskModal from '../../components/EditTaskModal/EditTaskModal';
import TaskFiltersModal from '../../components/TaskFiltersModal/TaskFiltersModal';
import { spriteHref } from '../../utils/assets';

const priorityLabels = {
  without: 'Without priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const statusLabels = {
  pending: 'Pending',
  'in-progress': 'In-Progress',
  completed: 'Completed',
};

const defaultTaskFilters = {
  title: '',
  project: 'all',
  team: 'all',
  assignee: 'all',
  dateFrom: '',
  dateTo: '',
  status: 'all',
  priority: 'all',
};

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

function TasksPage({ companyProjects = [] }) {
  const location = useLocation();
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
  const [cardActionState, setCardActionState] = useState({});
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [editModalError, setEditModalError] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isTaskFiltersOpen, setIsTaskFiltersOpen] = useState(false);
  const [taskFilters, setTaskFilters] = useState(defaultTaskFilters);

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
    return [...ids]
      .filter((id) => Boolean(projectNameMap[id]))
      .map((id) => ({
        id,
        name: projectNameMap[id],
      }));
  }, [leadTeams, projectNameMap]);

  const teamsForProject = useMemo(() => {
    if (!createDraft.projectId) return leadTeams;
    return leadTeams.filter((team) => {
      if (team.projectId === createDraft.projectId) return true;
      return (team.projectHistory || []).includes(createDraft.projectId);
    });
  }, [leadTeams, createDraft.projectId]);

  const taskProjectOptions = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      if (!task.projectId) return;
      map.set(task.projectId, task.projectName || projectNameMap[task.projectId] || 'Project');
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, projectNameMap]);

  const taskTeamOptions = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      if (!task.teamId) return;
      map.set(task.teamId, task.teamName || 'Team');
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const taskAssigneeOptions = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      const assigneeId = task.assignedTo ? String(task.assignedTo) : '';
      const assigneeName = task.assignedToName || '';
      if (assigneeId) {
        map.set(assigneeId, assigneeName || assigneeId);
        return;
      }
      if (assigneeName) {
        const nameKey = `name:${assigneeName}`;
        map.set(nameKey, assigneeName);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const titleQuery = taskFilters.title.trim().toLowerCase();
      if (titleQuery) {
        const title = String(task.title || '').toLowerCase();
        if (!title.includes(titleQuery)) return false;
      }

      if (taskFilters.project !== 'all') {
        if (String(task.projectId || '') !== String(taskFilters.project)) return false;
      }

      if (taskFilters.team !== 'all') {
        if (String(task.teamId || '') !== String(taskFilters.team)) return false;
      }

      if (taskFilters.assignee !== 'all') {
        const assigneeKey = task.assignedTo
          ? String(task.assignedTo)
          : task.assignedToName
            ? `name:${task.assignedToName}`
            : '';
        if (!assigneeKey || assigneeKey !== taskFilters.assignee) return false;
      }

      if (taskFilters.status !== 'all') {
        if ((task.status || 'pending') !== taskFilters.status) return false;
      }

      if (taskFilters.priority !== 'all') {
        if ((task.priority || 'without') !== taskFilters.priority) return false;
      }

      const dateFrom = toDateObject(taskFilters.dateFrom);
      const dateTo = toDateObject(taskFilters.dateTo);
      if (dateFrom || dateTo) {
        const deadline = toDateObject(task.deadline);
        if (!deadline) return false;
        if (dateFrom && deadline < dateFrom) return false;
        if (dateTo) {
          const endOfDay = new Date(dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (deadline > endOfDay) return false;
        }
      }

      return true;
    });
  }, [tasks, taskFilters]);

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

  useEffect(() => {
    if (leadTeams.length === 0) return;
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('new') === '1') {
      setStatusMessage('');
      setIsAssignModalOpen(true);
    }
  }, [leadTeams.length, location.search]);

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
      setIsAssignModalOpen(false);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error creating task:', error);
      setStatusMessage(error.message || 'Failed to assign task.');
    }
  };

  const openEditModal = (task) => {
    setTaskToEdit(task);
    setEditModalError('');
  };

  const closeEditModal = () => {
    const isSaving = taskToEdit && cardActionState[taskToEdit.id]?.saving;
    if (isSaving) return;
    setTaskToEdit(null);
    setEditModalError('');
  };

  const handleSaveTask = async (payload) => {
    if (!taskToEdit?.id) return;
    const taskId = taskToEdit.id;
    setCardActionState((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), saving: true, error: '' },
    }));

    try {
      const updated = await taskApi.update(taskId, {
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        deadline: payload.deadline ? new Date(payload.deadline).getTime() : null,
        status: payload.status,
      });

      setTasks((prev) =>
        prev.map((item) => (item.id === taskId ? { ...item, ...updated } : item))
      );
      setTaskToEdit(null);
      setEditModalError('');
      setCardActionState((prev) => ({
        ...prev,
        [taskId]: { ...(prev[taskId] || {}), saving: false, error: '' },
      }));
    } catch (error) {
      console.error('Error updating task:', error);
      setEditModalError(error.message || 'Failed to update task.');
      setCardActionState((prev) => ({
        ...prev,
        [taskId]: {
          ...(prev[taskId] || {}),
          saving: false,
          error: error.message || 'Failed to update task.',
        },
      }));
    }
  };

  const requestDeleteTask = (task) => {
    setTaskToDelete(task);
  };

  const cancelDeleteTask = () => {
    const isDeleting = taskToDelete && cardActionState[taskToDelete.id]?.deleting;
    if (isDeleting) return;
    setTaskToDelete(null);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete?.id) return;
    const taskId = taskToDelete.id;

    if (cardActionState[taskId]?.deleting) {
      return;
    }

    setCardActionState((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), deleting: true, error: '' },
    }));

    try {
      await taskApi.remove(taskId);
      setTasks((prev) => prev.filter((item) => item.id !== taskId));
      setTransferState((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      if (taskToEdit?.id === taskId) setTaskToEdit(null);
      setTaskToDelete(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      setCardActionState((prev) => ({
        ...prev,
        [taskId]: {
          ...(prev[taskId] || {}),
          deleting: false,
          error: error.message || 'Failed to delete task.',
        },
      }));
      return;
    }

    setCardActionState((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
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
        <div className={styles.headerText}>
          <h1 className={styles.title}>Tasks</h1>
          <p className={styles.subtitle}>
            Manage team assignments and move them into company boards.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.filtersBtn}
            type="button"
            onClick={() => setIsTaskFiltersOpen(true)}
          >
            <svg className={styles.filterIcon} width="20" height="20" viewBox="0 0 32 32">
              <use href={spriteHref('icon-Filter-White')}></use>
            </svg>
            <span>Filters</span>
          </button>
          {leadTeams.length > 0 && (
            <>
              <span className={styles.actionsDivider} aria-hidden="true" />
              <button
                className={styles.assignTriggerBtn}
                type="button"
                onClick={() => {
                  setStatusMessage('');
                  setIsAssignModalOpen(true);
                }}
              >
                Assign task
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.taskListWrap}>
          <div className={styles.taskList}>
            {loading ? (
              <div className={styles.emptyState}>Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className={styles.emptyState}>No tasks assigned to you yet.</div>
            ) : filteredTasks.length === 0 ? (
              <div className={styles.emptyState}>No tasks match selected filters.</div>
            ) : (
              filteredTasks.map((task) => {
                const actionState = cardActionState[task.id] || {};

                return (
                  <div key={task.id} className={styles.taskCard}>
                    <div className={styles.taskHeader}>
                      <div className={styles.taskText}>
                        <h3 className={styles.taskTitle}>{task.title || 'Untitled task'}</h3>
                        <p className={styles.taskDesc}>{task.description || 'No description.'}</p>
                      </div>
                      <div className={styles.cardTopRight}>
                        <div className={styles.cardActions}>
                          <button
                            className={styles.actionBtn}
                            type="button"
                            disabled={actionState.saving || actionState.deleting}
                            onClick={() => openEditModal(task)}
                          >
                            Edit
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                            type="button"
                            disabled={actionState.saving || actionState.deleting}
                            onClick={() => requestDeleteTask(task)}
                          >
                            {actionState.deleting ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                        <span className={styles.statusBadge}>
                          {statusLabels[task.status] || task.status || 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>
                        Project:{' '}
                        <strong>{task.projectName || projectNameMap[task.projectId] || 'N/A'}</strong>
                      </span>
                      <span className={styles.metaLabel}>
                        Assigned to: <strong>{task.assignedToName || 'N/A'}</strong>
                      </span>
                      <span className={styles.metaLabel}>
                        Priority:{' '}
                        <strong>{priorityLabels[task.priority] || 'Without priority'}</strong>
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
                      {actionState.error && <p className={styles.errorText}>{actionState.error}</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {leadTeams.length > 0 && isAssignModalOpen && (
        <div
          className={styles.assignModalOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsAssignModalOpen(false);
            }
          }}
        >
          <div className={styles.createPanel} onClick={(event) => event.stopPropagation()}>
            <div className={styles.assignModalHeader}>
              <h2 className={styles.panelTitle}>Assign New Task</h2>
              <button
                className={styles.modalCloseBtn}
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                aria-label="Close assign task modal"
              >
                &times;
              </button>
            </div>
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
        </div>
      )}

      <TaskFiltersModal
        isOpen={isTaskFiltersOpen}
        onClose={() => setIsTaskFiltersOpen(false)}
        filters={taskFilters}
        onApplyFilters={setTaskFilters}
        projectOptions={taskProjectOptions}
        teamOptions={taskTeamOptions}
        assigneeOptions={taskAssigneeOptions}
      />

      <EditTaskModal
        isOpen={Boolean(taskToEdit)}
        task={taskToEdit}
        loading={Boolean(taskToEdit && cardActionState[taskToEdit.id]?.saving)}
        errorMessage={editModalError}
        onClose={closeEditModal}
        onSave={handleSaveTask}
      />

      <ConfirmModal
        isOpen={Boolean(taskToDelete)}
        title="Delete task"
        message={
          taskToDelete
            ? `"${taskToDelete.title || 'Untitled task'}" will be deleted permanently. Are you sure?`
            : ''
        }
        confirmLabel={
          taskToDelete && cardActionState[taskToDelete.id]?.deleting
            ? 'Deleting...'
            : 'Delete'
        }
        cancelLabel="Cancel"
        onConfirm={confirmDeleteTask}
        onCancel={cancelDeleteTask}
      />
    </div>
  );
}

export default TasksPage;
