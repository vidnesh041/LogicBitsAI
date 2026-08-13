# LogicBitsAI — Multi-Agent AI System Architecture

LogicBitsAI is a full-stack, multi-agent AI orchestration platform powered by a dual-generation swarm engine (Google Gemini + xAI Grok).

---

## 🏗️ Architecture Overview

- **Frontend**: Next.js App Router (Deploys standalone on **Vercel**)
- **Backend**: FastAPI + LangGraph Multi-Agent Swarm (Deploys standalone web service on **Render**)
- **Database**: Firebase Firestore (Data persistence via `firebase-admin` service account key)
- **AI Models**: Google Gemini + xAI Grok

---

## 📁 Repository Structure

```
logicbits-ai/
├── backend/
│   ├── main.py               # Standalone FastAPI App & CORS middleware
│   ├── requirements.txt      # Python dependencies for Render
│   ├── ai/                   # Gemini & Grok provider adapters
│   ├── agents/               # LangGraph multi-agent pipeline
│   ├── tests/                # Unit & integration tests
│   └── .env.example          # Backend environment variable template
├── frontend/
│   ├── src/                  # Next.js App Router source code
│   └── .env.example          # Frontend environment variable template
├── .gitignore                # Excludes secrets, credentials, node_modules, & venvs
└── README.md                 # Setup & deployment documentation
```

---

## ⚙️ Environment Variables Setup

> [!IMPORTANT]
> `.env` and `.env.local` files are for **LOCAL DEVELOPMENT ONLY** and are strictly excluded by `.gitignore`.
> For production deployments, configure environment variables directly in your Render and Vercel dashboards.

### 1. Render Dashboard (Backend Web Service)
Configure these environment variables in your Render service settings:

| Variable Name | Purpose | Example / Notes |
| :--- | :--- | :--- |
| `PORT` | Web server port binding | Automatically assigned by Render |
| `ALLOWED_ORIGIN` | CORS permission for Vercel | `https://your-app.vercel.app` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `GROK_API_KEY` | xAI Grok API Key | `xai-...` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Base64-encoded Service Account Key | `eyJ0eXBlIjo...` |

### 2. Vercel Dashboard (Frontend Application)
Configure this environment variable in your Vercel project settings:

| Variable Name | Purpose | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Render backend API endpoint URL | `https://your-backend.onrender.com` |

---

## 🚀 Local Development Guide

### Single-Command Full-Stack Startup (Recommended)
From the root project folder, simply run:
```bash
npm install     # Installs root runner dependencies
npm run dev     # Boots BOTH FastAPI backend (8000) and Next.js frontend (3000) concurrently
```
- **Frontend Dashboard**: `http://localhost:3000/dashboard`
- **Backend API**: `http://localhost:8000`
- **Swagger Docs**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

---

### Manual / Individual Component Startup

#### 1. Start the FastAPI Backend
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Start the Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```

---


## ☁️ Deployment Instructions

### Deploy Backend to Render
1. Create a new **Web Service** on Render connected to your GitHub repository.
2. Set **Root Directory** to `backend`.
3. Set **Build Command** to `pip install -r requirements.txt`.
4. Set **Start Command** to `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`.
5. Add the backend Environment Variables in Render Dashboard.

### Deploy Frontend to Vercel

#### Option A: Vercel Web Dashboard (Recommended for Auto-Deployments)
1. Go to [Vercel Dashboard](https://vercel.com/new) and import your GitHub repository (`vidnesh041/LogicBitsAI`).
2. Set **Root Directory** to `frontend`.
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend-service.onrender.com` (Render Backend URL)
   - Firebase variables: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, etc.
4. Click **Deploy**. Any future `git push` to `main` automatically deploys updates.

#### Option B: Vercel CLI Deployment
```bash
cd frontend
npx vercel --prod
```

