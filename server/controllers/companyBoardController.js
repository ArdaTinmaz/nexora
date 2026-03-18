const mongoose = require('mongoose');
const Board = require('../models/Board');
const BoardColumn = require('../models/BoardColumn');
const Card = require('../models/Card');
const Project = require('../models/Project');
const Team = require('../models/Team');
const TaskAssignment = require('../models/TaskAssignment');
const { findUserRoleInTeam } = require('../realtime/roomAuth');
const { createNotificationsForUsers } = require('../services/notificationService');

const now = () => Date.now();

const notFound = (message = 'Resource not found') => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const forbidden = (message = 'Forbidden') => {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
};

const toObjectId = (value, message) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw badRequest(message);
  }
  return new mongoose.Types.ObjectId(value);
};

const assigneeLimitByPriority = {
  without: 1,
  low: 1,
  medium: 2,
  high: 3,
};

const getMaxAssignees = (priority) => assigneeLimitByPriority[priority] || 1;

const normalizeCardAssignees = (doc) => {
  const mapped = Array.isArray(doc?.assignees)
    ? doc.assignees
        .map((assignee) => {
          const userId = assignee?.userId ? assignee.userId.toString() : '';
          if (!userId) return null;
          return {
            userId,
            name: assignee?.name || '',
            avatarURL: assignee?.avatarURL || '',
            claimedAt: Number.isFinite(assignee?.claimedAt) ? assignee.claimedAt : null,
          };
        })
        .filter(Boolean)
    : [];

  const deduped = [];
  const seen = new Set();
  mapped.forEach((assignee) => {
    if (seen.has(assignee.userId)) return;
    seen.add(assignee.userId);
    deduped.push(assignee);
  });

  if (deduped.length) return deduped;

  if (doc?.ownerId) {
    return [{
      userId: doc.ownerId.toString(),
      name: doc.ownerName || '',
      avatarURL: doc.ownerAvatarURL || '',
      claimedAt: Number.isFinite(doc?.updatedAt) ? doc.updatedAt : null,
    }];
  }

  return [];
};

const toStoredAssignees = (assignees) =>
  assignees.map((assignee) => ({
    userId: toObjectId(assignee.userId, 'Invalid user'),
    name: assignee.name || '',
    avatarURL: assignee.avatarURL || '',
    claimedAt: Number.isFinite(assignee.claimedAt) ? assignee.claimedAt : now(),
  }));

const isUserAssignedToCard = (card, userId) =>
  normalizeCardAssignees(card).some((assignee) => assignee.userId === userId);

