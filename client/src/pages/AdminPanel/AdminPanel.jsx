import { useEffect, useMemo, useState } from 'react';
import { adminApi, getAdminToken } from '../../api/adminApi';
import styles from './AdminPanel.module.css';

const defaultCreds = { username: '', password: '' };

const AdminPanel = () => {
  const [token, setToken] = useState(getAdminToken());
  const [loginForm, setLoginForm] = useState(defaultCreds);
  const [loginError, setLoginError] = useState('');

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);

  const [projectName, setProjectName] = useState('');
  const [parentProjectId, setParentProjectId] = useState('');
  const [projectEndDate, setProjectEndDate] = useState('');

  const [teamName, setTeamName] = useState('');
  const [leaderId, setLeaderId] = useState('');

  const [memberId, setMemberId] = useState('');
  const [memberRole, setMemberRole] = useState('developer');

  const [userRole, setUserRole] = useState('developer');
  const [userLanguages, setUserLanguages] = useState('');
  const [userSkills, setUserSkills] = useState('');
  const [userExperience, setUserExperience] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState('');

  const [activeTab, setActiveTab] = useState('users');
  const [statusMessage, setStatusMessage] = useState('');

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        id: u.id || u._id,
        label: `${u.name} (${u.email})`,
      })),
    [users]
  );

  const userNameMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      const key = u.id || u._id;
      if (key) {
        map[key] = u.name || u.email || key;
      }
    });
    return map;
  }, [users]);

  const projectNameMap = useMemo(() => {
    const map = {};
    projects.forEach((p) => {
      const key = p.id || p._id;
      if (key) {
        map[key] = p.name;
      }
    });
    return map;
  }, [projects]);

  const resetUserSelectionsIfNeeded = (list) => {
    const firstId = list[0]?.id || '';
    if (!list.length) {
      setLeaderId('');
      setMemberId('');
      setSelectedUserId('');
      return;
    }
    if (!list.find((u) => u.id === leaderId)) setLeaderId(firstId);
    if (!list.find((u) => u.id === memberId)) setMemberId(firstId);
    if (!list.find((u) => u.id === selectedUserId)) setSelectedUserId(firstId);
  };

  const loadData = async () => {
    try {
      const [projectList, teamList, userList] = await Promise.all([
        adminApi.projects(),
        adminApi.teams(),
        adminApi.users(),
      ]);
      setProjects(projectList);
      setTeams(teamList);
      setUsers(userList);
      resetUserSelectionsIfNeeded(userList);
      if (!selectedProjectId && projectList.length) {
        setSelectedProjectId(projectList[0].id);
      }
    } catch (err) {
      setStatusMessage(err.message);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await adminApi.login(loginForm);
      setToken(res.token);
      setLoginError('');
      setStatusMessage('Admin logged in');
      loadData();
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const logout = () => {
    adminApi.logout();
    setToken(null);
    setUsers([]);
    setTeams([]);
    setProjects([]);
  };

  const createProject = async () => {
    if (!projectName.trim()) return;
    try {
      const endDate = projectEndDate ? new Date(projectEndDate).getTime() : null;
      await adminApi.createProject({ name: projectName, parentProjectId: parentProjectId || null, endDate });
      setProjectName('');
      setParentProjectId('');
      setProjectEndDate('');
      setStatusMessage('Project created');
      loadData();
    } catch (err) {
      setStatusMessage(err.message);
    }
  };

  const createTeam = async () => {
    if (!teamName.trim()) {
      setStatusMessage('Team name zorunlu');
      return;
    }
    if (!leaderId) {
      setStatusMessage('Lider seçin');
      return;
    }
    if (!selectedProjectId) {
      setStatusMessage('Project seçin');
      return;
    }
    try {
      await adminApi.createTeam({
        name: teamName,
        leaderId,
        projectId: selectedProjectId,
        members: [],
      });
      setTeamName('');
      setLeaderId('');
      setStatusMessage('Team created');
      loadData();
    } catch (err) {
      setStatusMessage(err.message);
    }
  };

  const addMember = async () => {
    if (!memberId) {
      setStatusMessage('Üye seçin');
      return;
    }
    const teamId =
      teams.find(
        (t) =>
          t.projectId === selectedProjectId ||
          (t.projectHistory || []).some((entry) => entry === selectedProjectId)
      )?.id || teams[0]?.id;
    if (!teamId) {
      setStatusMessage('No team selected/available');
      return;
    }
    try {
      await adminApi.addTeamMember(teamId, { userId: memberId, role: memberRole });
      setMemberId('');
      setStatusMessage('Member added');
      loadData();
    } catch (err) {
      setStatusMessage(err.message);
    }
  };

  const removeMember = async (teamId, userId) => {
    try {
      await adminApi.removeTeamMember(teamId, userId);
      setStatusMessage('Member removed');
      loadData();
    } catch (err) {
      setStatusMessage(err.message);
    }
  };

  const deleteTeam = async (teamId) => {
    try {
      await adminApi.deleteTeam(teamId);
      setStatusMessage('Team deleted');
      loadData();
    } catch (err) {
      setStatusMessage(err.message);
    }
  };

  const saveUserMeta = async () => {
    if (!selectedUserId) return;
    try {
      await adminApi.updateUserMeta(selectedUserId, {
        role: userRole,
        languages: userLanguages
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        skills: userSkills
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        experienceYears: Number(userExperience) || 0,
      });
      setStatusMessage('User meta saved');
      loadData();
    } catch (err) {
      setStatusMessage(err.message);
    }
  };

  if (!token) {
    return (
      <div className={styles.loginWrapper}>
        <form className={styles.loginForm} onSubmit={handleLogin}>
          <h2>Admin Login</h2>
          <input
            placeholder="Username"
            value={loginForm.username}
            onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))}
          />
          <input
            type="password"
            placeholder="Password"
            value={loginForm.password}
            onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
          />
          {loginError && <div className={styles.error}>{loginError}</div>}
          <button type="submit">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2>Admin Panel</h2>
        <div className={styles.headerActions}>
          {statusMessage && <span className={styles.status}>{statusMessage}</span>}
          <button onClick={logout} className={styles.logoutBtn}>Logout</button>
        </div>
      </div>

      <div className={styles.tabs}>
        {['users', 'teams', 'projects'].map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className={styles.section}>
          <h3>Users</h3>
          <div className={styles.cards}>
            {users.map((u) => (
              <div key={u.id} className={styles.card} onClick={() => setSelectedUserId(u.id)}>
                <div className={styles.cardTitle}>{u.name}</div>
                <div className={styles.subtle}>{u.email}</div>
                <div className={styles.badge}>{u.meta?.role || 'role'}</div>
                <div className={styles.subtle}>
                  Langs: {(u.meta?.languages || []).join(', ') || '—'}
                </div>
                <div className={styles.subtle}>
                  Skills: {(u.meta?.skills || []).join(', ') || '—'}
                </div>
                <div className={styles.subtle}>Exp: {u.meta?.experienceYears || 0}y</div>
              </div>
            ))}
          </div>
          {selectedUserId && (
            <div className={styles.formRow}>
              <select value={userRole} onChange={(e) => setUserRole(e.target.value)}>
                <option value="developer">developer</option>
                <option value="designer">designer</option>
                <option value="product_manager">product_manager</option>
                <option value="scrum_master">scrum_master</option>
                <option value="team_leader">team_leader</option>
                <option value="admin">admin</option>
              </select>
              <input
                placeholder="Languages (comma separated)"
                value={userLanguages}
                onChange={(e) => setUserLanguages(e.target.value)}
              />
              <input
                placeholder="Skills (comma separated)"
                value={userSkills}
                onChange={(e) => setUserSkills(e.target.value)}
              />
              <input
                placeholder="Experience years"
                type="number"
                value={userExperience}
                onChange={(e) => setUserExperience(e.target.value)}
              />
              <button onClick={saveUserMeta}>Save</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'teams' && (
        <div className={styles.section}>
          <h3>Teams</h3>
          <div className={styles.formRow}>
            <input
              placeholder="Team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            <select
              value={leaderId}
              onChange={(e) => setLeaderId(e.target.value)}
              disabled={!userOptions.length}
            >
              <option value="">Select leader</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button onClick={createTeam}>Create team</button>
          </div>
          <div className={styles.cards}>
            {teams.map((t) => (
              <div key={t.id} className={styles.card}>
                <div className={styles.cardTitle}>{t.name}</div>
                <div className={styles.subtle}>
                  Project:{' '}
                  {(() => {
                    const ids = Array.from(
                      new Set([
                        ...(t.projectHistory || []),
                        ...(t.projectId ? [t.projectId] : []),
                      ])
                    );
                    const names = ids.map((id) => projectNameMap[id]).filter(Boolean);
                    return names.length ? names.join(', ') : '—';
                  })()}
                </div>
                <div className={styles.subtle}>Leader: {userNameMap[t.leaderId] || t.leaderId}</div>
                <div className={styles.subtle}>
                  Members:{' '}
                  {t.members
                    ?.map((m) => `${userNameMap[m.userId] || m.userId} (${m.role})`)
                    .join(', ') || '—'}
                </div>
                <div className={styles.rowActions}>
                  <select
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    disabled={!userOptions.length}
                  >
                    <option value="">Select member</option>
                    {userOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                    <option value="developer">developer</option>
                    <option value="designer">designer</option>
                    <option value="product_manager">product_manager</option>
                    <option value="scrum_master">scrum_master</option>
                    <option value="team_leader">team_leader</option>
                    <option value="admin">admin</option>
                  </select>
                  <button onClick={() => addMember()}>Add</button>
                  {t.members?.map((m) => (
                  <button
                    key={m.userId}
                    className={styles.danger}
                    onClick={() => removeMember(t.id, m.userId)}
                  >
                    Remove {userNameMap[m.userId] || m.userId}
                  </button>
                  ))}
                  <button className={styles.danger} onClick={() => deleteTeam(t.id)}>
                    Delete team
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className={styles.section}>
          <h3>Projects</h3>
          <div className={styles.formRow}>
            <input
              placeholder="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
            <select
              value={parentProjectId}
              onChange={(e) => setParentProjectId(e.target.value)}
            >
              <option value="">Parent (optional)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={projectEndDate}
              onChange={(e) => setProjectEndDate(e.target.value)}
            />
            <button onClick={createProject}>Create project</button>
          </div>
          <div className={styles.cards}>
            {projects.map((p) => (
              <div key={p.id} className={styles.card}>
                <div className={styles.cardTitle}>{p.name}</div>
                <div className={styles.subtle}>Created: {new Date(p.createdAt).toLocaleDateString()}</div>
                <div className={styles.subtle}>
                  End: {p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'}
                </div>
                <div className={styles.subtle}>Parent: {p.parentProjectId || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
