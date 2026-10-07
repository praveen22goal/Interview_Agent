# AI Interview Coach

A local-first technical interview practice app. The Next.js frontend talks to a FastAPI backend, which uses Groq's `openai/gpt-oss-120b` model for the interviewer and evidence-based report. Conversations are sent with each request; there is no database.

## Requirements

- Node.js 20.9 or newer
- Python 3.10 or newer
- A Groq API key for interview requests

## Run locally on Windows

Open two PowerShell terminals from the project root.

### 1. Backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
```

Add your key to `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Keep this file private; it is ignored by Git. Start the API:

```powershell
python -m uvicorn main:app --reload --port 8000
```

The health check is available at <http://localhost:8000/health>.

### 2. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.local.example .env.local
npm run dev
```

Open <http://localhost:3000>.

## Run locally on macOS or Linux

Backend terminal:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
# Add GROQ_API_KEY to .env, then:
python -m uvicorn main:app --reload --port 8000
```

Frontend terminal:

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

## API

- `GET /health` reports API availability and whether Groq is configured.
- `POST /api/interview/start` accepts a topic and difficulty and returns the first question.
- `POST /api/interview/answer` accepts the conversation and latest answer, then returns the next interviewer message and whether the interview has ended.
- `POST /api/interview/report` accepts the full conversation and returns a structured scorecard.

## Deploy

Deploy the `backend` directory as a Python 3 web service on Render:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment variables: `GROQ_API_KEY`, `GROQ_MODEL=openai/gpt-oss-120b`, and `FRONTEND_ORIGINS=<your Vercel URL>`

Deploy the `frontend` directory on Vercel. Set `NEXT_PUBLIC_API_URL` to the Render service URL without a trailing slash. Add the deployed Vercel origin to `FRONTEND_ORIGINS` on Render and redeploy the backend.

## Push to GitHub

Create an empty GitHub repository, then run these commands from the project root if Git has not been initialized:

```powershell
git init
git add .
git commit -m "Initial commit: AI Interview Coach"
git remote add origin https://github.com/praveen22goal/Interview_Agent.git
git branch -M main
git push -u origin main
```

Never commit `backend/.env`, `frontend/.env.local`, or any API key.