const mapBoard = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  icon: doc.icon,
  iconName: doc.iconName,
  background: doc.background,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const mapColumn = (doc) => ({
  id: doc._id.toString(),
  boardId: doc.boardId.toString(),
  title: doc.title,
  position: doc.position,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const mapCard = (doc) => {
  const assignees = normalizeCardAssignees(doc);
  const primaryAssignee = assignees[0] || null;

  return {
    id: doc._id.toString(),
    columnId: doc.columnId.toString(),
    title: doc.title,
    description: doc.description,
    priority: doc.priority,
    position: Number.isFinite(doc.position) ? doc.position : 0,
    deadline: doc.deadline,
    completed: Boolean(doc.completed),
    completedAt: doc.completedAt ?? null,
    ownerId: primaryAssignee?.userId || null,
    ownerName: primaryAssignee?.name || '',
    ownerAvatarURL: primaryAssignee?.avatarURL || '',
    assignees,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const normalizeDeadlineInput = (value, fallback = null) => {
  if (typeof value === 'undefined') return fallback;
  if (value === null || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw badRequest('Invalid deadline');
    }
    return parsed.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const parsed = new Date(Number(trimmed));
      if (Number.isNaN(parsed.getTime())) {
        throw badRequest('Invalid deadline');
      }
      return parsed.toISOString().slice(0, 10);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  throw badRequest('Invalid deadline');
};

const toAssignmentDeadline = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
};

const clampIndex = (value, min, max) => Math.min(Math.max(value, min), max);

const syncAssignmentStatusByCardId = async ({ cardId, completed }) => {
  if (!cardId) return;
  const nextStatus = completed ? 'completed' : 'in-progress';
  await TaskAssignment.updateMany({ cardId: String(cardId) }, { status: nextStatus });
};

const syncAssignmentAssigneeByCardId = async ({ cardId, assignedTo, status }) => {
  if (!cardId || !assignedTo) return;

  const updates = {
    assignedTo: toObjectId(assignedTo, 'Invalid user'),
  };

  if (status) {
    updates.status = status;
  }

  await TaskAssignment.updateMany({ cardId: String(cardId) }, updates);
};

const getUserRoleForProject = async ({ projectId, userId }) => {
  const projectObjectId = toObjectId(projectId, 'Invalid project');
  const teams = await Team.find({
    $or: [{ projectId: projectObjectId }, { projectHistory: projectObjectId }],
  }).lean();

  if (!teams.length) {
    throw forbidden('No access to project');
  }

  let role = null;
  let teamId = null;
  teams.forEach((team) => {
    const teamRole = findUserRoleInTeam(team, userId);
    if (!teamRole) return;
    if (teamRole === 'team_leader') {
      role = 'team_leader';
      teamId = team._id.toString();
      return;
    }
    if (role === 'team_leader') {
      return;
    }
    if (teamRole === 'admin') {
      role = 'admin';
      teamId = team._id.toString();
      return;
    }
    if (!role) {
      role = teamRole;
      teamId = team._id.toString();
    }
  });

  if (!role) {
    throw forbidden('No access to project');
  }

  return { role, teamId, projectObjectId };
};

const getOrCreateCompanyBoard = async ({ projectId }) => {
  const projectObjectId = toObjectId(projectId, 'Invalid project');
  let board = await Board.findOne({ projectId: projectObjectId, type: 'company' }).lean();
  if (board) return board;

  const project = await Project.findById(projectObjectId).lean();
  if (!project) {
    throw notFound('Project not found');
  }

  const timestamp = now();
  const created = await Board.create({
    projectId: projectObjectId,
    type: 'company',
    name: project.name,
    icon: 'project',
    iconName: 'icon-Project',
    background: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  board = created.toObject ? created.toObject() : created;
  return board;
};

const getProjectUserIds = async (projectObjectId) => {
  const teams = await Team.find({
    $or: [{ projectId: projectObjectId }, { projectHistory: projectObjectId }],
  }).lean();

  const unique = new Set();
  teams.forEach((team) => {
    if (team?.leaderId) {
      unique.add(team.leaderId.toString());
    }
    (team?.members || []).forEach((member) => {
      if (member?.userId) {
        unique.add(member.userId.toString());
      }
    });
  });

  return [...unique];
};

const ensureBoardAndColumn = async (boardId, columnId) => {
  const column = await BoardColumn.findOne({ _id: columnId, boardId }).lean();
  if (!column) {
    throw notFound('Column not found');
  }
  return column;
};

const loadBoardWithColumns = async (boardId) => {
  const columns = await BoardColumn.find({ boardId })
    .sort({ position: 1, _id: 1 })
    .lean();

  const columnIds = columns.map((column) => column._id);
  const cards = columnIds.length
    ? await Card.find({ columnId: { $in: columnIds } }).sort({ position: 1, _id: 1 }).lean()
    : [];

  const cardsByColumn = cards.reduce((acc, card) => {
    const key = card.columnId.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(mapCard(card));
    return acc;
  }, {});

  const columnsWithCards = columns.map((column) => ({
    ...mapColumn(column),
    cards: cardsByColumn[column._id.toString()] || [],
  }));

  return columnsWithCards;
};

const getCompanyBoard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }
    const { projectId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    const board = await getOrCreateCompanyBoard({ projectId });
    const columnsWithCards = await loadBoardWithColumns(board._id);

    res.json({
      ...mapBoard(board),
      columns: columnsWithCards,
      role,
      projectId,
    });
  } catch (error) {
    next(error);
  }
};

const updateBoardSettings = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }
    const { projectId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('You are not authorized for this action');
    }

    const { icon, iconName, background } = req.body || {};
    const board = await getOrCreateCompanyBoard({ projectId });

    const updates = {
      updatedAt: now(),
    };
    if (typeof icon !== 'undefined') updates.icon = icon;
    if (typeof iconName !== 'undefined') updates.iconName = iconName;
    if (typeof background !== 'undefined') updates.background = background;

    const updated = await Board.findOneAndUpdate(
      { _id: board._id },
      updates,
      { new: true }
    ).lean();

    res.json(mapBoard(updated));
  } catch (error) {
    next(error);
  }
};

