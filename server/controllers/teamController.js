const mongoose = require('mongoose');
const Team = require('../models/Team');
const UserModel = require('../models/User');
const { findUserRoleInTeam } = require('../realtime/roomAuth');
const { listTeamsForUser } = require('../services/channelService');

exports.getMyTeams = async (req, res, next) => {
  try {
    const teams = await listTeamsForUser(req.user.id);
    res.json(teams);
  } catch (error) {
    next(error);
  }
};

exports.getTeamMembers = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: 'Geçersiz teamId' });
    }

    const team = await Team.findById(teamId).lean();
    if (!team) {
      return res.status(404).json({ message: 'Takım bulunamadı' });
    }

    const role = findUserRoleInTeam(team, req.user.id);
    if (!role) {
      return res.status(403).json({ message: 'Takım erişimi yok' });
    }

    const memberEntries = [
      { userId: team.leaderId?.toString(), role: 'team_leader' },
      ...(team.members || []).map((m) => ({ userId: m.userId.toString(), role: m.role })),
    ].filter((m) => m.userId);

    const uniqueMap = new Map();
    memberEntries.forEach((entry) => {
      const existing = uniqueMap.get(entry.userId);
      if (!existing || entry.role === 'team_leader') {
        uniqueMap.set(entry.userId, entry);
      }
    });

    const uniqueEntries = Array.from(uniqueMap.values());
    const uniqueIds = uniqueEntries.map((m) => m.userId);
    const users = await UserModel.model
      .find({ _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .lean();

    const userMap = users.reduce((acc, u) => {
      acc[u._id.toString()] = u;
      return acc;
    }, {});

    const response = uniqueEntries.map((entry) => {
      const user = userMap[entry.userId] || {};
      return {
        id: entry.userId,
        name: user.name || user.email || entry.userId,
        email: user.email || '',
        role: entry.role,
      };
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
};
