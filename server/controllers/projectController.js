const {
  createProject,
  listProjects,
  listProjectsForUser,
  createTeamForProject,
  listTeamsByProject,
  addMemberToTeam,
} = require('../services/projectService');

exports.getProjects = async (req, res, next) => {
  try {
    const projects = await listProjects(req.user.id);
    res.json(projects);
  } catch (error) {
    next(error);
  }
};

exports.getAssignedProjects = async (req, res, next) => {
  try {
    const projects = await listProjectsForUser(req.user.id);
    res.json(projects);
  } catch (error) {
    next(error);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    const { name, parentProjectId } = req.body;
    const project = await createProject({
      name,
      ownerId: req.user.id,
      parentProjectId,
    });
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
};

exports.listTeams = async (req, res, next) => {
  try {
    const teams = await listTeamsByProject({
      projectId: req.params.projectId,
      ownerId: req.user.id,
    });
    res.json(teams);
  } catch (error) {
    next(error);
  }
};

exports.createTeam = async (req, res, next) => {
  try {
    const { name, leaderId, members } = req.body;
    const team = await createTeamForProject({
      projectId: req.params.projectId,
      name,
      leaderId,
      members,
      ownerId: req.user.id,
    });
    res.status(201).json(team);
  } catch (error) {
    next(error);
  }
};

exports.addMember = async (req, res, next) => {
  try {
    const { userId, role } = req.body;
    const team = await addMemberToTeam({
      projectId: req.params.projectId,
      teamId: req.params.teamId,
      ownerId: req.user.id,
      userId,
      role,
    });
    res.json(team);
  } catch (error) {
    next(error);
  }
};
