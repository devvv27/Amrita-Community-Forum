import { Router } from "express";
import { sendMessage, getMessages, deleteMessage, markMessageRead, sendPrivateMessage, getPrivateMessages, getPrivateUnreadCounts, getChatSummaries } from "../controllers/messages.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Chat summaries (list of tasks with recent messages)
router.get("/chats/summaries", requireAuth, async (req, res) => {
	try {
		const data = await getChatSummaries(req, res);
		// getChatSummaries sends the response; nothing else needed here
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

router.post("/:taskId", requireAuth, sendMessage);
router.get("/:taskId", requireAuth, getMessages);
router.get("/:taskId/private/:recipientId", requireAuth, getPrivateMessages);
router.post("/:taskId/private", requireAuth, sendPrivateMessage);
router.get("/private/unread", requireAuth, getPrivateUnreadCounts);
router.delete("/:messageId", requireAuth, deleteMessage);
router.post("/:messageId/read", requireAuth, markMessageRead);

export default router;
