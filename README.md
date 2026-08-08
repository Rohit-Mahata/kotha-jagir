# Kotha Jagir Solution Private Limited

A dual-marketplace web application for finding **rooms/flats** and **jobs** in Kathmandu, Nepal.

Built as a single-service Node.js + Express application with a Vanilla JS SPA frontend, backed by Supabase (PostgreSQL), Cloudflare R2 (media storage), and Resend (email).

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js v20 or higher** (developed on v26.6.0; minimum compatible is v20 LTS)
- A Supabase project (PostgreSQL database)
- A Cloudflare R2 bucket
- A Resend account (for email OTP)

### 1. Clone and Install

```bash
git clone https://github.com/Rohit-Mahata/kotha-jagir.git
cd kotha-jagir
npm install
```

### 2. Configure Environment Variables

Copy the example below into a new file named `.env` in the project root and fill in your real values:

```env
# Cloudflare R2 Storage
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ACCOUNT_ID=
R2_BUCKET_NAME=
R2_ENDPOINT=
R2_PUBLIC_URL=

# Resend Email API
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# JWT Signing Secret (choose a long random string)
JWT_SECRET=

# Supabase PostgreSQL connection string
DATABASE_URL=
```

> **Never commit your `.env` file.** It is listed in `.gitignore` and must stay out of version control.

### 3. Run Locally

```bash
npm start
```

The server starts at **http://localhost:3000** by default.

For development with auto-restart on file changes:

```bash
npm run dev
```

---

## 📁 Project Structure

```
/
├── server.js          # Express server — API routes, auth, file uploads
├── db.js              # PostgreSQL connection pool (via pg)
├── r2.js              # Cloudflare R2 storage helpers
├── mailer.js          # Resend email (OTP delivery)
├── package.json       # Root dependencies and scripts
├── .env               # NOT committed (secrets go here)
└── public/            # Static frontend files served by Express
    ├── index.html     # App shell (single-page app entry point)
    ├── app.js         # Complete Vanilla JS SPA (2500+ lines)
    ├── api.js         # Frontend API client (talks to /api/* routes)
    └── styles.css     # App stylesheet
```

---

## 🌐 Deployment (Render)

This project deploys as **one service** on [Render](https://render.com):

| Setting | Value |
|---|---|
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Environment** | `Node` |
| **Port** | Set automatically via `PORT` env var |

### Required Environment Variables on Render

Set each of these in your Render service's **Environment** tab:

- `DATABASE_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT`
- `R2_PUBLIC_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `JWT_SECRET`
- `NODE_ENV` → set to `production`

---

## 🔧 Available Scripts

| Script | Command | Description |
|---|---|---|
| Start | `npm start` | Run the production server |
| Dev | `npm run dev` | Run with auto-restart (Node --watch) |
| Build | `npm run build` | No-op (vanilla JS, no build step needed) |

---

## 🗄️ Database

Uses **Supabase PostgreSQL**. The schema is defined in `supabase_setup.sql`. Run it once against your Supabase project to create all required tables.

The server auto-seeds initial data (localities, job categories, room types, admin account) on first start if the database is empty.

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v20+ |
| Web Framework | Express 4 |
| Database | PostgreSQL via Supabase |
| Query Layer | `pg` (raw SQL) |
| Media Storage | Cloudflare R2 (S3-compatible) |
| Video Processing | ffmpeg (fluent-ffmpeg + ffmpeg-static) |
| PDF Generation | PDFKit |
| Email | Resend |
| Auth | JWT + bcrypt + HttpOnly cookies |
| Frontend | Vanilla JS SPA (hash router) |

---

## 📄 License

Private — Kotha Jagir Solution Private Limited. All rights reserved.