const createColumn = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }
    const { projectId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('You are not authorized for this action');
    }

    const { title } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Column title is required');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const timestamp = now();
    const column = await BoardColumn.create({
      boardId: board._id,
      title: title.trim(),
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    res.status(201).json({
      ...mapColumn(column),
      cards: [],
    });
  } catch (error) {
    next(error);
  }
};

const updateColumn = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }
    const { projectId, columnId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('You are not authorized for this action');
    }

    const { title } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Column title is required');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const updatedAt = now();
    const column = await BoardColumn.findOneAndUpdate(
      { _id: toObjectId(columnId, 'Invalid column'), boardId: board._id },
      { title: title.trim(), updatedAt },
      { new: true }
    ).lean();

    if (!column) {
      throw notFound('Column not found');
    }

    res.json(mapColumn(column));
  } catch (error) {
    next(error);
  }
};

const reorderColumns = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }
    const { projectId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('You are not authorized for this action');
    }

    const { columnIds } = req.body || {};
    if (!Array.isArray(columnIds) || !columnIds.length) {
      throw badRequest('columnIds is required');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const existingColumns = await BoardColumn.find({ boardId: board._id }).lean();
    if (existingColumns.length !== columnIds.length) {
      throw badRequest('Invalid column list');
    }

    const existingSet = new Set(existingColumns.map((column) => column._id.toString()));
    const providedSet = new Set(columnIds);
    if (
      providedSet.size !== columnIds.length ||
      existingSet.size !== providedSet.size ||
      [...providedSet].some((id) => !existingSet.has(id))
    ) {
      throw badRequest('Invalid column list');
    }

    await BoardColumn.bulkWrite(
      columnIds.map((id, index) => ({
        updateOne: {
          filter: { _id: toObjectId(id, 'Invalid column'), boardId: board._id },
          update: { position: index, updatedAt: now() },
        },
      }))
    );

    const updated = await BoardColumn.find({ boardId: board._id })
      .sort({ position: 1, _id: 1 })
      .lean();

    res.json({ columns: updated.map(mapColumn) });
  } catch (error) {
    next(error);
  }
};

const deleteColumn = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }
    const { projectId, columnId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('You are not authorized for this action');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const column = await BoardColumn.findOneAndDelete({
      _id: toObjectId(columnId, 'Invalid column'),
      boardId: board._id,
    }).lean();
    if (!column) {
      throw notFound('Column not found');
    }

    await Card.deleteMany({ columnId: column._id });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const createCard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }
    const { projectId, columnId } = req.params;
    const { role, teamId, projectObjectId } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('You are not authorized for this action');
    }

    const { title, description = '', priority = 'without', deadline = null } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Card title is required');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const columnObjectId = toObjectId(columnId, 'Invalid column');
    await ensureBoardAndColumn(board._id, columnObjectId);

    const latestCard = await Card.findOne({ columnId: columnObjectId })
      .sort({ position: -1, _id: -1 })
      .lean();
    const nextPosition = Number.isFinite(latestCard?.position) ? latestCard.position + 1 : 0;

    const timestamp = now();
    const normalizedDeadline = normalizeDeadlineInput(deadline, null);
    const card = await Card.create({
      columnId: columnObjectId,
      title: title.trim(),
      description,
      priority,
      position: nextPosition,
      deadline: normalizedDeadline,
      completed: false,
      completedAt: null,
      ownerId: null,
      ownerName: '',
      ownerAvatarURL: '',
      assignees: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    try {
      await TaskAssignment.create({
        cardId: card._id.toString(),
        title: card.title,
        description: card.description,
        priority: card.priority,
        deadline: toAssignmentDeadline(normalizedDeadline),
        assignedBy: toObjectId(userId, 'Invalid user'),
        assignedTo: toObjectId(userId, 'Invalid user'),
        teamId: toObjectId(teamId, 'Invalid team'),
        projectId: projectObjectId,
        assignedAt: timestamp,
        status: 'in-progress',
      });
    } catch (assignmentError) {
      await Card.deleteOne({ _id: card._id });
      throw assignmentError;
    }

    const projectUserIds = await getProjectUserIds(projectObjectId);
    const recipients = projectUserIds.filter((memberId) => memberId !== userId);
    if (recipients.length) {
      await createNotificationsForUsers(recipients, {
        type: 'project_unassigned_card',
        category: 'general',
        title: 'New unassigned card',
        message: `A new unassigned card "${card.title}" is available to claim.`,
        link: `/home/company/${projectId}`,
        meta: {
          projectId,
          columnId: columnId.toString(),
          cardId: card._id.toString(),
        },
      });
    }

    res.status(201).json(mapCard(card));
  } catch (error) {
    next(error);
  }
};

