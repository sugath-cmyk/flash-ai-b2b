import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import teamController, {
  createTeamValidation,
  addMemberValidation,
  updateRoleValidation,
} from '../controllers/team.controller';

const router = Router();

// All team routes require authentication
router.use(authenticate);

// GET /api/teams/my-team - Get current user's team
router.get('/my-team', teamController.getMyTeam.bind(teamController));

// POST /api/teams - Create new team
router.post('/', createTeamValidation, teamController.createTeam.bind(teamController));

// GET /api/teams/:id/members - Get team members
router.get('/:id/members', teamController.getTeamMembers.bind(teamController));

// POST /api/teams/:id/members - Add team member
router.post('/:id/members', addMemberValidation, teamController.addMember.bind(teamController));

// PUT /api/teams/:id/members/:userId - Update member role
router.put('/:id/members/:userId', updateRoleValidation, teamController.updateMemberRole.bind(teamController));

// DELETE /api/teams/:id/members/:userId - Remove team member
router.delete('/:id/members/:userId', teamController.removeMember.bind(teamController));

export default router;
