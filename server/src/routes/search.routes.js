import express from "express";
import { requireAuth } from "../middleware/auth.js";
import * as searchController from "../controllers/search.controller.js";

const router = express.Router();

// Global search with filters
router.get("/", async (req, res) => {
  try {
    const { q, types, difficulty, minBudget, maxBudget, skills, status, sort, limit } = req.query;

    if (!q) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const filters = {
      types: types ? types.split(",") : ["tasks", "posts", "people"],
      difficulty,
      minBudget,
      maxBudget,
      skills: skills ? skills.split(",") : [],
      status,
      sort: sort || "relevance",
      limit: Math.min(parseInt(limit) || 20, 100),
    };

    const results = await searchController.globalSearch(q, req.user?.id, filters);

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get search facets
router.get("/facets", async (req, res) => {
  try {
    const { q } = req.query;

    const facets = await searchController.getFacets(q);

    res.json(facets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get search suggestions
router.get("/suggestions", async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ message: "Query is required" });
    }

    const suggestions = await searchController.getSearchSuggestions(q, parseInt(limit));

    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save search
router.post("/saved", requireAuth, async (req, res) => {
  try {
    const { name, query, filters } = req.body;

    if (!name || !query) {
      return res.status(400).json({ message: "Name and query are required" });
    }

    const saved = await searchController.saveSearch(req.user.id, name, query, filters);

    res.status(201).json({ saved });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get saved searches
router.get("/saved", requireAuth, async (req, res) => {
  try {
    const searches = await searchController.getSavedSearches(req.user.id);

    res.json({ searches });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete saved search
router.delete("/saved/:searchId", requireAuth, async (req, res) => {
  try {
    const { searchId } = req.params;

    await searchController.deleteSavedSearch(parseInt(searchId), req.user.id);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
