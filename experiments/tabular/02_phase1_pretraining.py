import pandas as pd
import json
import joblib
import xgboost as xgb
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import MinMaxScaler
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from imblearn.over_sampling import SMOTE
import matplotlib.pyplot as plt
import seaborn as sns
import os

# CONFIG
BD_DATA_PATH = "../../data/tabular/bangladesh/Malaria_Dataset.csv"
ARTIFACTS_DIR = "artifacts"

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


def plot_feature_importance(model, feature_names, model_name, save_path):
    """Plot feature importance"""
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
    elif hasattr(model, 'coef_'):
        importances = np.abs(model.coef_[0])
    else:
        return
    
    # Create dataframe
    imp_df = pd.DataFrame({
        'feature': feature_names,
        'importance': importances
    }).sort_values('importance', ascending=False)
    
    # Plot
    plt.figure(figsize=(10, 6))
    sns.barplot(x='importance', y='feature', data=imp_df.head(15), palette='viridis')
    plt.title(f'{model_name} Feature Importance (Bangladesh)')
    plt.tight_layout()
    plt.savefig(f"{save_path}/{model_name.lower().replace(' ', '_')}_importance_bd.png", dpi=150)
    plt.close()


def check_data_leakage(df, target_col):
    """Comprehensive data leakage check"""
    print("\n" + "="*60)
    print("🔍 DATA LEAKAGE DETECTION")
    print("="*60)
    
    # 1. Check all columns
    print(f"\n📋 All columns in dataset:")
    for i, col in enumerate(df.columns):
        print(f"   {i+1:2d}. {col}")
    
    # 2. Check for Risk_Score
    if 'Risk_Score' in df.columns:
        print("\n⚠️  RISK_SCORE DETECTED!")
        corr = df['Risk_Score'].corr(df[target_col])
        print(f"   Correlation with Target: {corr:.3f}")
        
        print("\n   Risk_Score distribution by Target:")
        print(df.groupby(target_col)['Risk_Score'].describe())
        
        # Check if Risk_Score perfectly predicts Target
        if corr > 0.9:
            print("   ❌ CRITICAL: Risk_Score is almost perfectly correlated with Target!")
            print("   This is definite data leakage - Risk_Score must be removed!")
    else:
        print("\n✅ Risk_Score not found in dataset")
    
    # 3. Check for duplicate patients
    if 'IP_Number' in df.columns:
        duplicates = df['IP_Number'].duplicated().sum()
        print(f"\n🔄 Duplicate IP_Number entries: {duplicates}")
        if duplicates > 0:
            print("   ⚠️  Found duplicate patients - might cause data leakage")
            
            # Show examples of duplicates
            dup_ips = df[df['IP_Number'].duplicated(keep=False)]['IP_Number'].unique()[:3]
            for ip in dup_ips:
                dup_rows = df[df['IP_Number'] == ip]
                print(f"\n   IP {ip} appears {len(dup_rows)} times:")
                for idx, row in dup_rows.iterrows():
                    print(f"     Target: {row[target_col]}, Risk_Score: {row.get('Risk_Score', 'N/A')}")
    
    # 4. Check Diagnosis_Type for leakage
    if 'Diagnosis_Type' in df.columns:
        print("\n🔬 Diagnosis_Type analysis:")
        diag_summary = df.groupby('Diagnosis_Type')[target_col].value_counts().unstack(fill_value=0)
        print(diag_summary)
        
        # Check if Diagnosis_Type perfectly predicts Target
        perfect_diag = any(diag_summary.sum(axis=1) == diag_summary.max(axis=1))
        if perfect_diag:
            print("   ⚠️  Some Diagnosis_Type values perfectly predict Target!")
            print("   Consider removing Diagnosis_Type if it's not available in deployment")
    
    # 5. Check for date-based leakage
    date_cols = [col for col in df.columns if 'Date' in col or 'DOA' in col or 'Discharge' in col]
    if date_cols:
        print(f"\n📅 Date columns found: {date_cols}")
        print("   Check if dates are correlated with outcomes (e.g., seasonal patterns)")
    
    # 6. Check feature-target correlations
    print("\n📊 Top feature correlations with Target:")
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    correlations = []
    for col in numeric_cols:
        if col != target_col:
            corr = df[col].corr(df[target_col])
            if not pd.isna(corr):
                correlations.append((col, abs(corr)))
    
    correlations.sort(key=lambda x: x[1], reverse=True)
    for col, corr in correlations[:10]:
        print(f"   {col:25}: {corr:.3f}")
    
    # 7. Check if any feature has near-perfect correlation
    high_corr = [(col, corr) for col, corr in correlations if corr > 0.8]
    if high_corr:
        print("\n⚠️  Features with >0.8 correlation to Target:")
        for col, corr in high_corr:
            print(f"   {col}: {corr:.3f}")
            if col != 'Risk_Score':
                print(f"   This is suspicious - {col} might be leaking information")