const updateCard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }
    const { projectId, columnId, cardId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('You are not authorized for this action');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const columnObjectId = toObjectId(columnId, 'Invalid column');
    const cardObjectId = toObjectId(cardId, 'Invalid card');
    await ensureBoardAndColumn(board._id, columnObjectId);

    const existing = await Card.findOne({ _id: cardObjectId, columnId: columnObjectId }).lean();
    if (!existing) {
      throw notFound('Card not found');
    }
    if (!isUserAssignedToCard(existing, userId)) {
      throw forbidden('You can update only your own cards');
    }

    const { title, description, priority, deadline, completed } = req.body || {};
    const updatedCard = {
      title: title?.trim() || existing.title,
      description: description ?? existing.description,
      priority: priority ?? existing.priority,
      deadline: normalizeDeadlineInput(deadline, existing.deadline),
      completed: typeof completed === 'boolean' ? completed : Boolean(existing.completed),
      completedAt:
        typeof completed === 'boolean'
          ? (completed ? now() : null)
          : (existing.completedAt ?? null),
      updatedAt: now(),
    };

    const updated = await Card.findOneAndUpdate(
      { _id: cardObjectId, columnId: columnObjectId },
      updatedCard,
      { new: true }
    ).lean();

    if (updated && typeof updated.completed === 'boolean') {
      await syncAssignmentStatusByCardId({
        cardId: updated._id?.toString() || cardId,
        completed: Boolean(updated.completed),
      });
    }

    res.json(mapCard(updated));
  } catch (error) {
    next(error);
  }
};

const setCardCompletion = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }

    const { projectId, columnId, cardId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    const canManage = ['team_leader', 'admin'].includes(role);

    const { completed } = req.body || {};
    if (typeof completed !== 'boolean') {
      throw badRequest('completed is required');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const columnObjectId = toObjectId(columnId, 'Invalid column');
    const cardObjectId = toObjectId(cardId, 'Invalid card');
    await ensureBoardAndColumn(board._id, columnObjectId);

    const existing = await Card.findOne({ _id: cardObjectId, columnId: columnObjectId }).lean();
    if (!existing) {
      throw notFound('Card not found');
    }
    if (!canManage && !isUserAssignedToCard(existing, userId)) {
      throw forbidden('You can update completion only for your own cards');
    }

    const updated = await Card.findOneAndUpdate(
      { _id: cardObjectId, columnId: columnObjectId },
      { completed, completedAt: completed ? now() : null, updatedAt: now() },
      { new: true }
    ).lean();

    if (!updated) {
      throw notFound('Card not found');
    }

    await syncAssignmentStatusByCardId({
      cardId: updated._id?.toString() || cardId,
      completed: Boolean(updated.completed),
    });
    const primaryAssignee = normalizeCardAssignees(updated)[0] || null;
    if (primaryAssignee?.userId) {
      await syncAssignmentAssigneeByCardId({
        cardId: updated._id?.toString() || cardId,
        assignedTo: primaryAssignee.userId,
        status: updated?.completed ? 'completed' : 'in-progress',
      });
    }

    res.json(mapCard(updated));
  } catch (error) {
    next(error);
  }
};

