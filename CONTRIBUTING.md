# Contributing to Dentalemon

Thank you for your interest in contributing! This file covers the getting-started setup. All detailed guidelines live in `docs/development/`.

## Development Setup

### 1. Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd monobase

# Install dependencies
bun install

# Set up PostgreSQL database
createdb monobase
```

### 2. Environment Configuration

Each service/app requires its own `.env` file:

**API Service** (`services/api-ts/.env`):
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase
PORT=7213
AUTH_SECRET=your-secret-key-here
STRIPE_SECRET_KEY=sk_test_...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

**Account App** (`apps/account/.env`):
```bash
VITE_API_URL=http://localhost:7213
```

### 3. Database Initialization

```bash
cd services/api-ts
bun run db:generate  # Generate initial schema
```

### 4. Verify Setup

```bash
# Start API service
cd services/api-ts && bun dev

# In another terminal, start account app
cd apps/account && bun dev

# Verify API is running
curl http://localhost:7213/health
```

## Documentation Index

- **API-First Development & Code Generation** → [docs/development/CONTRIBUTING_API.md](./docs/development/CONTRIBUTING_API.md)
- **Coding Standards & Module Patterns** → [docs/development/CONTRIBUTING_CODING_STANDARDS.md](./docs/development/CONTRIBUTING_CODING_STANDARDS.md)
- **Database Workflow** → [docs/development/CONTRIBUTING_DATABASE.md](./docs/development/CONTRIBUTING_DATABASE.md)
- **Test Organization & Requirements** → [docs/development/CONTRIBUTING_TESTING.md](./docs/development/CONTRIBUTING_TESTING.md)
- **Git Workflow, PRs & Code Review** → [docs/development/CONTRIBUTING_GIT.md](./docs/development/CONTRIBUTING_GIT.md)
- **Frontend Development Patterns** → [docs/development/CONTRIBUTING_FRONTEND.md](./docs/development/CONTRIBUTING_FRONTEND.md)
- **Vertical TDD Protocol** → [docs/development/VERTICAL_TDD.md](./docs/development/VERTICAL_TDD.md)
