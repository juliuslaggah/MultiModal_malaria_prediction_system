import os
import pandas as pd
import json
import joblib
import xgboost as xgb
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from imblearn.over_sampling import SMOTE
import matplotlib.pyplot as plt
import seaborn as sns

# CONFIG
SL_DATA_PATH = "../../data/tabular/sierra_leone/malaria_sl.csv"
ARTIFACTS_DIR = "artifacts"

# Phase 2 artifact names
PHASE2_XGB_PATH = f"{ARTIFACTS_DIR}/best_tabular_model.json"
PHASE2_METRICS_PATH = f"{ARTIFACTS_DIR}/phase2_metrics_sl.json"


def analyze_predictions(y_true, y_pred, y_proba, dataset_name="Test"):
    """Calculate and display comprehensive metrics"""
    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    roc_auc = roc_auc_score(y_true, y_proba[:, 1]) if y_proba is not None else 0
    cm = confusion_matrix(y_true, y_pred)
    
    print(f"\n📊 {dataset_name} Set Metrics:")
    print(f"   Accuracy:  {acc:.4f}")
    print(f"   Precision: {prec:.4f}")
    print(f"   Recall:    {rec:.4f}")
    print(f"   F1 Score:  {f1:.4f}")
    print(f"   ROC-AUC:   {roc_auc:.4f}")
    print(f"\n   Confusion Matrix:")
    print(f"   TN: {cm[0][0]:4d}  FP: {cm[0][1]:4d}")
    print(f"   FN: {cm[1][0]:4d}  TP: {cm[1][1]:4d}")
    
    return {
        'accuracy': acc,
        'precision': prec,
        'recall': rec,
        'f1': f1,
        'roc_auc': roc_auc,
        'confusion_matrix': cm.tolist()
    }


def analyze_symptom_patterns(df, target_col):
    """Analyze Sierra Leone symptom patterns in detail"""
    symptom_cols = ['Fever', 'Headache', 'Abdominal_Pain', 'General_Body_Malaise',
                    'Dizziness', 'Vomiting', 'Confusion', 'Backache',
                    'Chest_Pain', 'Coughing', 'Joint_Pain']
    
    print("\n" + "="*60)
    print("📊 SIERRA LEONE DATASET ANALYSIS")
    print("="*60)
    
    infected = df[df[target_col] == 1]
    uninfected = df[df[target_col] == 0]
    
    print(f"Total samples: {len(df)}")
    print(f"Infected: {len(infected)} ({len(infected)/len(df)*100:.1f}%)")
    print(f"Uninfected: {len(uninfected)} ({len(uninfected)/len(df)*100:.1f}%)")
    
    print("\n🔴 Symptom prevalence in INFECTED patients:")
    for symptom in symptom_cols:
        if symptom in df.columns:
            pct = infected[symptom].mean() * 100
            print(f"  {symptom:25}: {pct:6.2f}%")
    
    print("\n🟢 Symptom prevalence in UNINFECTED patients:")
    for symptom in symptom_cols:
        if symptom in df.columns:
            pct = uninfected[symptom].mean() * 100
            print(f"  {symptom:25}: {pct:6.2f}%")
    
    # Calculate symptom counts
    infected_counts = infected[symptom_cols].sum(axis=1)
    uninfected_counts = uninfected[symptom_cols].sum(axis=1)
    
    print(f"\n📈 Average symptoms in Infected: {infected_counts.mean():.2f}")
    print(f"📉 Average symptoms in Uninfected: {uninfected_counts.mean():.2f}")
    
    # CRITICAL: Find infected patients with FEW symptoms
    print("\n⚠️  CRITICAL ANALYSIS:")
    for threshold in [0, 1, 2, 3]:
        few_symptom_infected = infected[infected_counts <= threshold]
        pct = len(few_symptom_infected)/len(infected)*100 if len(infected) > 0 else 0
        print(f"   Infected with ≤{threshold} symptoms: {len(few_symptom_infected)} patients ({pct:.1f}%)")
    
    return infected_counts.mean(), uninfected_counts.mean()


