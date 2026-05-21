import { Router } from "express";
import {
  createProposal,
  createTask,
  deleteTask,
  getTask,
  getTaskDetails,
  listTasks,
  myCreatedTasks,
  myProposals,
  recommendedTasks,
  receivedProposals,
  savedTasks,
  toggleSavedTask,
  updateProposalStatus,
  updateTask,
  confirmNegotiation,
} from "../controllers/tasks.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", listTasks);
router.get("/recommended", requireAuth, recommendedTasks);
router.get("/saved", requireAuth, savedTasks);
router.get("/mine/created", requireAuth, myCreatedTasks);
router.get("/mine/proposals", requireAuth, myProposals);
router.get("/mine/received-proposals", requireAuth, receivedProposals);
router.get("/:id/details", getTaskDetails);
router.get("/:id", getTask);
router.post("/:id/save", requireAuth, toggleSavedTask);
router.post("/", requireAuth, createTask);
router.patch("/:id", requireAuth, updateTask);
router.delete("/:id", requireAuth, deleteTask);
router.post("/:id/proposals", requireAuth, createProposal);
router.patch("/proposals/:proposalId", requireAuth, updateProposalStatus);
router.post("/negotiate/confirm", requireAuth, confirmNegotiation);

export default router;
