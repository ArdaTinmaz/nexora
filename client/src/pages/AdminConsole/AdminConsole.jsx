import { useEffect, useMemo, useState } from 'react';
import styles from './AdminConsole.module.css';
import { adminApi, getAdminToken } from '../../api/adminApi';

// UI-focused Admin Console wired to backend; no mock data kept.
const AdminConsole = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [token, setToken] = useState(getAdminToken());
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userRoleDraft, setUserRoleDraft] = useState({});
  const [assignDraft, setAssignDraft] = useState({});
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '' });
  const [projectModal, setProjectModal] = useState(null);
  const [projectDraft, setProjectDraft] = useState({ name: '', ownerId: '', ownerName: '', status: '' });
  const [assignProjectDraft, setAssignProjectDraft] = useState({ teamId: '' });
  const [assignMode, setAssignMode] = useState('add');
  const [teamModal, setTeamModal] = useState(null);
  const [teamDraft, setTeamDraft] = useState({ name: '', leaderId: '' });
  const [memberDraft, setMemberDraft] = useState({ userId: '', role: 'developer' });
  const [memberMode, setMemberMode] = useState('add');

  const userNameMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u.id) map[u.id] = u.name || u.email || u.id;
    });
    return map;
  }, [users]);

  const projectNameMap = useMemo(() => {
    const map = {};
    projects.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [projects]);

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [u, t, p] = await Promise.all([adminApi.users(), adminApi.teams(), adminApi.projects()]);
      setUsers(u || []);
      setTeams(t || []);
      setProjects(p || []);
      setStatusMsg('');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    try {
      setLoginError('');
      setLoading(true);
      const res = await adminApi.login(loginForm);
      setToken(res.token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    adminApi.logout();
    setToken(null);
    setUsers([]);
    setTeams([]);
    setProjects([]);
  };

  const handleCreateUser = async (e) => {
    e?.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) {
      setStatusMsg('Name, email ve password zorunlu');
      return;
    }
    try {
      setLoading(true);
      await adminApi.createUser(newUser);
      setNewUser({ name: '', email: '', password: '' });
      setStatusMsg('User created');
      await loadData();
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId) => {
    const role = userRoleDraft[userId];
    if (!role) return;
    try {
      setLoading(true);
      await adminApi.updateUserMeta(userId, { role });
      setStatusMsg('Role updated');
      await loadData();
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeam = async (userId) => {
    const draft = assignDraft[userId] || {};
    if (!draft.teamId || !draft.role) {
      setStatusMsg('Team ve role seçin');
      return;
    }
    try {
      setLoading(true);
      await adminApi.addTeamMember(draft.teamId, { userId, role: draft.role });
      setStatusMsg('Team assignment ok');
      await loadData();
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    'admin',
    'product_manager',
    'scrum_master',
    'team_leader',
    'developer',
    'designer',
  ];

  const handleCreateTeam = async () => {
    if (!teamDraft.name || !teamDraft.leaderId) {
      setStatusMsg('Team name ve leader zorunlu');
      return;
    }
    try {
      setLoading(true);
      await adminApi.createTeam({
        name: teamDraft.name,
        leaderId: teamDraft.leaderId,
        projectId: null,
        members: [],
      });
      setStatusMsg('Team created');
      setTeamModal(null);
      setTeamDraft({ name: '', leaderId: '' });
      await loadData();
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMemberToTeam = async (teamId) => {
    if (!memberDraft.userId) return;
    try {
      setLoading(true);
      await adminApi.addTeamMember(teamId, { userId: memberDraft.userId, role: memberDraft.role });
      setStatusMsg('Member added');
      setMemberDraft({ userId: '', role: 'developer' });
      await loadData();
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeamToProject = async () => {
    if (!assignProjectDraft.teamId || !projectModal?.id) {
      setStatusMsg('Team ve proje seçin');
      return;
    }
    try {
      setLoading(true);
      await adminApi.updateTeamProject(projectModal.id, assignProjectDraft.teamId);
      setAssignProjectDraft({ teamId: '' });
      setStatusMsg('Team assigned');
      await loadData();
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTeamFromProject = async () => {
    if (!assignProjectDraft.teamId || !projectModal?.id) {
      setStatusMsg('Team ve proje seçin');
      return;
    }
    try {
      setLoading(true);
      await adminApi.removeTeamFromProject(projectModal.id, assignProjectDraft.teamId);
      setAssignProjectDraft({ teamId: '' });
      setStatusMsg('Team removed');
      await loadData();
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamAssignAction = async () => {
    if (!assignProjectDraft.teamId || !projectModal?.id) return;
    if (assignMode === 'delete') {
      await handleRemoveTeamFromProject();
    } else {
      await handleAddTeamToProject();
    }
  };

  useEffect(() => {
    if (projectModal) {
      setAssignMode('add');
      setAssignProjectDraft({ teamId: '' });
    }
  }, [projectModal]);

  const handleRemoveMemberFromTeam = async (teamId, userId) => {
    try {
      setLoading(true);
      await adminApi.removeTeamMember(teamId, userId);
      setStatusMsg('Member removed');
      await loadData();
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderUsers = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Users</h2>
          <p>Manage roles, statuses, and team assignments.</p>
        </div>
        <button className={`${styles.btn} ${styles.btnAccent}`} onClick={() => setEditingUserId('create')}>
          + Create User
        </button>
      </div>
      {editingUserId === 'create' && (
        <form className={styles.inlinePanel} onSubmit={handleCreateUser}>
          <input
            className={styles.input}
            placeholder="Name"
            value={newUser.name}
            onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className={styles.input}
            placeholder="Email"
            value={newUser.email}
            onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
          />
          <input
            className={styles.input}
            type="password"
            placeholder="Password"
            value={newUser.password}
            onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
          />
          <button type="submit" className={styles.btnAccent} disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}
      <div className={styles.grid}>
        {users.length === 0 ? (
          <div className={styles.emptyCard}>No users to display.</div>
        ) : (
          users.map((user) => (
            <div key={user.id} className={styles.card}>
              <div className={styles.avatar}>{user.name?.slice(0, 1)}</div>
              <div className={styles.cardBody}>
                <div className={styles.cardTitle}>{user.name}</div>
                <div className={styles.muted}>{user?.meta?.role || user.role || '—'}</div>
                <div className={`${styles.tag} ${styles.tagSuccess}`}>
                  {user.meta?.status || user.status || 'active'}
                </div>
                <div className={styles.actions}>
                  <button className={styles.btnGhost} onClick={() => setEditingUserId(user.id)}>
                    Edit
                  </button>
                  <button className={styles.btnGhost} onClick={() => setEditingUserId(user.id)}>
                    Assign team
                  </button>
                  <button className={styles.btnGhost} onClick={() => setEditingUserId(user.id)}>
                    Change role
                  </button>
                </div>
                {editingUserId === user.id && (
                  <div className={styles.inlinePanel}>
                    <div className={styles.inlineRow}>
                      <label>Role</label>
                      <select
                        className={styles.select}
                        value={userRoleDraft[user.id] || user?.meta?.role || user.role || ''}
                        onChange={(e) =>
                          setUserRoleDraft((prev) => ({ ...prev, [user.id]: e.target.value }))
                        }
                      >
                        <option value="">Select role</option>
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button className={styles.btnGhost} onClick={() => handleUpdateRole(user.id)}>
                        Save role
                      </button>
                    </div>
                    <div className={styles.inlineRow}>
                      <label>Assign to team</label>
                      <select
                        className={styles.select}
                        value={assignDraft[user.id]?.teamId || ''}
                        onChange={(e) =>
                          setAssignDraft((prev) => ({
                            ...prev,
                            [user.id]: { ...(prev[user.id] || {}), teamId: e.target.value },
                          }))
                        }
                      >
                <option value="">Select Team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
                      </select>
                      <select
                        className={styles.select}
                        value={assignDraft[user.id]?.role || 'developer'}
                        onChange={(e) =>
                          setAssignDraft((prev) => ({
                            ...prev,
                            [user.id]: { ...(prev[user.id] || {}), role: e.target.value },
                          }))
                        }
                      >
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button className={styles.btnGhost} onClick={() => handleAssignTeam(user.id)}>
                        Add to team
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  const renderTeams = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Teams</h2>
          <p>Create squads and manage members per project.</p>
        </div>
        <button
          className={`${styles.btn} ${styles.btnAccent}`}
          onClick={() => {
            setTeamModal({ mode: 'create' });
            setTeamDraft({
              name: '',
              leaderId: users[0]?.id || '',
            });
          }}
        >
          + Create Team
        </button>
      </div>
      <div className={styles.grid}>
        {teams.length === 0 ? (
          <div className={styles.emptyCard}>No teams to display.</div>
        ) : (
          teams.map((team) => (
            <div key={team.id} className={styles.card}>
              <div className={styles.cardTitle}>{team.name}</div>
              <div className={styles.muted}>
                Project:{' '}
                {(() => {
                  const ids = Array.from(
                    new Set([
                      ...(team.projectHistory || []),
                      ...(team.projectId ? [team.projectId] : []),
                    ])
                  );
                  const names = ids.map((id) => projectNameMap[id]).filter(Boolean);
                  return names.length ? names.join(', ') : '—';
                })()}
              </div>
              <div className={styles.muted}>
                Team lead: {userNameMap[team.leaderId] || team.leaderId}
              </div>
              <div className={styles.muted}>
                Members: {team.members?.length || 0}
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.btnGhost}
                  onClick={() => {
                    setTeamModal({ mode: 'edit', team });
                    setTeamDraft({
                      name: team.name,
                      leaderId: team.leaderId,
                    });
                  }}
                >
                  Edit Team
                </button>
                <button
                  className={styles.btnGhost}
                  onClick={() => {
            setTeamModal({ mode: 'members', team });
            setMemberDraft({ userId: users[0]?.id || '', role: 'developer' });
            setMemberMode('add');
          }}
        >
          Manage Members
        </button>
      </div>
            </div>
          ))
        )}
      </div>

      {teamModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.cardTitle}>
                  {teamModal.mode === 'create' ? 'Create Team' : 'Team details'}
                </div>
              </div>
                <button className={styles.btnGhost} onClick={() => setTeamModal(null)}>
                  Close
                </button>
              </div>

            {(teamModal.mode === 'create' || teamModal.mode === 'edit') && (
              <div className={styles.modalGrid}>
                <label>
                  Team name
                  <input
                    className={styles.input}
                    value={teamDraft.name}
                    onChange={(e) => setTeamDraft((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>
                <label>
                  Team lead
                  <select
                    className={styles.select}
                    value={teamDraft.leaderId}
                    onChange={(e) => setTeamDraft((p) => ({ ...p, leaderId: e.target.value }))}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {teamModal.mode === 'members' && teamModal.team && (
              <div className={styles.inlinePanel}>
                <div className={styles.inlineRow}>
                  <div className={styles.sectionLabel}>Add/Delete member</div>
                  <button
                    type="button"
                    className={`${styles.toggle} ${memberMode === 'delete' ? styles.toggleOff : styles.toggleOn}`}
                    onClick={() => {
                      const next = memberMode === 'add' ? 'delete' : 'add';
                      setMemberMode(next);
                      const memberIds = (teamModal.team.members || []).map((m) => m.userId);
                      const firstMatch =
                        next === 'delete'
                          ? memberIds[0] || ''
                          : (users.find((u) => !memberIds.includes(u.id))?.id || '');
                      setMemberDraft((p) => ({ ...p, userId: firstMatch }));
                    }}
                  >
                    <span className={styles.toggleText}>{memberMode === 'delete' ? 'Delete' : 'Add'}</span>
                    <span
                      className={`${styles.toggleKnob} ${
                        memberMode === 'delete' ? styles.knobOff : styles.knobOn
                      }`}
                    />
                  </button>
                  <select
                    className={styles.select}
                    value={memberDraft.userId}
                    onChange={(e) => setMemberDraft((p) => ({ ...p, userId: e.target.value }))}
                  >
                    <option value="">Select member</option>
                    {(memberMode === 'delete'
                      ? users.filter((u) =>
                          (teamModal.team.members || []).some((m) => m.userId === u.id)
                        )
                      : users.filter(
                          (u) => !(teamModal.team.members || []).some((m) => m.userId === u.id)
                        )
                    ).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  {memberMode === 'add' && (
                    <select
                      className={styles.select}
                      value={memberDraft.role}
                      onChange={(e) => setMemberDraft((p) => ({ ...p, role: e.target.value }))}
                    >
                      {(() => {
                        const hasLead = (teamModal.team.members || []).some((m) => m.role === 'team_leader');
                        const availableRoles =
                          memberMode === 'add' && hasLead
                            ? roleOptions.filter((r) => r !== 'team_leader')
                            : roleOptions;
                        if (memberDraft.role === 'team_leader' && hasLead) {
                          setMemberDraft((p) => ({ ...p, role: 'developer' }));
                        }
                        return availableRoles;
                      })().map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className={styles.inlineRow}>
                  <div className={styles.sectionLabel}>Members</div>
                  <div className={styles.chipRow}>
                    {teamModal.team.members?.length ? (
                      teamModal.team.members.map((m) => (
                        <span key={m.userId} className={styles.chip}>
                          {userNameMap[m.userId] || m.userId} ({m.role})
                        </span>
                      ))
                    ) : (
                      <span className={styles.muted}>No members</span>
                    )}
                  </div>
                </div>
                <div className={styles.actionsEnd}>
                  <button
                    className={styles.btnPrimary}
                    onClick={async () => {
                      if (!memberDraft.userId) return;
                      const hasLead = (teamModal.team.members || []).some((m) => m.role === 'team_leader');
                      if (memberMode === 'add' && memberDraft.role === 'team_leader' && hasLead) {
                        setStatusMsg('Bu takımda zaten bir team_leader var');
                        return;
                      }
                      try {
                        setLoading(true);
                        let resp;
                        if (memberMode === 'delete') {
                          resp = await adminApi.removeTeamMember(teamModal.team.id, memberDraft.userId);
                        } else {
                          resp = await adminApi.addTeamMember(teamModal.team.id, {
                            userId: memberDraft.userId,
                            role: memberDraft.role,
                          });
                        }
                        setStatusMsg('Team members updated');
                        setMemberDraft((p) => ({ ...p, userId: '' }));
                        if (resp?.members) {
                          setTeamModal((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  team: { ...prev.team, members: resp.members },
                                }
                              : prev
                          );
                        }
                        await loadData();
                      } catch (err) {
                        setStatusMsg(err.message);
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              {teamModal.mode === 'create' && (
                <button className={styles.btnPrimary} onClick={handleCreateTeam} disabled={loading}>
                  {loading ? 'Creating...' : 'Create team'}
                </button>
              )}
              {teamModal.mode === 'edit' && (
                <button
                  className={styles.btnPrimary}
                  onClick={async () => {
                    if (!teamDraft.name || !teamDraft.leaderId) {
                      setStatusMsg('Team name ve leader zorunlu');
                      return;
                    }
                    try {
                      setLoading(true);
                      await adminApi.updateTeam(teamModal.team.id, {
                        name: teamDraft.name,
                        leaderId: teamDraft.leaderId,
                      });
                      setStatusMsg('Team updated');
                      await loadData();
                      setTeamModal(null);
                    } catch (err) {
                      setStatusMsg(err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderProjects = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Projects</h2>
          <p>Oversee project ownership and associated teams.</p>
        </div>
        <button
          className={`${styles.btn} ${styles.btnAccent}`}
          onClick={() => {
            setProjectModal({ id: null });
            const firstId = users[0]?.id || '';
            setProjectDraft({
              name: '',
              ownerId: firstId,
              ownerName: userNameMap[firstId] || '',
              status: 'Active',
            });
            setAssignProjectDraft({ teamId: '' });
          }}
        >
          + Create Project
        </button>
      </div>
      <div className={styles.grid}>
        {projects.length === 0 ? (
          <div className={styles.emptyCard}>No projects to display.</div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>{project.name}</div>
                <button
                  className={styles.iconButton}
                  title="Delete project"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await adminApi.deleteProject(project.id);
                      setStatusMsg('Project deleted');
                      await loadData();
                    } catch (err) {
                      setStatusMsg(err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  🗑️
                </button>
              </div>
              <div className={styles.muted}>
                Owner: {userNameMap[project.ownerId] || project.ownerName || project.ownerId || '—'}
              </div>
              <div className={styles.metaRow}>
                <span>
                  Teams:{' '}
                  {teams.filter((t) => t.projectId === project.id).length}
                </span>
                <span>
                  Members:{' '}
                  {Array.from(
                    new Set(
                      teams
                        .filter((t) => t.projectId === project.id)
                        .flatMap((t) => t.members?.map((m) => m.userId) || [])
                    )
                  ).length}
                </span>
              </div>
              <div className={`${styles.tag} ${project.status === 'Passive' ? styles.tagDanger : styles.tagSuccess}`}>
                {project.status || 'Active'}
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.btnGhost}
                  onClick={() => {
                    setProjectModal(project);
                    setProjectDraft({
                      name: project.name,
                      ownerId: project.ownerId || '',
                      ownerName: project.ownerName || userNameMap[project.ownerId] || '',
                      status: project.status || 'Active',
                    });
                  }}
                >
                  Edit Project
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {projectModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.cardTitle}>
                  {projectModal.id ? 'Project details' : 'Create Project'}
                </div>
              </div>
              <button className={styles.btnGhost} onClick={() => setProjectModal(null)}>
                Close
              </button>
            </div>
            <div className={styles.modalGrid}>
              <label>
                Name
                <input
                  className={styles.input}
                  value={projectDraft.name}
                  onChange={(e) => setProjectDraft((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label>
                Owner
                <select
                  className={styles.select}
                  value={projectDraft.ownerId}
                  onChange={(e) => setProjectDraft((p) => ({ ...p, ownerId: e.target.value }))}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.inlineRow}>
              <div className={styles.toggleGroup}>
                <span>Status</span>
                <button
                  type="button"
                  className={`${styles.toggle} ${
                    projectDraft.status === 'Passive' ? styles.toggleOff : styles.toggleOn
                  }`}
                  onClick={() =>
                    setProjectDraft((p) => ({
                      ...p,
                      status: p.status === 'Passive' ? 'Active' : 'Passive',
                    }))
                  }
                >
                  <span className={styles.toggleText}>
                    {projectDraft.status === 'Passive' ? 'Passive' : 'Active'}
                  </span>
                  <span
                    className={`${styles.toggleKnob} ${
                      projectDraft.status === 'Passive' ? styles.knobOff : styles.knobOn
                    }`}
                  />
                </button>
              </div>
            </div>
              <div className={styles.inlinePanel}>
                <div className={styles.inlineRow}>
              <label>Add team to project</label>
              <select
                className={styles.select}
                value={assignProjectDraft.teamId}
                onChange={(e) =>
                  setAssignProjectDraft((p) => ({
                    ...p,
                    teamId: e.target.value,
                  }))
                }
              >
                <option value="">Select Team</option>
                {teams
                  .filter((t) =>
                    assignMode === 'add' ? t.projectId !== projectModal.id : t.projectId === projectModal.id
                  )
                  .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className={`${styles.toggle} ${assignMode === 'delete' ? styles.toggleOff : styles.toggleOn}`}
                    onClick={() => {
                      const next = assignMode === 'add' ? 'delete' : 'add';
                      setAssignMode(next);
                      setAssignProjectDraft({ teamId: '' });
                    }}
                  >
                    <span className={styles.toggleText}>{assignMode === 'delete' ? 'Delete' : 'Add'}</span>
                    <span
                      className={`${styles.toggleKnob} ${
                        assignMode === 'delete' ? styles.knobOff : styles.knobOn
                      }`}
                    />
                  </button>
                </div>
              <div className={styles.inlineRow}>
                <label>Teams in this project</label>
                <div className={styles.chipRow}>
                  {teams
                    .filter((t) => t.projectId === projectModal.id)
                    .map((t) => (
                      <button key={t.id} className={styles.chip}>
                        {t.name} ({t.members?.length || 0})
                      </button>
                    ))}
                  {teams.filter((t) => t.projectId === projectModal.id).length === 0 && (
                    <span className={styles.muted}>No teams yet</span>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.actions}>
              {projectModal?.id ? (
                <button
                  className={styles.btnPrimary}
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await adminApi.updateProject(projectModal.id, {
                        name: projectDraft.name,
                        ownerId: projectDraft.ownerId,
                        ownerName: projectDraft.ownerName || userNameMap[projectDraft.ownerId] || projectDraft.ownerId,
                        status: projectDraft.status || 'Active',
                      });
                      await handleTeamAssignAction();
                      setStatusMsg('Project updated');
                      await loadData();
                      setProjectModal(null);
                    } catch (err) {
                      setStatusMsg(err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Save Changes
                </button>
              ) : (
                <button
                  className={styles.btnPrimary}
                  onClick={async () => {
                    if (!projectDraft.name || !projectDraft.ownerId) {
                      setStatusMsg('Name ve owner zorunlu');
                      return;
                    }
                    try {
                      setLoading(true);
                      await adminApi.createProject({
                        name: projectDraft.name,
                        ownerId: projectDraft.ownerId,
                        ownerName: projectDraft.ownerName || userNameMap[projectDraft.ownerId] || projectDraft.ownerId,
                        status: projectDraft.status || 'Active',
                      });
                      setStatusMsg('Project created');
                      await loadData();
                      setProjectModal(null);
                    } catch (err) {
                      setStatusMsg(err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Create project
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>NEXORA Admin</div>
        <nav className={styles.nav}>
          <button
            className={`${styles.navItem} ${activeTab === 'users' ? styles.navActive : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <span className={styles.navIcon}>👤</span> Users
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'teams' ? styles.navActive : ''}`}
            onClick={() => setActiveTab('teams')}
          >
            <span className={styles.navIcon}>👥</span> Teams
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'projects' ? styles.navActive : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <span className={styles.navIcon}>📁</span> Projects
          </button>
        </nav>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>Admin Panel</h1>
            <p className={styles.muted}>Control users, teams, and projects in one calm view.</p>
          </div>
          <div className={styles.headerTools}>
            <input className={styles.search} placeholder="Search..." aria-label="Search admin" />
            {token ? (
              <button className={styles.btnGhost} onClick={handleLogout}>
                Logout
              </button>
            ) : null}
          </div>
        </header>

        {!token ? (
          <section className={styles.content}>
            <form className={styles.loginPanel} onSubmit={handleLogin}>
              <div>
                <div className={styles.cardTitle}>Admin Login</div>
                <p className={styles.muted}>Kayıtlı admin bilgisiyle giriş yapın.</p>
              </div>
              <div className={styles.loginGrid}>
                <input
                  className={styles.search}
                  placeholder="Username"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                />
                <input
                  className={styles.search}
                  type="password"
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                />
                <button className={styles.btnAccent} type="submit" disabled={loading}>
                  {loading ? 'Signing in...' : 'Login'}
                </button>
              </div>
              {loginError && <div className={styles.errorText}>{loginError}</div>}
            </form>
          </section>
        ) : (
          <section className={styles.content}>
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'teams' && renderTeams()}
            {activeTab === 'projects' && renderProjects()}
            {statusMsg && <div className={styles.statusText}>{statusMsg}</div>}
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminConsole;
