import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  user?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

interface Team {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export class TeamService {
  async getMyTeam(userId: string): Promise<any> {
    // Get user's team membership
    const memberResult = await pool.query(
      `SELECT tm.team_id, tm.role, tm.joined_at, t.name, t.description, t.created_at
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       WHERE tm.user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return null;
    }

    const teamData = memberResult.rows[0];

    // Get all team members
    const membersResult = await pool.query(
      `SELECT tm.id, tm.user_id, tm.role, tm.joined_at,
              u.email, u.first_name, u.last_name
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at ASC`,
      [teamData.team_id]
    );

    return {
      id: teamData.team_id,
      name: teamData.name,
      description: teamData.description,
      created_at: teamData.created_at,
      myRole: teamData.role,
      members: membersResult.rows,
    };
  }

  async createTeam(name: string, description: string | undefined, ownerId: string): Promise<Team> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Create team
      const teamResult = await client.query(
        `INSERT INTO teams (name, description)
         VALUES ($1, $2)
         RETURNING id, name, description, created_at, updated_at`,
        [name, description || null]
      );

      const team = teamResult.rows[0];

      // Add owner as team member
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [team.id, ownerId]
      );

      // Update user's team_id
      await client.query(
        `UPDATE users SET team_id = $1 WHERE id = $2`,
        [team.id, ownerId]
      );

      await client.query('COMMIT');

      return team;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getTeamMembers(teamId: string, userId: string): Promise<TeamMember[]> {
    // Verify user is member of the team
    const memberCheck = await pool.query(
      `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      throw createError('Not authorized to view this team', 403);
    }

    const result = await pool.query(
      `SELECT tm.id, tm.user_id, tm.team_id, tm.role, tm.joined_at,
              u.email, u.first_name, u.last_name
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at ASC`,
      [teamId]
    );

    return result.rows;
  }

  async addTeamMember(
    teamId: string,
    email: string,
    role: 'admin' | 'member',
    requesterId: string
  ): Promise<void> {
    // Verify requester is admin or owner
    await this.verifyAdminRole(teamId, requesterId);

    // Find user by email
    const userResult = await pool.query(
      `SELECT id, team_id FROM users WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      throw createError('User not found with that email', 404);
    }

    const user = userResult.rows[0];

    if (user.team_id) {
      throw createError('User is already part of another team', 400);
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Add user to team
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [teamId, user.id, role]
      );

      // Update user's team_id
      await client.query(
        `UPDATE users SET team_id = $1 WHERE id = $2`,
        [teamId, user.id]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateMemberRole(
    teamId: string,
    targetUserId: string,
    newRole: 'admin' | 'member',
    requesterId: string
  ): Promise<void> {
    // Verify requester is admin or owner
    await this.verifyAdminRole(teamId, requesterId);

    // Check if target user is owner (can't change owner role)
    const targetMemberResult = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, targetUserId]
    );

    if (targetMemberResult.rows.length === 0) {
      throw createError('User is not a member of this team', 404);
    }

    if (targetMemberResult.rows[0].role === 'owner') {
      throw createError('Cannot change the role of the team owner', 400);
    }

    await pool.query(
      `UPDATE team_members
       SET role = $1
       WHERE team_id = $2 AND user_id = $3`,
      [newRole, teamId, targetUserId]
    );
  }

  async removeMember(teamId: string, targetUserId: string, requesterId: string): Promise<void> {
    // Verify requester is admin or owner
    await this.verifyAdminRole(teamId, requesterId);

    // Check if target user is owner (can't remove owner)
    const targetMemberResult = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, targetUserId]
    );

    if (targetMemberResult.rows.length === 0) {
      throw createError('User is not a member of this team', 404);
    }

    if (targetMemberResult.rows[0].role === 'owner') {
      throw createError('Cannot remove the team owner', 400);
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Remove from team_members
      await client.query(
        `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, targetUserId]
      );

      // Clear user's team_id
      await client.query(
        `UPDATE users SET team_id = NULL WHERE id = $1`,
        [targetUserId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async verifyAdminRole(teamId: string, userId: string): Promise<void> {
    const result = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );

    if (result.rows.length === 0) {
      throw createError('Not a member of this team', 403);
    }

    const role = result.rows[0].role;
    if (role !== 'admin' && role !== 'owner') {
      throw createError('Insufficient permissions - admin or owner role required', 403);
    }
  }
}

export default new TeamService();
