import { Router } from "express";
import {
  createTeam,
  getMyTeams,
  getTeam,
  inviteTeamMember,
  acceptTeamInvitation,
  addTeamMember,
  updateMemberRole,
  removeTeamMember,
  updateTeamSettings,
  getTeamActivity,
  getTeamAnalytics,
  deleteTeam,
} from "../controllers/teams.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Team CRUD
router.post("/", requireAuth, createTeam);
router.get("/", requireAuth, getMyTeams);
router.get("/:id", requireAuth, getTeam);
router.put("/:id/settings", requireAuth, updateTeamSettings);
router.delete("/:id", requireAuth, deleteTeam);

// Member management
router.post("/:id/members", requireAuth, addTeamMember);
router.put("/:id/members/:memberId/role", requireAuth, updateMemberRole);
router.delete("/:id/members/:memberId", requireAuth, removeTeamMember);

// Invitations
router.post("/:id/invitations", requireAuth, inviteTeamMember);
router.post("/invitations/:token/accept", acceptTeamInvitation);

// Analytics & Activity
router.get("/:id/activity", requireAuth, getTeamActivity);
router.get("/:id/analytics", requireAuth, getTeamAnalytics);

export default router;
