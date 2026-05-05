# MobileSpic Backend

This is the ready-to-run backend for MobileSpic.

## Files

```text
backend/
├── server.js
├── package.json
├── .env.example
└── README.md
```

## Setup

1. Copy `.env.example` to `.env`

```bash
cp .env.example .env
```

2. Put your Supabase `DATABASE_URL` and admin credentials in `.env`

3. Install packages

```bash
npm install
```

4. Run server

```bash
npm start
```

## Check

Open:

```text
http://localhost:4000/api/health
```

Expected:

```json
{ "ok": true }
```

## Serve Frontend From This Backend

If you want one backend folder to run both API and the visitor website:

1. Build the frontend in the main project:

```bash
npm run build
```

2. Copy all files from `dist/` into:

```text
backend/public/
```

3. Start backend:

```bash
npm start
```

4. Visit:

```text
http://localhost:4000
```

The server will automatically serve `backend/public/index.html` for the frontend.

## API

- `POST /register`
- `POST /login`
- `GET /profile`
- `GET /admin/users`
- `DELETE /admin/user/:id`
- `GET /api/public/bootstrap`
- `GET/POST/PUT/DELETE /api/brands`
- `GET/POST/PUT/DELETE /api/phones`
- `GET/POST/PUT/DELETE /api/articles`
- `GET/POST/PUT/DELETE /api/pages`
- `GET/POST/PUT/DELETE /api/ads`
- `GET/POST/PUT/DELETE /api/carousel`
- `GET/POST/PUT/DELETE /api/filters`
- `POST /api/visits/:pageId`

## Important

This server auto-creates database tables when it starts.

No Prisma is required for this raw PostgreSQL backend.