def add_noise_to_prevent_overfitting(X, y, noise_level=0.01):
    """Add small Gaussian noise to features to prevent overfitting"""
    X_noisy = X.copy()
    for i in range(X_noisy.shape[1]):
        feature_std = np.std(X_noisy[:, i])
        noise = np.random.normal(0, noise_level * feature_std, X_noisy.shape[0])
        X_noisy[:, i] += noise
    return X_noisy, y


def calibrate_probabilities(model, X_val, y_val):
    """Simple probability calibration using validation set"""
    from sklearn.calibration import CalibratedClassifierCV
    calibrated = CalibratedClassifierCV(model, cv='prefit', method='sigmoid')
    calibrated.fit(X_val, y_val)
    return calibrated


def run_phase1():
    print("🚀 [Step 2] Starting Phase 1: Pretraining on Bangladesh Data...")
    print("="*60)
    
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)

    # 1. Load Selected Features
    with open(f"{ARTIFACTS_DIR}/selected_features.json", 'r') as f:
        selected_cols = json.load(f)
    print(f"✅ Using {len(selected_cols)} selected features:")
    print(f"   {selected_cols}")

    # 2. Load & Filter Data - REMOVE LEAKAGE COLUMNS IMMEDIATELY
    df = pd.read_csv(BD_DATA_PATH)
    print(f"✅ Loaded Bangladesh data: {df.shape}")
    
    # REMOVE ALL LEAKAGE COLUMNS BEFORE ANY PROCESSING
    leakage_cols = ['Risk_Score', 'IP_Number', 'Primary_Code', 'Diagnosis_Type',
                    'DOA', 'Discharge_Date', 'Residence_Area']
    
    for col in leakage_cols:
        if col in df.columns:
            print(f"⚠️  Removing leakage column: {col}")
            df = df.drop(columns=[col])
    
    print(f"✅ Data shape after removing leakage: {df.shape}")
    
    target_col = 'Target' if 'Target' in df.columns else df.columns[-1]
    
    # Run leakage checks
    check_data_leakage(df, target_col)
    
    # Preprocess Sex
    if 'Sex' in df.columns:
        df['Sex'] = df['Sex'].astype(str).apply(lambda x: 1 if x.lower().strip() in ['male', 'm'] else 0)
    
    X = df[selected_cols].values
    y = df[target_col].values
    
    print(f"\n📊 Class distribution:")
    print(f"   Infected (1): {np.sum(y == 1)} ({np.mean(y == 1)*100:.1f}%)")
    print(f"   Uninfected (0): {np.sum(y == 0)} ({np.mean(y == 0)*100:.1f}%)")

    # 3. Impute & Normalize
    print("\n🔄 Preprocessing data...")
    imputer = SimpleImputer(strategy='median')
    X_imputed = imputer.fit_transform(X)
    
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X_imputed)

    # Save Preprocessors
    joblib.dump(imputer, f"{ARTIFACTS_DIR}/tabular_imputer.pkl")
    joblib.dump(scaler, f"{ARTIFACTS_DIR}/tabular_scaler.pkl")
    print("✅ Saved imputer and scaler")

    # 4. Split (70/15/15)
    X_train, X_temp, y_train, y_temp = train_test_split(
        X_scaled, y, test_size=0.3, stratify=y, random_state=42
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, stratify=y_temp, random_state=42
    )
    
    print(f"\n📊 Data split:")
    print(f"   Train: {len(X_train)} samples")
    print(f"   Validation: {len(X_val)} samples")
    print(f"   Test: {len(X_test)} samples")

    # 5. Add small noise to training data to prevent overfitting
    print("\n🔄 Adding small noise to training data to prevent overfitting...")
    X_train_noisy, y_train_noisy = add_noise_to_prevent_overfitting(X_train, y_train, noise_level=0.02)
    
    # 6. SMOTE with careful balancing
    print("\n🔄 Applying SMOTE to training data...")
    smote = SMOTE(random_state=42, sampling_strategy='auto')
    X_train_res, y_train_res = smote.fit_resample(X_train_noisy, y_train_noisy)
    print(f"   Train set size after SMOTE: {len(X_train_res)}")
    print(f"   Class distribution after SMOTE: {np.bincount(y_train_res)}")

    # 7. Train Models with stronger regularization
    print("\n" + "="*60)
    print("🎯 Training Models with Regularization")
    print("="*60)
    
    models = {}
    calibrated_models = {}
    
    # Logistic Regression with stronger regularization
    print("\n🔹 Training Logistic Regression (C=0.1)...")
    lr = LogisticRegression(
        solver='lbfgs', 
        max_iter=1000, 
        class_weight='balanced',
        random_state=42,
        C=0.1  # Stronger regularization
    )
    lr.fit(X_train_res, y_train_res)
    models['LogisticRegression'] = lr
    
    # Random Forest with more regularization
    print("🔹 Training Random Forest (max_depth=5)...")
    rf = RandomForestClassifier(
        n_estimators=150,
        max_depth=5,  # Shallower trees
        min_samples_split=10,
        min_samples_leaf=5,
        max_features='sqrt',
        class_weight='balanced',
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train_res, y_train_res)
    models['RandomForest'] = rf
    
    # XGBoost with stronger regularization (NO early_stopping_rounds)
    print("🔹 Training XGBoost with regularization...")
    
    # Calculate scale_pos_weight for imbalance
    scale_pos_weight = (len(y_train_res) - sum(y_train_res)) / sum(y_train_res)
    
    xgb_clf = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=3,  # Shallower trees
        learning_rate=0.05,  # Lower learning rate
        subsample=0.7,
        colsample_bytree=0.7,
        reg_alpha=0.5,  # Stronger L1 regularization
        reg_lambda=2.0,  # Stronger L2 regularization
        min_child_weight=3,
        gamma=0.1,
        scale_pos_weight=scale_pos_weight,
        use_label_encoder=False,
        eval_metric='logloss',
        random_state=42
    )
    
    # Train WITHOUT early_stopping_rounds (compatibility fix)
    xgb_clf.fit(
        X_train_res, y_train_res,
        eval_set=[(X_val, y_val)],
        verbose=False
    )
    models['XGBoost'] = xgb_clf
    
    # Calibrate XGBoost probabilities
    print("\n🔄 Calibrating XGBoost probabilities...")
    xgb_calibrated = calibrate_probabilities(xgb_clf, X_val, y_val)
    calibrated_models['XGBoost'] = xgb_calibrated

    # 8. Evaluate on Validation and Test Sets
    print("\n" + "="*60)
    print("📊 Model Evaluation")
    print("="*60)
    
    results = {}
    for name, model in models.items():
        print(f"\n🔸 {name}")
        
        # Validation set predictions
        val_pred = model.predict(X_val)
        val_proba = model.predict_proba(X_val) if hasattr(model, 'predict_proba') else None
        
        print("   Validation Set:")
        val_metrics = analyze_predictions(y_val, val_pred, val_proba, "Validation")
        
        # Test set predictions
        test_pred = model.predict(X_test)
        test_proba = model.predict_proba(X_test) if hasattr(model, 'predict_proba') else None
        
        print("   Test Set:")
        test_metrics = analyze_predictions(y_test, test_pred, test_proba, "Test")
        
        results[name] = {
            'validation': val_metrics,
            'test': test_metrics
        }
        
        # Plot feature importance for this model
        plot_feature_importance(model, selected_cols, name, ARTIFACTS_DIR)
    
    # Evaluate calibrated XGBoost
    print(f"\n🔸 XGBoost (Calibrated)")
    cal_pred = xgb_calibrated.predict(X_test)
    cal_proba = xgb_calibrated.predict_proba(X_test)
    cal_metrics = analyze_predictions(y_test, cal_pred, cal_proba, "Test (Calibrated)")
    results['XGBoost_Calibrated'] = {
        'test': cal_metrics
    }

    # 9. Cross-validation scores
    print("\n" + "="*60)
    print("📊 5-Fold Cross-Validation (XGBoost)")
    print("="*60)
    
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(xgb_clf, X_scaled, y, cv=cv, scoring='f1')
    print(f"CV F1 Scores: {cv_scores}")
    print(f"Mean F1: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")

    # 10. Save Models
    print("\n" + "="*60)
    print("💾 Saving Models")
    print("="*60)
    
    joblib.dump(lr, f"{ARTIFACTS_DIR}/lr_phase1.pkl")
    joblib.dump(rf, f"{ARTIFACTS_DIR}/rf_phase1.pkl")
    xgb_clf.save_model(f"{ARTIFACTS_DIR}/xgb_phase1.json")
    joblib.dump(xgb_calibrated, f"{ARTIFACTS_DIR}/xgb_calibrated_phase1.pkl")
    print("✅ Saved all models to artifacts/")
    
    # Save preprocessing info for Phase 2
    preprocessing_info = {
        'selected_features': selected_cols,
        'imputer_path': f"{ARTIFACTS_DIR}/tabular_imputer.pkl",
        'scaler_path': f"{ARTIFACTS_DIR}/tabular_scaler.pkl",
        'bangladesh_model_path': f"{ARTIFACTS_DIR}/xgb_phase1.json",
        'calibrated_model_path': f"{ARTIFACTS_DIR}/xgb_calibrated_phase1.pkl"
    }
    
    with open(f"{ARTIFACTS_DIR}/phase1_preprocessing.json", 'w') as f:
        json.dump(preprocessing_info, f, indent=2)
    
    # 11. Save results summary
    summary = {
        'dataset': 'bangladesh',
        'n_samples': len(df),
        'class_distribution': {
            'infected': int(np.sum(y == 1)),
            'uninfected': int(np.sum(y == 0))
        },
        'selected_features': selected_cols,
        'results': results,
        'cv_scores': {
            'mean': float(cv_scores.mean()),
            'std': float(cv_scores.std()),
            'scores': cv_scores.tolist()
        }
    }
    
    with open(f"{ARTIFACTS_DIR}/phase1_summary.json", 'w') as f:
        json.dump(summary, f, indent=2)
    print("✅ Saved phase1_summary.json")
    
    # 12. Calculate percentage of infected with ≤2 symptoms
    infected_mask = y == 1
    symptom_sum = df[selected_cols].sum(axis=1)
    low_symptom_infected = np.sum((symptom_sum[infected_mask] <= 2))
    total_infected = np.sum(infected_mask)
    low_symptom_pct = (low_symptom_infected / total_infected * 100) if total_infected > 0 else 0
    
    # 13. Final Recommendations
    print("\n" + "="*60)
    print("📈 PHASE 1 COMPLETE - KEY INSIGHTS")
    print("="*60)
    print("✅ Bangladesh model trained with regularization to reduce overfitting")
    print("✅ Added noise and calibration to prevent 99% accuracy")
    print("✅ All artifacts saved for Phase 2 fine-tuning")
    print("\n📦 Artifacts generated:")
    print("   - tabular_imputer.pkl")
    print("   - tabular_scaler.pkl")
    print("   - xgb_phase1.json (XGBoost model)")
    print("   - xgb_calibrated_phase1.pkl (Calibrated model)")
    print("   - lr_phase1.pkl")
    print("   - rf_phase1.pkl")
    print("   - phase1_preprocessing.json")
    print("   - phase1_summary.json")
    print(f"\n⚠️  Note for Phase 2 (Sierra Leone):")
    print(f"   - Use xgb_phase1.json as starting point")
    print(f"   - But expect to retrain significantly due to different patterns")
    print(f"   - Bangladesh has {low_symptom_pct:.1f}% infected with ≤2 symptoms")
    print(f"   - Sierra Leone has ~8.6% infected with ≤2 symptoms")


if __name__ == "__main__":
    run_phase1()

