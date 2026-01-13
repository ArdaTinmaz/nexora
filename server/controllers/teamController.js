const { listTeamsForUser } = require('../services/channelService');

exports.getMyTeams = async (req, res, next) => {
  try {
    const teams = await listTeamsForUser(req.user.id);
    res.json(teams);
  } catch (error) {
    next(error);
  }
};
