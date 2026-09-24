# PropBooks - Real Estate Accounting & Property Management System

A desktop-first, multi-entity real estate accounting application featuring a full Chart of Accounts (COA) engine, automated bank & property management statement parsers (Chase, Wells Fargo, AppFolio, Buildium), check printing with magnetic MICR alignment, general journal entries, and real-time financial reporting (Monthly P&L, Concise 12-Month P&L, Balance Sheet).

---

## 🚀 Laptop Setup & Quick Start

Follow these steps to set up and run the project on your laptop:

### 1. Prerequisites
Ensure your laptop has the following installed:
- **Git**: [git-scm.com](https://git-scm.com/)
- **Python 3.10+**: [python.org](https://www.python.org/)
- **Node.js 18+ (LTS)**: [nodejs.org](https://nodejs.org/)
- **IDE**: [Antigravity IDE](https://antigravity.google) or Visual Studio Code

---

### 2. Clone the Repository
Open a terminal (PowerShell, Command Prompt, or Terminal) and run:
```bash
git clone https://github.com/agupta3224-web/Accounting.git
cd Accounting
```

---

### 3. Install Python Dependencies
```bash
python -m pip install -r requirements.txt
```

---

### 4. Install & Build Frontend
```bash
cd frontend
npm install
npm run build
cd ..
```

---

### 5. Launch the Application
Start the unified full-stack server:
```bash
python run_app.py
```
Then open your browser to:
👉 **`http://localhost:8000`**

- **API Documentation**: `http://localhost:8000/docs`
- **Frontend App**: `http://localhost:8000`

---

## 🛠️ Development Mode (Hot Reload)
If you want to edit code with instant frontend live-reloading:
- **Terminal 1 (Backend)**:
  ```bash
  python run_app.py
  ```
- **Terminal 2 (Frontend Dev Server)**:
  ```bash
  cd frontend
  npm run dev
  ```
  Open the Vite development URL (typically `http://localhost:5173`).

---

## 🧪 Running Automated Tests
Run all 70 automated pytest tests:
```bash
python -m pytest tests -v
```

---

## 📂 Project Architecture
```text
Accounting/
├── backend/                  # FastAPI REST backend & engines
│   ├── main.py               # Main application router & SPA mount
│   ├── coa_engine.py         # Standard 5-digit COA & sub-accounts
│   ├── bank_parser_engine.py # Chase CSV, Wells Fargo PDF, auto-categorization
│   ├── check_engine.py       # Check register, check writing & printing
│   ├── company_manager.py    # Multi-company .propbooks SQLite files & backups
│   ├── reporting_service.py  # P&L and financial statements
│   └── rule_engine.py        # Automated vendor & keyword categorization rules
├── frontend/                 # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/components/       # UI modals (Bank Wizard, COA, Check Register, etc.)
│   ├── src/pages/            # Dashboard, COA, Register, Reports
│   └── src/services/api.ts   # Axios API client
├── sample_statements/        # Test CSV & PDF statement fixtures
├── tests/                    # 70 automated pytest test cases
├── requirements.txt          # Python dependencies
└── run_app.py                # Standalone application launcher
```

---

## 🔄 Syncing Changes Between Devices
When you finish making changes on your laptop:
```bash
git add .
git commit -m "Describe your changes"
git push
```

When you return to your desktop computer:
```bash
git pull
```
