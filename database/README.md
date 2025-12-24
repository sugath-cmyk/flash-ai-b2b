# Database Setup

## Prerequisites

- PostgreSQL 14 or higher
- Database created: `flash_ai_b2b`

## Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE flash_ai_b2b;

# Exit psql
\q
```

## Run Migrations

```bash
cd backend
npm run migrate
```

## Seed Development Data (Optional)

```bash
cd backend
npm run seed
```

## Database Schema Overview

### Core Tables

- **users**: User accounts with authentication
- **teams**: Organization/team management
- **oauth_providers**: OAuth 2.0 integration (Google, Microsoft)

### AI Features

- **conversations**: AI chat conversation history
- **messages**: Individual messages in conversations
- **documents**: Uploaded documents for AI analysis

### Supporting Tables

- **activity_logs**: Audit trail of user actions
- **api_keys**: Programmatic API access
- **usage_metrics**: Track usage for billing/analytics

## Environment Variables

Make sure your `.env` file has the correct database connection string:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/flash_ai_b2b
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_ai_b2b
DB_USER=postgres
DB_PASSWORD=your_password
```

## Backup & Restore

### Backup
```bash
pg_dump -U postgres flash_ai_b2b > backup.sql
```

### Restore
```bash
psql -U postgres flash_ai_b2b < backup.sql
```
