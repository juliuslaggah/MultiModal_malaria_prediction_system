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
- **Database**: SQLAlchemy with PostgreSQL/SQLite
- **Migration**: Alembic

### DevOps
- **Version Control**: Git
- **Containerization**: Docker
- **Database**: PostgreSQL 14+
- **CI/CD**: GitHub Actions (optional)

## 🏗️ System Architecture


## How to Clone and Use This Project

### 1. Clone the Repository
```bash
git clone https://github.com/juliuslaggah/MultiModal_malaria_prediction_system.git
cd MultiModal_malaria_prediction_system

###  Go to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate it (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
python -m app.main

# Open a new terminal
# Go to frontend folder
cd frontend

# Install dependencies
npm install

# Start the frontend
npm run dev


## Database Setup (Optional - for production)

### Using SQLite (Default - no setup needed)
- The project uses SQLite by default when you first run it

### Using PostgreSQL (For production)
```bash
# Install PostgreSQL on your system
https://www.postgresql.org/download/windows/
# Then create a database and user:

# 1. Access PostgreSQL
sudo -u postgres psql

# 2. Create your database (use your own secure password)
CREATE DATABASE your_database_name;
CREATE USER your_username WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE your_database_name TO your_username;

# 3. Update the .env file in the backend folder
# DATABASE_URL=postgresql://your_username:your_secure_password@localhost:5432/your_database_name