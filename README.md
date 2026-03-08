# 🦟 Multimodal Malaria Prediction System

A production-ready malaria diagnosis system that combines clinical symptoms and blood smear images using machine learning for accurate prediction. The system features a modern Next.js frontend and FastAPI backend with explainable AI capabilities.

## ✨ Features

### 🔬 Multimodal Diagnosis
- **Clinical-only Prediction**: Based on patient symptoms (13 clinical features)
- **Image-only Prediction**: Analysis of blood smear images using ShuffleNetV2
- **Fusion Prediction**: Combined clinical and image analysis for enhanced accuracy

### 🤖 Machine Learning Models
- **Clinical Model**: XGBoost classifier trained on Sierra Leone patient data
- **Image Model**: ShuffleNetV2 CNN for blood cell analysis
- **Fusion Model**: Late fusion with learnable weights

### 🎯 Explainable AI
- **SHAP Values**: Feature importance for clinical predictions
- **LIME**: Local interpretable explanations
- **Grad-CAM**: Heatmap visualization for image predictions

### 📊 Dashboard & Analytics
- Real-time prediction statistics
- Interactive history viewer
- Export capabilities (CSV, JSON)
- Filtering and search

### 🏥 Production Ready
- PostgreSQL database
- Docker containerization
- Comprehensive logging
- Health checks and monitoring

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Library**: Ant Design + Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.10+
- **ML Libraries**: PyTorch, XGBoost, scikit-learn
- **Explainability**: Captum, SHAP, LIME
- **Database**: SQLAlchemy with PostgreSQL
- **Migration**: Alembic

### DevOps
- **Version Control**: Git
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL 14+

## 🚀 Quick Start with Docker (Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed

### One Command Setup
```bash
git clone https://github.com/juliuslaggah/MultiModal_malaria_prediction_system.git
cd MultiModal_malaria_prediction_system/deployment
docker-compose up -d
```

### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Useful Docker Commands
```bash
docker-compose down     # Stop everything
docker-compose logs -f  # View logs
docker-compose ps       # Check status
```

## 💻 Manual Setup (Without Docker)

### 1. Clone Repository
```bash
git clone https://github.com/juliuslaggah/MultiModal_malaria_prediction_system.git
cd MultiModal_malaria_prediction_system
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🗄️ Database Setup

### SQLite (Default)
No setup needed - works out of the box.

### PostgreSQL (Production)
```bash
# Install PostgreSQL
# https://www.postgresql.org/download/windows/

# Create database and user
sudo -u postgres psql
CREATE DATABASE malaria_db;
CREATE USER malaria_user WITH PASSWORD '1111';
GRANT ALL PRIVILEGES ON DATABASE malaria_db TO malaria_user;

# Update backend/.env
DATABASE_URL=postgresql://malaria_user:1111@localhost:5432/malaria_db
```

## 📁 Project Structure
```
├── deployment/
│   ├── backend/           # FastAPI + ML models
│   │   ├── app/           # Application code
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── frontend/          # Next.js web app
│   │   ├── src/           # Source code
│   │   ├── package.json
│   │   └── Dockerfile
│   └── docker-compose.yml
└── README.md
```

## 🔧 Environment Variables

**Backend** (`backend/.env`):
```env
DATABASE_URL=postgresql://malaria_user:1111@postgres:5432/malaria_db
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://backend:8000
```

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predict` | Make prediction |
| GET | `/history` | Get prediction history |
| GET | `/predictions/{id}` | Get specific prediction |
| GET | `/health` | System health check |

## 👥 Author
- **Julius Laggah** - [GitHub](https://github.com/juliuslaggah)

---

**Built with ❤️ for accurate malaria diagnosis**
