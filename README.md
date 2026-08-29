# Amrita Community Forum

Amrita Community Forum is a full-stack community platform built for students and users to collaborate, discover opportunities, ask questions, and build a reputation within the community. The platform combines task-based collaboration with discussion-driven engagement.

## Features

### User authentication and profiles
- Register and log in with secure authentication
- Access protected pages through JWT-based session handling
- Manage personal profile information and skill tags
- View reputation, badges, and community contribution metrics

### Task marketplace
- Create new tasks with title, description, budget, difficulty, and deadline
- Browse and filter task listings by skill, difficulty, and budget
- Open task details and submit proposals with a message and bid
- Track created tasks and submitted proposals from the user dashboard
- Manage task lifecycle and project-related collaboration in a forum-style workflow

### Community discussions
- Create discussion posts under different categories
- Search for posts and browse community topics
- Upvote or downvote posts
- Comment on posts and reply to discussions in a threaded format
- Save interesting posts and view recommended content

### Messaging and collaboration
- Open discussion/chat-based task communication
- Connect task execution with direct community interaction
- Collaborate around task progress and issue resolution

### Notifications and analytics
- View community notifications and updates
- Track task completion, average ratings, dispute rate, and overall reputation
- See leaderboard data and user performance summaries

### Admin and search features
- Access admin-related tools for managing platform activity
- Search users, tasks, and community data through advanced search flows
- Support community-level discovery for tasks and discussions

## Tech stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express.js
- Database: PostgreSQL
- Authentication: JWT and bcrypt
- API communication: Axios

## Project structure

- client/: frontend application
- server/: backend API and database logic
- server/db/schema.sql: database schema
- app.js and api/: root deployment-related files

## Running the project

1. Install dependencies for the backend and frontend.
2. Configure the environment values required by the server.
3. Start the backend and frontend.

Example:

```bash
cd server
npm install
npm start
```

```bash
cd client
npm install
npm run dev
```

The frontend usually runs on port 5173 and the backend runs on port 5000.

If you want to start both together from the root folder, use the project script configured in the root package.

## Main purpose of the platform

This project is designed as a practical community-driven forum for Amrita users where people can:
- share knowledge and ideas
- post problems or opportunities
- collaborate on technical tasks
- build reputation through contribution and quality of work
- participate in a more engaged and useful campus/community network
