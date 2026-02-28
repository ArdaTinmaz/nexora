import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import styles from './AdminConsole.module.css';
import { adminApi, getAdminToken } from '../../api/adminApi';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import { API_ORIGIN } from '../../config';

// UI-focused Admin Console wired to backend; no mock data kept.
const AdminConsole = () => {
  const defaultAdminProfile = { name: 'Admin', username: 'admin', email: '', avatarURL: '' };
  const maxAvatarSizeBytes = 2 * 1024 * 1024;

  const [activeTab, setActiveTab] = useState('users');
  const [token, setToken] = useState(getAdminToken());
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [adminProfile, setAdminProfile] = useState(defaultAdminProfile);
  const [adminProfileDraft, setAdminProfileDraft] = useState({
    ...defaultAdminProfile,
    password: '',
  });
  const [isAdminProfileOpen, setIsAdminProfileOpen] = useState(false);
  const [adminProfileMsg, setAdminProfileMsg] = useState('');

  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userDraft, setUserDraft] = useState({
    role: 'developer',
    status: 'Active',
    skills: [],
    languages: [],
    experienceYears: 0,
  });
  const [userSkillInput, setUserSkillInput] = useState('');
  const [userAssignDraft, setUserAssignDraft] = useState({ teamId: '', role: 'developer' });
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', avatarURL: '' });
  const [projectModal, setProjectModal] = useState(null);
  const [projectDraft, setProjectDraft] = useState({ name: '', ownerId: '', ownerName: '', status: '' });
  const [assignProjectDraft, setAssignProjectDraft] = useState({ teamId: '' });
  const [assignMode, setAssignMode] = useState('add');
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [roleChangeWarning, setRoleChangeWarning] = useState(null);
  const [teamModal, setTeamModal] = useState(null);
  const [teamDraft, setTeamDraft] = useState({ name: '', leaderId: '' });
  const [memberDraft, setMemberDraft] = useState({ userId: '', role: 'developer' });
  const [memberMode, setMemberMode] = useState('add');
  const avatarInputRef = useRef(null);
  const adminAvatarInputRef = useRef(null);
  const navigate = useNavigate();

  const userNameMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u.id) map[u.id] = u.name || u.email || u.id;
    });
    return map;
  }, [users]);

  const teamLeadOptions = useMemo(
    () =>
      users.filter((u) => String(u?.meta?.role || '').toLowerCase() === 'team_leader'),
    [users]
  );

  const assignedTeamByUserId = useMemo(() => {
    const map = new Map();
    (teams || []).forEach((team) => {
      if (team?.leaderId) {
        map.set(String(team.leaderId), team);
      }
      (team.members || []).forEach((member) => {
        if (member?.userId) {
          map.set(String(member.userId), team);
        }
      });
    });
    return map;
  }, [teams]);

  const availableTeamLeadOptions = useMemo(() => {
    const activeTeamId = teamModal?.team?.id || null;
    return teamLeadOptions.filter((user) => {
      const assignedTeam = assignedTeamByUserId.get(String(user.id));
      if (!assignedTeam) return true;
      return activeTeamId && assignedTeam.id === activeTeamId;
    });
  }, [teamLeadOptions, assignedTeamByUserId, teamModal?.team?.id]);

  const projectOwnerOptions = useMemo(
    () =>
      users.filter((u) => String(u?.meta?.role || '').toLowerCase() === 'product_manager'),
    [users]
  );

  const projectNameMap = useMemo(() => {
    const map = {};
    projects.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [projects]);

  const assignedTeamForUser = useMemo(() => {
    if (!editingUserId || editingUserId === 'create') return null;
    return assignedTeamByUserId.get(String(editingUserId)) || null;
  }, [assignedTeamByUserId, editingUserId]);

  const getAvatarSrc = (user) => {
    if (!user?.avatarURL) return null;
    if (/^(?:https?:|data:|blob:|file:)/i.test(user.avatarURL)) {
      return user.avatarURL;
    }
    if (user.avatarURL.startsWith('/')) {
      return `${API_ORIGIN}${user.avatarURL}`;
    }
    if (user.avatarURL.startsWith('uploads/')) {
      return `${API_ORIGIN}/${user.avatarURL}`;
    }
    return `${API_ORIGIN}/uploads/${user.avatarURL}`;
  };

  const normalizeStatus = (status) =>
    String(status || '').toLowerCase() === 'passive' ? 'Passive' : 'Active';

  const formatRoleLabel = (role) => {
    if (!role) return '—';
    const text = String(role)
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return '—';
    return text.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const teamHasProject = (team, projectId) => {
    if (!team || !projectId) return false;
    const key = String(projectId);
    if (team.projectId && String(team.projectId) === key) return true;
    return (team.projectHistory || []).some((entry) => String(entry) === key);
  };

  const openAdminProfileModal = async () => {
    let baseProfile = adminProfile;
    if (token) {
      try {
        const profile = await adminApi.adminProfile();
        if (profile) {
          baseProfile = {
            name: profile.name || 'Admin',
            username: profile.username || 'admin',
            email: profile.email || '',
            avatarURL: profile.avatarURL || '',
          };
          setAdminProfile(baseProfile);
        }
      } catch (_) {
        // ignore
      }
    }
    setAdminProfileDraft({
      name: baseProfile.name || 'Admin',
      username: baseProfile.username || 'admin',
      email: baseProfile.email || '',
      avatarURL: baseProfile.avatarURL || '',
      password: '',
    });
    setAdminProfileMsg('');
    setIsAdminProfileOpen(true);
  };

  const saveAdminProfile = async () => {
    try {
      setLoading(true);
      setAdminProfileMsg('');
      const payload = {
        name: adminProfileDraft.name?.trim(),
        username: adminProfileDraft.username?.trim(),
        email: adminProfileDraft.email?.trim(),
        avatarURL: adminProfileDraft.avatarURL || '',
      };
      if (adminProfileDraft.password) {
        payload.password = adminProfileDraft.password;
      }
      const updated = await adminApi.updateAdminProfile(payload);
      let nextProfile = {
        name: updated?.name ?? payload.name ?? adminProfile.name ?? 'Admin',
        username: updated?.username ?? payload.username ?? adminProfile.username ?? 'admin',
        email: updated?.email ?? payload.email ?? adminProfile.email ?? '',
        avatarURL: updated?.avatarURL ?? payload.avatarURL ?? adminProfile.avatarURL ?? '',
      };
      try {
        const fresh = await adminApi.adminProfile();
        if (fresh) {
          nextProfile = {
            name: fresh.name || nextProfile.name,
            username: fresh.username || nextProfile.username,
            email: fresh.email || nextProfile.email,
            avatarURL: fresh.avatarURL || nextProfile.avatarURL,
          };
        }
      } catch (_) {
        // ignore
      }
      setAdminProfile(nextProfile);
      if (adminAvatarInputRef.current) {
        adminAvatarInputRef.current.value = '';
      }
      setAdminProfileDraft((prev) => ({ ...prev, password: '' }));
      setAdminProfileMsg('Admin profile updated.');
    } catch (err) {
      const message = err.message || 'Update failed.';
      const translated =
        message.includes('Şifre') || message.includes('Password')
          ? 'Password must be at least 8 characters and include 1 number and 1 uppercase letter.'
          : message.includes('Username')
            ? 'Username is required.'
            : message.includes('Email')
              ? 'Please enter a valid email address.'
              : message.includes('Name')
                ? 'Name is required.'
                : 'Update failed.';
      setAdminProfileMsg(translated);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [u, t, p, profile] = await Promise.all([
        adminApi.users(),
        adminApi.teams(),
        adminApi.projects(),
        adminApi.adminProfile(),
      ]);
      setUsers(u || []);
      setTeams(t || []);
      setProjects(p || []);
      if (profile) {
        setAdminProfile({
          name: profile.name || 'Admin',
          username: profile.username || 'admin',
          email: profile.email || '',
          avatarURL: profile.avatarURL || '',
        });
      }
      setStatusMsg('');
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleLogout = () => {
    adminApi.logout();
    setToken(null);
    setUsers([]);
    setTeams([]);
    setProjects([]);
    navigate('/admin/login');
  };

  const handleCreateUser = async (e) => {
    e?.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) {
      setStatusMsg('Name, email ve password zorunlu');
      return;
    }
    const email = newUser.email.trim();
    const password = newUser.password;
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isEmailValid) {
      setStatusMsg('Geçerli bir e-posta adresi giriniz');
      return;
    }
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (password.length < 8 || !hasUppercase || !hasLowercase || !hasNumber) {
      setStatusMsg('Şifre en az 8 karakter olmalı, en az bir rakam ve en az bir büyük harf içermelidir');
      return;
    }
    try {
      setLoading(true);
      const payload = {
        name: newUser.name.trim(),
        email,
        password: newUser.password,
      };
      if (newUser.avatarURL?.trim()) {
        payload.avatarURL = newUser.avatarURL.trim();
      }
      await adminApi.createUser(payload);
      setNewUser({ name: '', email: '', password: '', avatarURL: '' });
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
      setStatusMsg('User created');
      await loadData();
      setEditingUserId(null);
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarFile = ({ file, onSuccess, setMessage }) => {
    if (!file) return false;
    if (file.size > maxAvatarSizeBytes) {
      const msg = 'Avatar file is too large (max 2MB).';
      if (setMessage) {
        setMessage(msg);
      } else {
        setStatusMsg(msg);
      }
      return false;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSuccess(reader.result);
      }
    };
    reader.readAsDataURL(file);
    return true;
  };

  const openUserModal = (user) => {
    const meta = user?.meta || {};
    const statusValue = normalizeStatus(meta.status || user.status || 'Active');
    setEditingUserId(user.id);
    setUserDraft({
      role: meta.role || user.role || 'developer',
      status: statusValue,
      skills: Array.isArray(meta.skills) ? [...meta.skills] : [],
      languages: Array.isArray(meta.languages) ? [...meta.languages] : [],
      experienceYears: Number(meta.experienceYears) || 0,
    });
    setUserSkillInput('');
    setUserAssignDraft({ teamId: '', role: 'developer' });
  };

  const addSkill = () => {
    const nextSkill = userSkillInput.trim();
    if (!nextSkill) return;
    setUserDraft((prev) => {
      const exists = prev.skills.some((skill) => skill.toLowerCase() === nextSkill.toLowerCase());
      if (exists) return prev;
      return { ...prev, skills: [...prev.skills, nextSkill] };
    });
    setUserSkillInput('');
  };

  const removeSkill = (skillToRemove) => {
    setUserDraft((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove),
    }));
  };

  const handleSaveUser = async () => {
    if (!editingUserId || editingUserId === 'create') return;
    const editingUser = users.find((u) => u.id === editingUserId);
    const currentRole = String(editingUser?.meta?.role || editingUser?.role || '').toLowerCase();
    const nextRole = String(userDraft.role || '').toLowerCase();
    const isRoleChanged = currentRole !== nextRole;
    const isTeamLead = teams.some((team) => {
      const leaderId = team?.leaderId ? String(team.leaderId) : '';
      if (leaderId === editingUserId) return true;
      return (team?.members || []).some(
        (member) =>
          String(member?.userId) === editingUserId &&
          String(member?.role || '').toLowerCase() === 'team_leader'
      );
    });
    if (isRoleChanged && isTeamLead) {
      setEditingUserId(null);
      setRoleChangeWarning({
        name: editingUser?.name || 'This user',
      });
      return;
    }
    try {
      setLoading(true);
      await adminApi.updateUserMeta(editingUserId, {
        role: userDraft.role,
        languages: userDraft.languages,
        experienceYears: userDraft.experienceYears,
        skills: userDraft.skills,
        status: userDraft.status || 'Active',
      });
      setStatusMsg('User updated');
      await loadData();
      setEditingUserId(null);
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeam = async () => {
    if (!editingUserId || editingUserId === 'create') return;
    const draft = userAssignDraft || {};
    if (!draft.teamId || !draft.role) {
      setStatusMsg('Team ve role seçin');
      return;
    }
    if (assignedTeamForUser) {
      setStatusMsg(
        `User already assigned to "${assignedTeamForUser.name || assignedTeamForUser.id}".`
      );
      return;
    }
    try {
      setLoading(true);
      await adminApi.addTeamMember(draft.teamId, { userId: editingUserId, role: draft.role });
      setStatusMsg('Team assignment ok');
      setUserAssignDraft({ teamId: '', role: 'developer' });
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

  const memberOptions = useMemo(() => {
    if (!teamModal?.team || teamModal.mode !== 'members') return [];
    const memberIds = (teamModal.team.members || []).map((m) => m.userId);
    const leaderId = teamModal.team.leaderId;
    const teamId = teamModal.team.id;
    const memberRoleMap = (teamModal.team.members || []).reduce((acc, m) => {
      acc[m.userId] = m.role;
      return acc;
    }, {});
    const isAssignedElsewhere = (userId) => {
      const assignedTeam = assignedTeamByUserId.get(String(userId));
      return assignedTeam && assignedTeam.id !== teamId;
    };
    if (memberMode === 'delete') {
      return users
        .filter(
          (u) =>
            memberIds.includes(u.id) &&
            u.id !== leaderId &&
            memberRoleMap[u.id] !== 'team_leader'
        )
        .map((u) => ({
          ...u,
          role: memberRoleMap[u.id] || u.meta?.role || 'developer',
        }));
    }
    const hasLead = (teamModal.team.members || []).some((m) => m.role === 'team_leader');
    return users
      .filter((u) => !memberIds.includes(u.id))
      .filter((u) => !isAssignedElsewhere(u.id))
      .map((u) => ({
        ...u,
        role: u.meta?.role || 'developer',
      }))
      .filter((u) => !(hasLead && u.role === 'team_leader'));
  }, [teamModal, memberMode, users, assignedTeamByUserId]);

  useEffect(() => {
    if (!teamModal?.team || teamModal.mode !== 'members') return;
    if (!memberOptions.length) {
      if (memberDraft.userId) {
        setMemberDraft((p) => ({ ...p, userId: '' }));
      }
      return;
    }
    const selected = memberOptions.find((u) => u.id === memberDraft.userId);
    if (!selected) {
      setMemberDraft((p) => ({ ...p, userId: memberOptions[0].id, role: memberOptions[0].role }));
      return;
    }
    if (selected.role && selected.role !== memberDraft.role) {
      setMemberDraft((p) => ({ ...p, role: selected.role }));
    }
  }, [teamModal, memberMode, memberOptions, memberDraft.userId]);

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

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      setLoading(true);
      await adminApi.deleteProject(projectToDelete.id);
      setStatusMsg('Project deleted');
      await loadData();
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
      setProjectToDelete(null);
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

  const confirmDeleteTeam = async () => {
    if (!teamToDelete) return;
    try {
      setLoading(true);
      await adminApi.deleteTeam(teamToDelete.id);
      setStatusMsg('Team deleted');
      await loadData();
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
      setTeamToDelete(null);
    }
  };

  const renderUsers = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Users</h2>
        </div>
        <div className={styles.sectionActions}>
          <input
            className={styles.search}
            placeholder="Search users..."
            aria-label="Search users"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          <button className={`${styles.btn} ${styles.btnAccent}`} onClick={() => setEditingUserId('create')}>
            + Create User
          </button>
        </div>
      </div>
      <div className={styles.grid}>
        {(users || []).filter((user) => {
          const q = userSearch.trim().toLowerCase();
          if (q.length < 2) return true;
          return (user.name || '').toLowerCase().includes(q);
        }).length === 0 ? (
          <div className={styles.emptyCard}>No users to display.</div>
        ) : (
          users
            .filter((user) => {
              const q = userSearch.trim().toLowerCase();
              if (q.length < 2) return true;
              return (user.name || '').toLowerCase().includes(q);
            })
            .map((user) => {
            const statusValue = normalizeStatus(user.meta?.status || user.status);
            const skills = Array.isArray(user.meta?.skills) ? user.meta.skills : [];
            const visibleSkills = skills.slice(0, 5);
            const hasMoreSkills = skills.length > 5;
            const avatarSrc = getAvatarSrc(user);
            return (
              <div key={user.id} className={`${styles.card} ${styles.userCard}`}>
                <div className={`${styles.avatar} ${styles.userAvatar}`}>
                  {avatarSrc ? (
                    <img className={styles.avatarImg} src={avatarSrc} alt={`${user.name} avatar`} />
                  ) : (
                    user.name?.slice(0, 1)
                  )}
                </div>
                <div className={`${styles.cardBody} ${styles.userInfo}`}>
                  <div className={styles.userMeta}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaKey}>Name:</span>
                      <span className={styles.metaValue}>{user.name}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaKey}>Role:</span>
                      <span className={styles.metaValue}>
                        {formatRoleLabel(user?.meta?.role || user.role)}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaKey}>Status:</span>
                      <span className={styles.metaValue}>
                        <span
                          className={`${styles.tag} ${
                            statusValue === 'Passive' ? styles.tagDanger : styles.tagSuccess
                          }`}
                        >
                          {statusValue}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.userSkillsRow}>
                  <span className={styles.metaKey}>Skills:</span>
                  <div className={styles.userSkillsList}>
                    {visibleSkills.length > 0 ? (
                      <>
                        {visibleSkills.map((skill) => (
                          <span key={`${user.id}-${skill}`} className={styles.chip}>
                            {skill}
                          </span>
                        ))}
                        {hasMoreSkills && <span className={styles.chip}>...</span>}
                      </>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </div>
                </div>
                <div className={styles.userCardActions}>
                  <button className={styles.btnGhost} onClick={() => openUserModal(user)}>
                    Edit
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {editingUserId && editingUserId !== 'create' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={`${styles.modalHeader} ${styles.modalHeaderCentered}`}>
              <div className={styles.modalHeaderLeft}>
                <div className={styles.cardTitle}>User details</div>
              </div>
              <div className={styles.modalHeaderCenter}>
                <div className={styles.modalHeaderName}>
                  {users.find((u) => u.id === editingUserId)?.name || 'User'}
                </div>
              </div>
              <div className={styles.modalHeaderRight}>
                <button
                  className={`${styles.btnGhost} ${styles.closeIconBtn}`}
                  type="button"
                  onClick={() => setEditingUserId(null)}
                  aria-label="Close user details modal"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className={styles.modalGrid}>
              <label>
                Role
                <select
                  className={styles.select}
                  value={userDraft.role}
                  onChange={(e) => setUserDraft((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="">Select role</option>
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {formatRoleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Skills
                <div className={styles.skillInputRow}>
                  <input
                    className={`${styles.input} ${styles.skillInput}`}
                    placeholder="Add skill"
                    value={userSkillInput}
                    onChange={(e) => setUserSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                  />
                  <button type="button" className={styles.btnGhostSmall} onClick={addSkill}>
                    Add
                  </button>
                </div>
              </label>
            </div>
            <div className={styles.chipRow}>
              {userDraft.skills.length ? (
                userDraft.skills.map((skill) => (
                  <button
                    key={`skill-${skill}`}
                    type="button"
                    className={styles.chip}
                    onClick={() => removeSkill(skill)}
                    aria-label={`Remove ${skill}`}
                  >
                    {skill} x
                  </button>
                ))
              ) : (
                <span className={styles.muted}>No skills added</span>
              )}
            </div>
            <div className={styles.inlineRow}>
              <div className={styles.toggleGroup}>
                <span>Status</span>
                <button
                  type="button"
                  className={`${styles.toggle} ${
                    userDraft.status === 'Passive' ? styles.toggleOff : styles.toggleOn
                  }`}
                  onClick={() =>
                    setUserDraft((prev) => ({
                      ...prev,
                      status: prev.status === 'Passive' ? 'Active' : 'Passive',
                    }))
                  }
                >
                  <span className={styles.toggleText}>
                    {userDraft.status === 'Passive' ? 'Passive' : 'Active'}
                  </span>
                  <span
                    className={`${styles.toggleKnob} ${
                      userDraft.status === 'Passive' ? styles.knobOff : styles.knobOn
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className={styles.inlinePanel}>
              {assignedTeamForUser ? (
                <div className={styles.assignNotice}>
                  {`User is already assigned to "${
                    assignedTeamForUser.name || assignedTeamForUser.id
                  }". Remove them from that team to assign a new one.`}
                </div>
              ) : (
                <div className={styles.assignRow}>
                  <label>
                    Assign to team
                    <select
                      className={styles.select}
                      value={userAssignDraft.teamId}
                      onChange={(e) =>
                        setUserAssignDraft((prev) => ({ ...prev, teamId: e.target.value }))
                      }
                    >
                      <option value="">Select Team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Team role
                    <select
                      className={styles.select}
                      value={userAssignDraft.role}
                      onChange={(e) =>
                        setUserAssignDraft((prev) => ({ ...prev, role: e.target.value }))
                      }
                    >
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {formatRoleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className={styles.btnGhost} onClick={handleAssignTeam}>
                    Add to team
                  </button>
                </div>
              )}
            </div>
            <div className={styles.actionsEnd}>
              <button className={styles.btnPrimary} onClick={handleSaveUser} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {editingUserId === 'create' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.cardTitle}>Create User</div>
                <div className={`${styles.muted} ${styles.createSubtitle}`}>
                  Add a new user with optional avatar.
                </div>
              </div>
              <button
                className={`${styles.btnGhost} ${styles.closeIconBtn}`}
                type="button"
                onClick={() => setEditingUserId(null)}
                aria-label="Close create user modal"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className={styles.modalGrid}>
                <label>
                  Name
                  <input
                    className={styles.input}
                    placeholder="Name"
                    value={newUser.name}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </label>
                <label>
                  Email
                  <input
                    className={styles.input}
                    placeholder="Email"
                    value={newUser.email}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </label>
                <label>
                  Password
                  <input
                    className={styles.input}
                    type="password"
                    placeholder="Password"
                    value={newUser.password}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </label>
                <label>
                  Avatar (Optional)
                  <div className={styles.uploadField}>
                    <input
                      ref={avatarInputRef}
                      className={styles.fileInput}
                      type="file"
                      accept="image/*"
                      id="admin-avatar-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        setNewUser((prev) => ({ ...prev, avatarURL: '' }));
                        return;
                      }
                      const ok = handleAvatarFile({
                        file,
                        onSuccess: (dataUrl) =>
                          setNewUser((prev) => ({
                            ...prev,
                            avatarURL: dataUrl,
                          })),
                      });
                      if (!ok && avatarInputRef.current) {
                        avatarInputRef.current.value = '';
                      }
                    }}
                  />
                    <label htmlFor="admin-avatar-upload" className={styles.uploadButton}>
                      Upload avatar
                    </label>
                    {newUser.avatarURL ? (
                      <div className={styles.uploadPreviewWrap}>
                        <img
                          className={styles.uploadPreview}
                          src={newUser.avatarURL}
                          alt="Avatar preview"
                        />
                        <button
                          type="button"
                          className={styles.uploadRemove}
                          onClick={() => {
                            setNewUser((prev) => ({ ...prev, avatarURL: '' }));
                            if (avatarInputRef.current) {
                              avatarInputRef.current.value = '';
                            }
                          }}
                          aria-label="Remove avatar"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <span className={styles.uploadHint}>No file chosen</span>
                    )}
                  </div>
                </label>
              </div>
              <div className={styles.actionsEnd}>
                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={Boolean(roleChangeWarning)}
        title="Role change blocked"
        message={`${
          roleChangeWarning?.name || 'This user'
        } is a team lead in one or more teams, so their role cannot be changed.`}
        confirmLabel="OK"
        cancelLabel="×"
        onCancel={() => setRoleChangeWarning(null)}
        onConfirm={() => setRoleChangeWarning(null)}
      />
    </>
  );

  const renderTeams = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Teams</h2>
        </div>
        <div className={styles.sectionActions}>
          <input
            className={styles.search}
            placeholder="Search teams..."
            aria-label="Search teams"
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
          />
          <button
            className={`${styles.btn} ${styles.btnAccent}`}
            onClick={() => {
              setTeamModal({ mode: 'create' });
              setTeamDraft({
                name: '',
                leaderId: availableTeamLeadOptions[0]?.id || '',
              });
            }}
          >
            + Create Team
          </button>
        </div>
      </div>
      <div className={styles.grid}>
        {(teams || []).filter((team) => {
          const q = teamSearch.trim().toLowerCase();
          if (q.length < 2) return true;
          return (team.name || '').toLowerCase().includes(q);
        }).length === 0 ? (
          <div className={styles.emptyCard}>No teams to display.</div>
        ) : (
          teams
            .filter((team) => {
              const q = teamSearch.trim().toLowerCase();
              if (q.length < 2) return true;
              return (team.name || '').toLowerCase().includes(q);
            })
            .map((team) => (
            <div key={team.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>{team.name}</div>
                <button
                  className={styles.iconButton}
                  title="Delete team"
                  onClick={() => setTeamToDelete(team)}
                >
                  🗑️
                </button>
              </div>
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
                <button
                  className={`${styles.btnGhost} ${styles.closeIconBtn}`}
                  type="button"
                  onClick={() => setTeamModal(null)}
                  aria-label="Close team modal"
                >
                  &times;
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
                    <option value="">Select team lead</option>
                    {availableTeamLeadOptions.length ? (
                      availableTeamLeadOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        No team leaders
                      </option>
                    )}
                  </select>
                </label>
              </div>
            )}

            {teamModal.mode === 'members' && teamModal.team && (
              <div className={`${styles.inlinePanel} ${styles.membersPanel}`}>
                <div className={styles.inlineRow}>
                  <div className={styles.sectionLabel}>Add/Delete member</div>
                  <button
                    type="button"
                    className={`${styles.toggle} ${memberMode === 'delete' ? styles.toggleOff : styles.toggleOn}`}
                    onClick={() => {
                      const next = memberMode === 'add' ? 'delete' : 'add';
                      setMemberMode(next);
                      const memberIds = (teamModal.team.members || []).map((m) => m.userId);
                      const leaderId = teamModal.team.leaderId;
                      const memberRoleMap = (teamModal.team.members || []).reduce((acc, m) => {
                        acc[m.userId] = m.role;
                        return acc;
                      }, {});
                      const isAssignedElsewhere = (userId) => {
                        const assignedTeam = assignedTeamByUserId.get(String(userId));
                        return assignedTeam && assignedTeam.id !== teamModal.team.id;
                      };
                      const hasLead = (teamModal.team.members || []).some((m) => m.role === 'team_leader');
                      const nextOptions =
                        next === 'delete'
                          ? users
                              .filter(
                                (u) =>
                                  memberIds.includes(u.id) &&
                                  u.id !== leaderId &&
                                  memberRoleMap[u.id] !== 'team_leader'
                              )
                              .map((u) => ({
                                ...u,
                                role: memberRoleMap[u.id] || u.meta?.role || 'developer',
                              }))
                          : users
                              .filter((u) => !memberIds.includes(u.id))
                              .filter((u) => !isAssignedElsewhere(u.id))
                              .map((u) => ({
                                ...u,
                                role: u.meta?.role || 'developer',
                              }))
                              .filter((u) => !(hasLead && u.role === 'team_leader'));
                      const firstMatch = nextOptions[0]?.id || '';
                      const selected = nextOptions.find((u) => u.id === firstMatch);
                      setMemberDraft((p) => ({
                        ...p,
                        userId: firstMatch,
                        role: selected?.role || p.role,
                      }));
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
                    onChange={(e) => {
                      const selected = memberOptions.find((u) => u.id === e.target.value);
                      setMemberDraft((p) => ({
                        ...p,
                        userId: e.target.value,
                        role: selected?.role || p.role,
                      }));
                    }}
                    disabled={!memberOptions.length}
                  >
                    <option value="">{memberOptions.length ? 'Select member' : 'No members'}</option>
                    {memberOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email} ({formatRoleLabel(u.role)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.membersSection}>
                  <div className={styles.sectionLabel}>Members</div>
                  <div className={`${styles.chipRow} ${styles.membersGrid}`}>
                    {teamModal.team.members?.length ? (
                      teamModal.team.members.map((m) => (
                        <span key={m.userId} className={styles.chip}>
                          {userNameMap[m.userId] || m.userId} ({formatRoleLabel(m.role)})
                        </span>
                      ))
                    ) : (
                      <span className={styles.muted}>No members</span>
                    )}
                  </div>
                </div>
                <div className={styles.membersActions}>
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

            <div className={styles.actionsEnd}>
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
      <ConfirmModal
        isOpen={Boolean(teamToDelete)}
        title="Delete team"
        message={`Are you sure you want to delete "${teamToDelete?.name || 'this team'}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setTeamToDelete(null)}
        onConfirm={confirmDeleteTeam}
      />
    </>
  );

  const renderProjects = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Projects</h2>
        </div>
        <div className={styles.sectionActions}>
          <input
            className={styles.search}
            placeholder="Search projects..."
            aria-label="Search projects"
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
          />
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
      </div>
      <div className={styles.grid}>
        {(projects || []).filter((project) => {
          const q = projectSearch.trim().toLowerCase();
          if (q.length < 2) return true;
          return (project.name || '').toLowerCase().includes(q);
        }).length === 0 ? (
          <div className={styles.emptyCard}>No projects to display.</div>
        ) : (
          projects
            .filter((project) => {
              const q = projectSearch.trim().toLowerCase();
              if (q.length < 2) return true;
              return (project.name || '').toLowerCase().includes(q);
            })
            .map((project) => (
            <div key={project.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>{project.name}</div>
                <button
                  className={styles.iconButton}
                  title="Delete project"
                  onClick={() => setProjectToDelete(project)}
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
                  {teams.filter((t) => teamHasProject(t, project.id)).length}
                </span>
                <span>
                  Members:{' '}
                  {Array.from(
                    new Set(
                      teams
                        .filter((t) => teamHasProject(t, project.id))
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
              <button
                className={`${styles.btnGhost} ${styles.closeIconBtn}`}
                type="button"
                onClick={() => setProjectModal(null)}
                aria-label="Close project modal"
              >
                &times;
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
                  <option value="">Select owner</option>
                  {projectOwnerOptions.length ? (
                    projectOwnerOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      No product managers
                    </option>
                  )}
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
                    assignMode === 'add'
                      ? !teamHasProject(t, projectModal.id)
                      : teamHasProject(t, projectModal.id)
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
                    .filter((t) => teamHasProject(t, projectModal.id))
                    .map((t) => (
                      <button key={t.id} className={styles.chip}>
                        {t.name} ({t.members?.length || 0})
                      </button>
                    ))}
                  {teams.filter((t) => teamHasProject(t, projectModal.id)).length === 0 && (
                    <span className={styles.muted}>No teams yet</span>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.actionsEnd}>
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
                      const created = await adminApi.createProject({
                        name: projectDraft.name,
                        ownerId: projectDraft.ownerId,
                        ownerName: projectDraft.ownerName || userNameMap[projectDraft.ownerId] || projectDraft.ownerId,
                        status: projectDraft.status || 'Active',
                      });
                      if (assignProjectDraft.teamId) {
                        try {
                          await adminApi.updateTeamProject(created.id, assignProjectDraft.teamId);
                        } catch (assignErr) {
                          setStatusMsg(`Project created, but team assignment failed: ${assignErr.message}`);
                        }
                      }
                      setStatusMsg('Project created');
                      await loadData();
                      setProjectModal(null);
                      setAssignProjectDraft({ teamId: '' });
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
      <ConfirmModal
        isOpen={Boolean(projectToDelete)}
        title="Delete project"
        message={`Are you sure you want to delete "${projectToDelete?.name || 'this project'}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setProjectToDelete(null)}
        onConfirm={confirmDeleteProject}
      />
    </>
  );

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>NEXORA</div>
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
        <div className={styles.sidebarFooter}>
          <button type="button" className={styles.profileCard} onClick={openAdminProfileModal}>
            <div className={styles.profileAvatar}>
              {adminProfile.avatarURL ? (
                <img
                  className={styles.profileAvatarImg}
                  src={adminProfile.avatarURL}
                  alt="Admin avatar"
                  onError={() => {
                    setAdminProfile((prev) => ({ ...prev, avatarURL: '' }));
                  }}
                />
              ) : (
                <span className={styles.profileAvatarEmoji}>👤</span>
              )}
            </div>
            <div className={styles.profileMeta}>
              <div className={styles.profileName}>
                {adminProfile.name || adminProfile.username || 'Admin'}
              </div>
              <div className={styles.profileHint}>Profile</div>
            </div>
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>Admin Panel</h1>
            <p className={styles.muted}>Control users, teams, and projects in one calm view.</p>
          </div>
          <div className={styles.headerTools}>
            {token ? (
              <button className={`${styles.btnGhost} ${styles.btnLogout}`} onClick={handleLogout}>
                Logout
              </button>
            ) : null}
          </div>
        </header>

        <section className={styles.content}>
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'teams' && renderTeams()}
          {activeTab === 'projects' && renderProjects()}
          {statusMsg && <div className={styles.statusText}>{statusMsg}</div>}
        </section>
      </main>

      {isAdminProfileOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.cardTitle}>Admin Profile</div>
                <div className={`${styles.muted} ${styles.createSubtitle}`}>
                  Update admin name, email, password, and avatar.
                </div>
              </div>
              <button
                className={`${styles.btnGhost} ${styles.closeIconBtn}`}
                type="button"
                onClick={() => setIsAdminProfileOpen(false)}
                aria-label="Close admin profile modal"
              >
                &times;
              </button>
            </div>
            <div className={styles.modalGrid}>
              <label>
                Admin name
                <input
                  className={styles.input}
                  placeholder="Admin name"
                  value={adminProfileDraft.name}
                  onChange={(e) => setAdminProfileDraft((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label>
                Username
                <input
                  className={styles.input}
                  placeholder="Username"
                  value={adminProfileDraft.username}
                  onChange={(e) =>
                    setAdminProfileDraft((prev) => ({ ...prev, username: e.target.value }))
                  }
                />
              </label>
              <label>
                Email
                <input
                  className={styles.input}
                  placeholder="admin@nexora.com"
                  value={adminProfileDraft.email || ''}
                  onChange={(e) =>
                    setAdminProfileDraft((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </label>
              <label>
                Password
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Password"
                  value={adminProfileDraft.password}
                  onChange={(e) =>
                    setAdminProfileDraft((prev) => ({ ...prev, password: e.target.value }))
                  }
                />
              </label>
              <label>
                Avatar (Optional)
                <div className={styles.uploadField}>
                  <input
                    ref={adminAvatarInputRef}
                    className={styles.fileInput}
                    type="file"
                    accept="image/*"
                    id="admin-profile-avatar-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        setAdminProfileDraft((prev) => ({ ...prev, avatarURL: '' }));
                        return;
                      }
                      const ok = handleAvatarFile({
                        file,
                        onSuccess: (dataUrl) =>
                          setAdminProfileDraft((prev) => ({
                            ...prev,
                            avatarURL: dataUrl,
                          })),
                        setMessage: setAdminProfileMsg,
                      });
                      if (!ok && adminAvatarInputRef.current) {
                        adminAvatarInputRef.current.value = '';
                      }
                    }}
                  />
                  <label htmlFor="admin-profile-avatar-upload" className={styles.uploadButton}>
                    Upload avatar
                  </label>
                  {adminProfileDraft.avatarURL ? (
                    <div className={styles.uploadPreviewWrap}>
                      <img
                        className={styles.uploadPreview}
                        src={adminProfileDraft.avatarURL}
                        alt="Admin avatar preview"
                      />
                      <button
                        type="button"
                        className={styles.uploadRemove}
                        onClick={() => {
                          setAdminProfileDraft((prev) => ({ ...prev, avatarURL: '' }));
                          if (adminAvatarInputRef.current) {
                            adminAvatarInputRef.current.value = '';
                          }
                        }}
                        aria-label="Remove avatar"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <span className={styles.uploadHint}>No file chosen</span>
                  )}
                </div>
              </label>
            </div>
            {adminProfileMsg && <div className={styles.modalMessage}>{adminProfileMsg}</div>}
            <div className={styles.actionsEnd}>
              <button className={styles.btnPrimary} onClick={saveAdminProfile}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConsole;