const setCardOwnership = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }

    const { projectId, columnId, cardId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    const canManage = ['team_leader', 'admin'].includes(role);

    const { action = 'claim' } = req.body || {};
    if (!['claim', 'release'].includes(action)) {
      throw badRequest('Invalid action');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const columnObjectId = toObjectId(columnId, 'Invalid column');
    const cardObjectId = toObjectId(cardId, 'Invalid card');
    await ensureBoardAndColumn(board._id, columnObjectId);

    const existing = await Card.findOne({ _id: cardObjectId, columnId: columnObjectId }).lean();
    if (!existing) {
      throw notFound('Card not found');
    }

    const currentAssignees = normalizeCardAssignees(existing);
    const isAlreadyAssigned = currentAssignees.some((assignee) => assignee.userId === userId);
    const timestamp = now();

    if (action === 'claim') {
      if (isAlreadyAssigned) {
        const existingPrimaryAssignee = currentAssignees[0] || null;
        if (existingPrimaryAssignee?.userId) {
          await syncAssignmentAssigneeByCardId({
            cardId: existing._id?.toString() || cardId,
            assignedTo: existingPrimaryAssignee.userId,
            status: existing?.completed ? 'completed' : 'in-progress',
          });
        }
        res.json(mapCard(existing));
        return;
      }

      const maxAssigneeCount = getMaxAssignees(existing.priority);
      if (currentAssignees.length >= maxAssigneeCount) {
        throw forbidden('Card has reached maximum assignee limit');
      }

      const nextAssignees = [
        ...currentAssignees,
        {
          userId,
          name: req.user?.name || req.user?.email || '',
          avatarURL: req.user?.avatarURL || '',
          claimedAt: timestamp,
        },
      ];
      const primaryAssignee = nextAssignees[0] || null;

      const updated = await Card.findOneAndUpdate(
        { _id: cardObjectId, columnId: columnObjectId },
        {
          assignees: toStoredAssignees(nextAssignees),
          ownerId: primaryAssignee ? toObjectId(primaryAssignee.userId, 'Invalid user') : null,
          ownerName: primaryAssignee?.name || '',
          ownerAvatarURL: primaryAssignee?.avatarURL || '',
          updatedAt: timestamp,
        },
        { new: true }
      ).lean();

      if (primaryAssignee?.userId) {
        await syncAssignmentAssigneeByCardId({
          cardId: updated?._id?.toString() || cardId,
          assignedTo: primaryAssignee.userId,
          status: updated?.completed ? 'completed' : 'in-progress',
        });
      }

      const teamsInProject = await Team.find({
        $or: [
          { projectId: toObjectId(projectId, 'Invalid project') },
          { projectHistory: toObjectId(projectId, 'Invalid project') },
        ],
      }).lean();
      const leaderRecipients = [
        ...new Set(
          teamsInProject
            .map((team) => team?.leaderId?.toString?.() || '')
            .filter(Boolean)
            .filter((leaderId) => leaderId !== userId)
        ),
      ];

      if (leaderRecipients.length) {
        await createNotificationsForUsers(leaderRecipients, {
          type: 'card_claimed',
          category: 'general',
          title: 'Card claimed',
          message: `${req.user?.name || 'A team member'} claimed "${existing.title}".`,
          link: `/home/company/${projectId}`,
          meta: {
            projectId,
            columnId,
            cardId,
            claimedBy: userId,
          },
        });
      }

      res.json(mapCard(updated));
      return;
    }

    if (!isAlreadyAssigned && !canManage) {
      throw forbidden('You cannot release ownership of this card');
    }
    if (!isAlreadyAssigned) {
      throw forbidden('Card is not assigned to you');
    }

    const nextAssignees = currentAssignees.filter((assignee) => assignee.userId !== userId);
    const primaryAssignee = nextAssignees[0] || null;
    const updated = await Card.findOneAndUpdate(
      { _id: cardObjectId, columnId: columnObjectId },
      {
        assignees: toStoredAssignees(nextAssignees),
        ownerId: primaryAssignee ? toObjectId(primaryAssignee.userId, 'Invalid user') : null,
        ownerName: primaryAssignee?.name || '',
        ownerAvatarURL: primaryAssignee?.avatarURL || '',
        updatedAt: timestamp,
      },
      { new: true }
    ).lean();

    const existingAssignment = await TaskAssignment.findOne({
      cardId: cardObjectId.toString(),
    }).sort({ assignedAt: -1 }).lean();
    const fallbackAssigneeId =
      primaryAssignee?.userId || existingAssignment?.assignedBy?.toString?.() || '';

    if (fallbackAssigneeId) {
      await syncAssignmentAssigneeByCardId({
        cardId: updated?._id?.toString() || cardId,
        assignedTo: fallbackAssigneeId,
        status: updated?.completed ? 'completed' : (primaryAssignee ? 'in-progress' : 'pending'),
      });
    }

    res.json(mapCard(updated));
  } catch (error) {
    next(error);
  }
};

