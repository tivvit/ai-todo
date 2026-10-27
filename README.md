# ⚡ AI Todo

> **One-by-One Todoist Triage with Autonomous LLM Handover & Smart Follow-Up Checkers.**  
> Built for [Todoist](https://todoist.com) and powered by [Antigravity](https://antigravity.google) AI agents.

[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Version Control](https://img.shields.io/badge/VCS-Jujutsu%20(jj)-purple.svg)](https://github.com/martinvonz/jj)

---

## 🎯 The Problem & The Philosophy

Traditional todo lists become **graveyards of cognitive overload**. You open Todoist, see 50+ pending tasks, and freeze. You end up picking the easiest trivial task or closing the tab entirely.

**AI Todo** transforms your task workflow with two core principles:

1. **Extreme Sequential Focus ("Do this now?"):** Instead of presenting a massive overwhelming list, AI Todo shows you exactly **one task at a time**, prompting you to make an immediate, definitive decision.
2. **Autonomous LLM Handover & Checker Loop:** When you encounter a task you *cannot* or *do not want* to do, you shouldn't just let it rot. Hand it over to the AI agent. The agent takes ownership, prepares actions or drafts, and if the task is blocked waiting for an external reply (an email, an order update, feedback, or a delivery), it registers an **Automated Checker**. When a reply arrives or the follow-up threshold passes without response, the Checker triggers follow-up actions and surfaces the task back to your active queue.

---

## 🚀 The 4-Way Triage Decisions

For every single todo, you have four clear actions:

| Decision | What It Does | Todoist Synchronization |
| :--- | :--- | :--- |
| **✅ Done** | Marks the task as completed immediately. | Closes the task via Todoist v1 REST API (`POST /api/v1/tasks/{id}/close`). |
| **📝 Done with Note** | Complete with summary, with optional **Follow-Up Todo** creation. | Adds note as a comment, completes the task, and optionally spawns a new scheduled follow-up task in Todoist. |
| **⏳ Postpone with Reason** | Natural language rescheduling (`tomorrow`, `in 2 days`, `next Monday`) with accountability reason. | Updates `due_string` and logs a postponement comment explaining *why* it was delayed. |
| **🤖 Hand Over to LLM** | Delegate full task ownership to the Antigravity AI agent when you can't or don't want to do it. | Agent formulates execution plan, registers automated Checker, and syncs status comment to Todoist. |

---

## 🧠 Autonomous LLM Takeover & The Checker Engine

When you click **Hand Over to AI**:

```
[ User hands over task + optional note ]
                   │
                   ▼
       [ Antigravity LLM Agent ]
         • Analyzes task & context
         • Formulates execution plan
         • Takes preliminary action
                   │
                   ▼
      Is task waiting for a reply/event?
         /                     \
       YES                      NO
        │                        │
        ▼                        ▼
[ Schedule Checker ]      [ Mark Complete or ]
  • Condition to check    [ Surface Findings ]
  • Check interval (e.g. 24h)
  • Follow-up action rule
        │
        ▼
[ Background Cron Loop (every minute) ]
  • Has an external response been posted?
       ├─ YES ──> Trigger Checker & Resurface to Queue
       └─ NO  ──> Has timeout/max checks been reached?
                     ├─ YES ──> Execute Follow-up Action & Resurface
                     └─ NO  ──> Reschedule next check
```

### ⏱️ The Checker Life Cycle

* **Waiting Condition:** Tracks specific external events (e.g., *"Waiting for reply from vendor"*, *"Awaiting shipment tracking update"*, *"Pending client feedback"*).
* **Automated Cron Evaluator:** Evaluates active checkers in the background.
* **Smart Detection:** Monitors Todoist comments to detect external responses.
* **Follow-up Escalation:** If no response is received after the threshold (e.g., 3 checks over 72 hours), the system executes an automated follow-up comment on Todoist, elevates priority, and moves the item to **`surfaced`** state.
* **Resurfacing:** Surfaced tasks automatically leap to the front of your 1-by-1 triage queue with an alert banner explaining why they are back.

---

## 🗂️ Project & Time Horizon Scoping

Don't want to triage your entire Todoist account all at once? AI-Todo allows you to dynamically scope your focus session:

* **Project Filter:**
  * Work across **📁 All Projects** or focus on a single workspace (e.g. `#Inbox`, `#life`, `#ML`, `#projects`).
* **Time Horizon / Quick Filter Pills:**
  * ⚡ **Today & Overdue:** Instantly clear tasks that demand immediate attention today or slipped past deadline.
  * 📅 **Today:** Focus strictly on items scheduled for the current date.
  * ⏳ **Next 7 Days (Near Future):** Plan and triage what is coming up over the coming week.
  * 🗓️ **Scheduled:** All tasks that have an explicit due date.
  * 📥 **Someday (No Date):** Review backlog and unassigned tasks without deadlines.
  * 🌐 **All Tasks:** Full view across the entire active inventory.

Filters seamlessly persist in your browser and automatically update both the 1-by-1 Focus queue and the All Active Tasks table.

---

## 👤 User vs. 🤖 AI Completion Attribution

Every completed task is visibly and permanently attributed:
* **In Todoist:**
  * **Tags:** Auto-tagged with `user-completed` or `ai-completed`.
  * **Comments:** Closed with a structured audit log comment (`👤 **[Completed by User]** Note: ...` or `🤖 **[Completed by AI Agent]** ...`).
* **In AI-Todo UI:**
  * **History View (`/history`):** Explicit actor badges (emerald `👤 Completed by User` vs indigo `🤖 Completed by AI Agent`) and filter tabs to audit actions.


```
ai-todo/
├── server/
│   ├── index.ts          # Express REST API & static file serving
│   ├── config.ts         # Environment & token auto-discovery
│   ├── todoist.ts        # Todoist v1 REST API client
│   ├── agent.ts          # Antigravity CLI ('agy') bridge & reasoning engine
│   ├── checker.ts        # Background Cron runner & follow-up evaluator
│   └── db.ts             # SQLite (WAL mode) for checkers, logs & history
├── src/
│   ├── App.tsx           # Main application controller & state
│   ├── types.ts          # TypeScript interfaces
│   ├── components/
│   │   ├── Header.tsx            # Connectivity badges & navigation
│   │   ├── FocusView.tsx         # 1-by-1 focus card & modal flows
│   │   ├── DelegatedDashboard.tsx# Live agent status & active checkers
│   │   ├── AllTasksView.tsx      # Filterable search table of all todos
│   │   ├── HistoryView.tsx       # Audit trail of decisions
│   │   └── SettingsView.tsx      # Token & LLM diagnostics
│   └── index.css         # Tailwind styles
├── data/                 # SQLite database & local storage
├── dist/                 # Production build artifacts
└── package.json
```

### Key Technologies
* **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite 6.
* **Backend:** Node.js, Express, `better-sqlite3` (WAL mode), `node-cron`.
* **AI Engine:** Google Antigravity CLI (`agy`), with heuristic fallback.
* **Integrations:** Todoist Unified v1 API (`https://api.todoist.com/api/v1`).
* **Zero-Config Token Discovery:** Automatically reads Todoist tokens from running OpenClaw configurations (`mcporter.json` / container mounts).

---

## ⚡ Quick Start

### 1. Prerequisites
* **Node.js:** v20.0.0 or later (`v22+` recommended).
* **Todoist Account:** Personal API Token from [Todoist Integrations](https://todoist.com/app/settings/integrations/developer).
* **Antigravity CLI (Optional but recommended):** Installed at `~/.local/bin/agy` or available in `$PATH`.

### 2. Installation

Clone and install dependencies:
```bash
git clone https://github.com/tivvit/ai-todo.git
cd ai-todo
npm install
```

### 3. Configure API Key

AI Todo automatically checks:
1. `TODOIST_API_TOKEN` environment variable in `.env`.
2. Running OpenClaw container configuration (`/data/var/openclaw/workspace/config/mcporter.json`).
3. Local file `data/token.txt` or through the in-app **Settings** UI.

To manually specify your token:
```bash
echo "TODOIST_API_TOKEN=your_todoist_api_token_here" > .env
```

### 4. Running Development Server

```bash
npm run dev
```
* **Frontend (Vite):** `http://localhost:5173`
* **Backend API:** `http://localhost:3333`

### 5. Production Build & Execution

```bash
npm run build
npm start
```
The unified production server will be running on `http://localhost:3333`.

### 6. Docker & Jarvis Deployment

AI Todo is deployed to Jarvis using Docker Compose:
```bash
# Build Docker image
docker build -t ai-todo:latest .

# Deploy via Jarvis Docker Compose
docker compose -f /data/var/docker-compose.yml up -d ai-todo
```

Access surfaces on Jarvis:
* Local Port: `http://localhost:3333`
* Traefik Domains: `http://ai-todo.jarvis.lan` or `http://todo.jarvis.lan`

---

## 🧭 Skills: Deploy to Jarvis (`deploy-to-jarvis`)

An Antigravity skill has been installed globally at `~/.gemini/config/skills/deploy-to-jarvis/SKILL.md` and in the repository at `.agents/skills/deploy-to-jarvis/SKILL.md`. It standardizes how services and containers are built, configured with persistent storage (`/data/var/<service>`), Traefik-routed, and orchestrated through `/data/var/docker-compose.yml`.

---

## 📦 Version Control with Jujutsu (jj)

This repository is managed with [Jujutsu](https://github.com/martinvonz/jj), a next-generation Git-compatible VCS:

```bash
# Check working copy status
jj status

# Describe your changes
jj describe -m "feat: implement 1-by-1 triage with antigravity handoff"

# Create a new change
jj new

# View revision graph
jj log

# Push to GitHub
jj git push
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [issues page](https://github.com/tivvit/ai-todo/issues).

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