def run_phase2():
    print("🚀 [Step 3] Starting Phase 2: Sierra Leone-Specific Training...")
    print("="*60)

    if not os.path.exists(SL_DATA_PATH):
        print(f"❌ Error: Sierra Leone data not found at {SL_DATA_PATH}")
        return

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)

    # 1. Load Artifacts from Phase 1
    with open(f"{ARTIFACTS_DIR}/selected_features.json", "r") as f:
        selected_cols = json.load(f)
    print(f"✅ Loaded {len(selected_cols)} features")

    imputer = joblib.load(f"{ARTIFACTS_DIR}/tabular_imputer.pkl")
    scaler = joblib.load(f"{ARTIFACTS_DIR}/tabular_scaler.pkl")
    print("✅ Loaded imputer and scaler from Phase 1")

    # 2. Load Sierra Leone Data
    df = pd.read_csv(SL_DATA_PATH)
    df.columns = [c.strip() for c in df.columns]
    print(f"✅ Loaded Sierra Leone data: {df.shape}")

    # Remove leakage columns if they exist
    leakage_cols = ['Risk_Score', 'IP_Number', 'Primary_Code', 'Diagnosis_Type',
                    'DOA', 'Discharge_Date', 'Residence_Area']
    for col in leakage_cols:
        if col in df.columns:
            print(f"⚠️  Removing leakage column: {col}")
            df = df.drop(columns=[col])

    # Handle Sex
    if "Sex" in df.columns:
        df["Sex"] = df["Sex"].astype(str).apply(lambda x: 1 if x.lower().strip() in ["male", "m"] else 0)

    target_col = "Target" if "Target" in df.columns else df.columns[-1]
    
    # Analyze dataset
    avg_inf, avg_uninf = analyze_symptom_patterns(df, target_col)

    # Ensure all features exist
    for feat in selected_cols:
        if feat not in df.columns:
            print(f"⚠️ Adding missing feature: {feat} (default 0)")
            df[feat] = 0

    # Prepare data
    X = df[selected_cols].values
    y = df[target_col].values

    # Apply preprocessing from Phase 1
    X = imputer.transform(X)
    X = scaler.transform(X)

    # Split (70% train, 30% test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, stratify=y, random_state=42
    )
    
    # Further split train into train/val
    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=0.2, stratify=y_train, random_state=42
    )
    
    print(f"\n📊 Data split:")
    print(f"   Train: {len(X_train)} samples")
    print(f"   Validation: {len(X_val)} samples")
    print(f"   Test: {len(X_test)} samples")

    # Apply SMOTE carefully
    print("\n🔄 Applying SMOTE to training data...")
    smote = SMOTE(random_state=42, sampling_strategy=0.8)
    X_train_res, y_train_res = smote.fit_resample(X_train, y_train)
    print(f"   Train set size after SMOTE: {len(X_train_res)}")
    print(f"   Class distribution after SMOTE: {np.bincount(y_train_res)}")

    # Train model specifically for Sierra Leone
    print("\n" + "="*60)
    print("🎯 Training XGBoost for SIERRA LEONE patterns...")
    print("="*60)
    
    # Calculate scale_pos_weight for imbalance
    scale_pos_weight = (len(y_train_res) - sum(y_train_res)) / sum(y_train_res)
    
    # Parameters optimized for Sierra Leone's unique patterns
    xgb_sl = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=3,              # Shallow trees
        learning_rate=0.03,        # Slow learning
        subsample=0.7,             # Random sampling
        colsample_bytree=0.7,      # Feature sampling
        reg_alpha=0.3,             # L1 regularization
        reg_lambda=2.0,            # L2 regularization
        min_child_weight=5,         # Minimum child weight
        gamma=0.2,                  # Minimum loss reduction
        scale_pos_weight=scale_pos_weight,
        use_label_encoder=False,
        eval_metric='logloss',
        random_state=42
    )
    
    # Train with validation set
    xgb_sl.fit(
        X_train_res, y_train_res,
        eval_set=[(X_val, y_val)],
        verbose=False
    )

    # Evaluate on test set
    y_pred = xgb_sl.predict(X_test)
    y_proba = xgb_sl.predict_proba(X_test)
    
    print("\n" + "="*60)
    print("🏆 FINAL RESULTS - SIERRA LEONE MODEL")
    print("="*60)
    metrics = analyze_predictions(y_test, y_pred, y_proba, "Test")
    
    # Detailed probability analysis
    infected_probs = y_proba[y_test == 1, 1]
    uninfected_probs = y_proba[y_test == 0, 1]
    
    print(f"\n📊 Probability Distribution:")
    print(f"  Infected cases   - avg: {infected_probs.mean():.3f} | min: {infected_probs.min():.3f} | max: {infected_probs.max():.3f}")
    print(f"  Uninfected cases - avg: {uninfected_probs.mean():.3f} | min: {uninfected_probs.min():.3f} | max: {uninfected_probs.max():.3f}")
    
    # Find optimal threshold
    print("\n🎯 Finding optimal probability threshold...")
    thresholds = np.arange(0.3, 0.8, 0.05)
    best_f1 = 0
    best_threshold = 0.5
    
    for thresh in thresholds:
        pred_thresh = (y_proba[:, 1] >= thresh).astype(int)
        f1 = f1_score(y_test, pred_thresh, zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_threshold = thresh
    
    print(f"   Optimal threshold: {best_threshold:.2f} (F1: {best_f1:.4f})")
    
    # Feature importance for Sierra Leone model
    print("\n📊 Top features from SIERRA LEONE model:")
    sl_importance = sorted(zip(selected_cols, xgb_sl.feature_importances_),
                          key=lambda x: x[1], reverse=True)[:10]
    for feat, imp in sl_importance:
        print(f"  {feat:25}: {imp:.4f}")

    # Save model
    xgb_sl.save_model(PHASE2_XGB_PATH)
    print(f"\n✅ Model saved to {PHASE2_XGB_PATH}")
    
    # Save metrics
    with open(PHASE2_METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"✅ Metrics saved to {PHASE2_METRICS_PATH}")

    # ============================================
    # CRITICAL TEST: Low-symptom cases
    # ============================================
    print("\n" + "="*60)
    print("🧪 TESTING LOW-SYMPTOM CASES")
    print("="*60)
    
    test_cases = [
        {
            "name": "Case 1: NO SYMPTOMS (asymptomatic)",
            "symptoms": {}
        },
        {
            "name": "Case 2: Fever only",
            "symptoms": {'Fever': 1}
        },
        {
            "name": "Case 3: Fever + Headache",
            "symptoms": {'Fever': 1, 'Headache': 1}
        },
        {
            "name": "Case 4: Fever + Headache + Malaise",
            "symptoms": {'Fever': 1, 'Headache': 1, 'General_Body_Malaise': 1}
        },
        {
            "name": "Case 5: Classic malaria (Fever+Headache+Malaise+Vomiting)",
            "symptoms": {'Fever': 1, 'Headache': 1, 'General_Body_Malaise': 1, 'Vomiting': 1}
        },
        {
            "name": "Case 6: Respiratory (Cough + Chest Pain + Fever)",
            "symptoms": {'Fever': 1, 'Coughing': 1, 'Chest_Pain': 1}
        },
        {
            "name": "Case 7: Gastrointestinal (Abdominal Pain + Vomiting)",
            "symptoms": {'Abdominal_Pain': 1, 'Vomiting': 1}
        }
    ]
    
    # Base data with age and sex
    base_data = {'Age': 30, 'Sex': 0}
    
    print("\n" + "-"*60)
    print("PREDICTIONS ON TEST CASES:")
    print("-"*60)
    
    for case in test_cases:
        # Create data dictionary
        data = base_data.copy()
        data.update(case['symptoms'])
        
        # Add all symptoms with default 0
        for symptom in selected_cols:
            if symptom not in data and symptom not in ['Age', 'Sex']:
                data[symptom] = 0
        
        # Convert to DataFrame and preprocess
        df_case = pd.DataFrame([data])
        df_case = df_case[selected_cols]
        X_case = scaler.transform(imputer.transform(df_case.values))
        
        # Get prediction
        prob = xgb_sl.predict_proba(X_case)[0][1]
        pred = "INFECTED" if prob > 0.5 else "UNINFECTED"
        
        symptom_count = sum([v for k, v in data.items() 
                           if k in ['Fever','Headache','Abdominal_Pain','General_Body_Malaise',
                                   'Dizziness','Vomiting','Confusion','Backache',
                                   'Chest_Pain','Coughing','Joint_Pain']])
        
        print(f"\n{case['name']}")
        print(f"  Symptoms: {symptom_count}")
        if symptom_count > 0:
            symptoms_present = [k for k, v in case['symptoms'].items() if v == 1]
            print(f"  Present: {symptoms_present}")
        print(f"  Probability: {prob:.3f}")
        print(f"  Prediction: {pred}")
    
    print("\n" + "="*60)
    print("✅ PHASE 2 COMPLETE")
    print("="*60)
    print("\nNext steps:")
    print("1. Use this model in your deployment")
    print(f"2. Consider using threshold: {best_threshold:.2f}")
    print("3. Test with your UI to verify predictions")


if __name__ == "__main__":
    run_phase2()

