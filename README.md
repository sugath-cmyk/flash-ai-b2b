# Flash AI B2B

Enterprise AI Platform for Business Intelligence & Automation

## Project Structure

```
flash-ai-b2b/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Node.js + Express + PostgreSQL
├── database/          # Database schemas & migrations
├── docs/              # Documentation
└── README.md
```

## MVP Features Status

- ✅ **User Authentication** - JWT-based auth with bcrypt password hashing
- ✅ **Dashboard UI** - Clean dashboard with navigation to features
- ✅ **Database Schema** - PostgreSQL with migrations for all tables
- ⏳ **AI Chat Assistant** - Coming soon (Claude/OpenAI integration)
- ⏳ **Document Upload & Analysis** - Coming soon
- ⏳ **Team Management** - Coming soon (RBAC planned)

## Tech Stack

**Frontend:**
- React 18
- TypeScript
- Vite
- TailwindCSS
- React Router
- Zustand (State Management)
- Axios (API client)

**Backend:**
- Node.js 20+
- Express 5
- TypeScript
- PostgreSQL
- Redis (for caching/sessions)
- JWT Authentication
- bcryptjs (password hashing)

**AI (Planned):**
- Anthropic Claude API
- OpenAI API (fallback)

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis 7+ (optional for development)
- npm

### Installation

1. **Clone and install dependencies:**
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install

# Install backend dependencies
cd ../backend && npm install
```

2. **Set up environment variables:**
```bash
# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Frontend environment (optional)
cp frontend/.env.example frontend/.env
```

3. **Set up database:**
```bash
# Create PostgreSQL database
createdb flash_ai_b2b

# Run migrations
cd backend
npm run migrate

# (Optional) Seed development data
npm run seed
```

4. **Start development servers:**

**Option 1: Run both servers concurrently (from root directory):**
```bash
npm run dev:all
```

**Option 2: Run separately:**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health

## Environment Variables

### Backend (.env)

```env
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/flash_ai_b2b
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_ai_b2b
DB_USER=postgres
DB_PASSWORD=your_password

# Redis (optional for development)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Authentication
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
JWT_REFRESH_EXPIRES_IN=30d

# AI APIs (add when implementing AI features)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3000/api
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user (protected)

### Protected Routes (require authentication)
- `GET /api/users/me` - Get user profile
- `PUT /api/users/me` - Update user profile
- `PUT /api/users/me/password` - Change password

### Coming Soon
- `/api/ai/*` - AI chat endpoints
- `/api/documents/*` - Document management
- `/api/teams/*` - Team management

## Database Schema

Tables created:
- `users` - User accounts and authentication
- `teams` - Team/organization management
- `oauth_providers` - OAuth 2.0 integrations
- `conversations` - AI chat conversations
- `messages` - Chat messages
- `documents` - Uploaded documents
- `activity_logs` - Audit trail
- `api_keys` - Programmatic API access
- `usage_metrics` - Usage tracking

See `database/schema.sql` for full schema details.

## Development Commands

### Backend
```bash
cd backend
npm run dev          # Start dev server with hot reload
npm run build        # Compile TypeScript
npm run start        # Run compiled production code
npm run migrate      # Run database migrations
npm run seed         # Seed development data
```

### Frontend
```bash
cd frontend
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Root
```bash
npm run dev:all      # Run both frontend and backend
npm run build        # Build both workspaces
npm run test         # Run tests in all workspaces
npm run lint         # Lint all workspaces
```

## Project Status

### ✅ Completed
- Project structure and monorepo setup
- Backend API with Express + TypeScript
- PostgreSQL database schema and migrations
- JWT authentication system (register, login, token refresh)
- Frontend React app with TypeScript + Vite
- TailwindCSS styling
- React Router with protected routes
- Zustand state management for authentication
- Login and Register pages
- Dashboard with feature cards
- Responsive UI design

### 🚧 In Progress / Coming Soon
- AI Chat feature with Claude/OpenAI
- Document upload and analysis
- Team management with RBAC
- User profile management
- Email verification
- Password reset flow
- OAuth 2.0 (Google, Microsoft)
- API documentation (Swagger)
- Unit and integration tests
- Docker containerization
- CI/CD pipeline

## Testing the Application

1. Start both servers (backend and frontend)
2. Navigate to http://localhost:5173
3. Click "Sign up" to create a new account
4. Fill in your details and register
5. You'll be automatically logged in and redirected to the dashboard
6. Explore the dashboard and feature cards (chat, documents, team are placeholders)

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running: `pg_isready`
- Check database exists: `psql -l | grep flash_ai_b2b`
- Verify credentials in `backend/.env`

### Frontend Can't Connect to Backend
- Check backend is running on port 3000
- Verify CORS settings allow frontend origin
- Check `VITE_API_URL` in frontend/.env

### Port Already in Use
- Backend (3000): Change `PORT` in backend/.env
- Frontend (5173): Change in frontend/vite.config.ts

## License

Proprietary - All Rights Reserved

---

Built with ❤️ by Flash AI Team
