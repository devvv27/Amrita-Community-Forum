# Amrita Community Forum

Amrita Community Forum is a full-stack community platform designed for knowledge sharing, task collaboration, and reputation-driven participation within an academic or campus ecosystem. The application combines a task marketplace, discussion forum, profile analytics, and user-level engagement features into a single platform.

## Overview

The system is structured as a React frontend connected to an Express backend with PostgreSQL persistence. It supports authenticated user flows, community discussions, task publication, proposal handling, and analytics-driven reputation tracking.

## Functional modules

### 1. Authentication and authorization
- User registration and login
- JWT-based protected routes
- Password hashing with bcrypt
- Authenticated access to profile, task, discussion, and notification features

### 2. Task marketplace
- Create and publish tasks with metadata such as title, description, difficulty, budget, and deadline
- Browse tasks using filters and search parameters
- View task details and submit proposals with a message and bid amount
- Track tasks created by the current user and tasks they have applied to
- Manage task-related collaboration workflow around community work requests

### 3. Community discussions
- Create discussion posts by category
- Search and filter discussion content
- Vote on posts to influence relevance and visibility
- Comment and reply in a nested discussion structure
- Save favorite posts and receive recommendation-based suggestions

### 4. User profiles and reputation system
- Maintain personal profile details and skill tags
- Display user reputation and derived achievement badges
- Track metrics such as completed tasks, ratings, completion rate, and dispute rate
- Show community leaderboard rankings based on contribution and quality signals

### 5. Notifications and admin support
- Notify users of relevant updates and platform events
- Support admin-related management flows and platform oversight
- Provide search and discovery for community users and content

## Technical architecture

- Frontend: React with Vite and Tailwind CSS
- Routing: React Router
- Backend: Node.js with Express
- Database: PostgreSQL
- Authentication: JWT + bcrypt
- API layer: Axios-based client communication with Express routes/controllers
- State management: React component state and context-based auth/theme handling

## Project structure

- client/: frontend application and UI pages
- server/: backend API, controllers, routes, middleware, and database logic
- server/db/schema.sql: database schema definition
- api/: deployment/hosted API entry points
- vercel.json: deployment configuration

## Setup and execution

### Backend

```bash
cd server
npm install
npm start
```

### Frontend

```bash
cd client
npm install
npm run dev
```

The frontend is typically served at port 5173, while the backend runs on port 5000.

### Root-level development workflow

A root script is configured to run the frontend and backend together for local development.

## Core purpose

This project serves as a community-driven platform for Amrita users to exchange knowledge, discover opportunities, collaborate on projects, and build a measurable reputation based on community contribution and quality of work.