# AI-Call-Orchestrator-Service

Backend orchestrator for an AI‑driven calling platform. Clients enqueue call requests; a worker service consumes a Kafka topic, coordinates concurrency with Redis, persists state in Postgres, exposes metrics, and processes provider callbacks. The system enforces a maximum concurrent call limit and per‑phone locking to avoid duplicate dials.

## Features

- Call intake API with validation (Zod)
- Kafka producer/consumer for call dispatch
- In‑memory buffer to queue excess work beyond concurrency
- Redis‑based concurrency control and per‑phone locks
- Postgres persistence for calls, attempts, and statuses
- Callback endpoint with API key auth
- Basic metrics endpoint
- Docker Compose stack for local infra (Postgres, Redis, Kafka)

## Tech Stack

- Node.js + TypeScript + Express
- Postgres (`pg`), Redis (`ioredis`)
- Kafka (`kafkajs`)
- Validation with `zod`
- Logging with `morgan`

## Architecture (High‑level)

1. Client sends POST `/api/v1/calls` with `{ to, scriptId, metadata? }`.
2. Service persists a `PENDING` call, publishes `{ callId, to }` to Kafka topic `calls`.
3. Worker subscribes to `calls`:
   - Tries to acquire a global concurrency slot and a per‑phone lock in Redis.
   - If acquired, marks call `IN_PROGRESS`, assigns an external id (placeholder here), and proceeds.
   - If not, the call is placed into an in‑memory buffer for later retry.
4. A periodic buffer checker attempts to start buffered calls when capacity allows.
5. Provider eventually calls back to `/api/v1/callbacks/call-status` with status; service updates DB and releases the Redis slot/lock.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node 18+ (for local non‑docker dev)

### Quick Start (Docker Compose)

This runs Postgres, Redis, Kafka, and the API in watch mode. Start detached and create the Kafka topic explicitly:

```bash
docker compose -f docker-compose.dev.yml up -d --build

docker exec ebra-kafka /opt/kafka/bin/kafka-topics.sh --create \
  --topic calls \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1
```

If the topic already exists, the create command will report an error that can be safely ignored.

Services started:

- Postgres: `localhost:5432` (DB: `ebra-calls`, user: `postgres`, password: `password`)
- Redis: `localhost:6379`
- Kafka: `kafka:9092` within the Compose network (advertised for the API container)
- API: `http://localhost:3000`

The Postgres schema is initialized automatically from `src/database/migration/001_init.sql`.

### Running Only Infra (no API)

```bash
docker compose -f docker-compose.infra.yml up --build
```

### Local Development (without Docker for API)

1. Ensure Postgres, Redis, and Kafka are running (via infra compose or your own instances).
2. Create a `.env` file (see Environment Variables below).
3. Install deps and start dev server:
   ```bash
   npm install
   npm run dev
   ```

## Environment Variables

From `src/config/config.ts` (defaults in parentheses):

- Server
  - `PORT` (3000)
  - `NODE_ENV` (development)

- Database
  - `DATABASE_HOST` (localhost)
  - `DATABASE_PORT` (5432)
  - `DATABASE_NAME` (ebra-calls)
  - `DATABASE_USER` (postgres)
  - `DATABASE_PASSWORD` (password)

- Redis
  - `REDIS_HOST` (localhost)
  - `REDIS_PORT` (6379)

- Kafka
  - `KAFKA_BROKERS` (localhost:9092)
  - `KAFKA_CLIENT_ID` (ebra-kafka)
  - `KAFKA_GROUP_ID` (call-workers)

- App
  - `API_KEY` (secret)
  - `BASE_URL` (http://localhost:3000)
  - `MAX_CONCURRENT_CALLS` (30)
  - `MAX_RETRY_ATTEMPTS` (3)
  - `BUFFER_CHECK_INTERVAL` (2000)

## API

Base URL: `http://localhost:3000`

### Health

- GET `/` → "Hello World"

### Calls

- POST `/api/v1/calls`
  - Body:
    ```json
    {
      "to": "+15551234567",
      "scriptId": "script-123",
      "metadata": { "campaign": "fall-promo" }
    }
    ```
  - Response: `{ data: Call, message }`

- GET `/api/v1/calls/:id`
  - Response: `{ data: Call }`

- GET `/api/v1/calls?status=PENDING&limit=10&offset=0`
  - Response: `{ data: Call[] }`

- PATCH `/api/v1/calls/:id`
  - Body:
    ```json
    { "status": "IN_PROGRESS" }
    ```
  - Response: `{ data: Call, message }`

### Metrics

- GET `/api/v1/metrics`
  - Response:
    ```json
    { "data": { "PENDING": 10, "IN_PROGRESS": 2, "COMPLETED": 5 } }
    ```

### Callbacks

- POST `/api/v1/callbacks/call-status`
  - Headers: `x-api-key: <API_KEY>`
  - Body:
    ```json
    {
      "callId": "provider-call-id",
      "status": "COMPLETED",
      "durationSec": 42,
      "completedAt": "2025-01-01T12:34:56.000Z"
    }
    ```
  - Updates the matching call by `external_call_id` and releases the Redis slot/lock

## Concurrency & Buffering

- Global concurrency tracked in Redis key `concurrent_calls` (increment/decrement per active call)
- Per‑phone lock stored as `phone_lock:<E164>` with TTL to prevent duplicate dialing windows
- If capacity is full or a phone is locked, the call goes to an in‑memory buffer (`src/worker/bufferCall.ts`)
- A periodic job (`BUFFER_CHECK_INTERVAL` ms) scans the buffer and attempts to start calls when capacity is available

## Development Scripts

```bash
npm run dev     # Start API with ts-node + nodemon
npm run build   # Compile TypeScript to dist/
npm start       # Run compiled server (dist/server.js)
npm run lint    # Lint sources
```

## Project Structure

```
src/
  app.ts                 # Express app wiring and routes
  server.ts              # HTTP server and worker lifecycle
  routes/                # REST routes (calls, metrics, callbacks)
  services/              # Kafka, Redis services
  worker/                # Worker and in‑memory buffer
  database/              # DB pool, queries, migrations
  types/                 # Zod schemas and types
```

## Notes & Next Steps

- Replace the placeholder external call flow with real provider integration
- Harden retry/backoff policies and dead‑letter handling
- Add authentication/authorization for client‑facing endpoints as needed
- Introduce structured logging and tracing

## License

ISC
