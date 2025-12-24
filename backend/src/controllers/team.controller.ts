import { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import teamService from '../services/team.service';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const createTeamValidation = [
  body('name').trim().notEmpty().withMessage('Team name is required'),
  body('description').optional().isString().withMessage('Description must be a string'),
];

export const addMemberValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(['admin', 'member']).withMessage('Role must be admin or member'),
];

export const updateRoleValidation = [
  body('role').isIn(['admin', 'member']).withMessage('Role must be admin or member'),
];

class TeamController {
  async getMyTeam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const team = await teamService.getMyTeam(req.user.id);

      res.json({
        success: true,
        data: { team },
      });
    } catch (error) {
      next(error);
    }
  }

  async createTeam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { name, description } = req.body;
      const team = await teamService.createTeam(name, description, req.user.id);

      res.status(201).json({
        success: true,
        data: { team },
      });
    } catch (error) {
      next(error);
    }
  }

  async getTeamMembers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { id } = req.params;
      const members = await teamService.getTeamMembers(id, req.user.id);

      res.json({
        success: true,
        data: { members },
      });
    } catch (error) {
      next(error);
    }
  }

  async addMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { id } = req.params;
      const { email, role } = req.body;

      await teamService.addTeamMember(id, email, role, req.user.id);

      res.json({
        success: true,
        message: 'Team member added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMemberRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { id, userId } = req.params;
      const { role } = req.body;

      await teamService.updateMemberRole(id, userId, role, req.user.id);

      res.json({
        success: true,
        message: 'Member role updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { id, userId } = req.params;

      await teamService.removeMember(id, userId, req.user.id);

      res.json({
        success: true,
        message: 'Team member removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new TeamController();