const deleteCard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }
    const { projectId, columnId, cardId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('You are not authorized for this action');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const columnObjectId = toObjectId(columnId, 'Invalid column');
    const cardObjectId = toObjectId(cardId, 'Invalid card');
    await ensureBoardAndColumn(board._id, columnObjectId);

    const result = await Card.findOneAndDelete({ _id: cardObjectId, columnId: columnObjectId }).lean();
    if (!result) {
      throw notFound('Card not found');
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const moveCard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('User info is missing');
    }
    const { projectId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    const canManage = ['team_leader', 'admin'].includes(role);

    const { fromColumnId, toColumnId, cardId, toIndex } = req.body || {};
    if (!fromColumnId || !toColumnId || !cardId) {
      throw badRequest('fromColumnId, toColumnId and cardId are required');
    }
    if (typeof toIndex !== 'undefined' && (!Number.isInteger(toIndex) || toIndex < 0)) {
      throw badRequest('Invalid toIndex');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const fromColumnObjectId = toObjectId(fromColumnId, 'Invalid column');
    const toColumnObjectId = toObjectId(toColumnId, 'Invalid column');
    const cardObjectId = toObjectId(cardId, 'Invalid card');

    await ensureBoardAndColumn(board._id, fromColumnObjectId);
    await ensureBoardAndColumn(board._id, toColumnObjectId);

    const existing = await Card.findOne({ _id: cardObjectId, columnId: fromColumnObjectId }).lean();
    if (!existing) {
      throw notFound('Card not found');
    }
    if (!canManage && !isUserAssignedToCard(existing, userId)) {
      throw forbidden('You can move only your own cards');
    }

    const timestamp = now();
    const sourceCards = await Card.find({ columnId: fromColumnObjectId })
      .sort({ position: 1, _id: 1 })
      .lean();

    const fromIndex = sourceCards.findIndex((card) => card._id.toString() === cardId);
    if (fromIndex === -1) {
      throw notFound('Card not found');
    }

    const movingCard = sourceCards[fromIndex];

    if (fromColumnId === toColumnId) {
      const list = [...sourceCards];
      list.splice(fromIndex, 1);
      const insertionIndex = clampIndex(
        typeof toIndex === 'number' ? toIndex : list.length,
        0,
        list.length
      );
      list.splice(insertionIndex, 0, movingCard);

      const updates = list.map((card, index) => ({
        updateOne: {
          filter: { _id: card._id },
          update: { position: index, updatedAt: timestamp },
        },
      }));

      if (updates.length) {
        await Card.bulkWrite(updates);
      }

      const updated = await Card.findById(cardObjectId).lean();
      res.json(mapCard(updated));
      return;
    }

    const targetCards = await Card.find({ columnId: toColumnObjectId })
      .sort({ position: 1, _id: 1 })
      .lean();

    const sourceRemaining = sourceCards.filter((card) => card._id.toString() !== cardId);
    const insertionIndex = clampIndex(
      typeof toIndex === 'number' ? toIndex : targetCards.length,
      0,
      targetCards.length
    );

    const targetNext = [...targetCards];
    targetNext.splice(insertionIndex, 0, { ...movingCard, columnId: toColumnObjectId });

    const bulkOperations = [
      ...sourceRemaining.map((card, index) => ({
        updateOne: {
          filter: { _id: card._id },
          update: { position: index, updatedAt: timestamp },
        },
      })),
      ...targetNext.map((card, index) => ({
        updateOne: {
          filter: { _id: card._id },
          update: {
            columnId: toColumnObjectId,
            position: index,
            updatedAt: timestamp,
          },
        },
      })),
    ];

    if (bulkOperations.length) {
      await Card.bulkWrite(bulkOperations);
    }

    const updated = await Card.findById(cardObjectId).lean();
    res.json(mapCard(updated));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCompanyBoard,
  updateBoardSettings,
  createColumn,
  updateColumn,
  reorderColumns,
  deleteColumn,
  createCard,
  updateCard,
  setCardCompletion,
  setCardOwnership,
  deleteCard,
  moveCard,
};
