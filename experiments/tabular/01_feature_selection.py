import pandas as pd
import numpy as np
import json
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_selection import mutual_info_classif, SelectKBest, f_classif
from sklearn.impute import SimpleImputer
import os

# CONFIG
DATA_PATH = "../../data/tabular/bangladesh/Malaria_Dataset.csv"
ARTIFACTS_DIR = "artifacts"
TOP_N_FEATURES = 13  # All symptoms + Age + Sex = 13

def analyze_dataset(df, target_col):
    """Analyze dataset characteristics"""
    print("\n" + "="*60)
    print("📊 BANGLADESH DATASET ANALYSIS")
    print("="*60)
    
    infected = df[df[target_col] == 1]
    uninfected = df[df[target_col] == 0]
    
    print(f"Total samples: {len(df)}")
    print(f"Infected: {len(infected)} ({len(infected)/len(df)*100:.1f}%)")
    print(f"Uninfected: {len(uninfected)} ({len(uninfected)/len(df)*100:.1f}%)")
    
    # Symptom columns
    symptom_cols = ['Fever', 'Headache', 'Abdominal_Pain', 'General_Body_Malaise',
                    'Dizziness', 'Vomiting', 'Confusion', 'Backache',
                    'Chest_Pain', 'Coughing', 'Joint_Pain']
    
    print("\n🔴 Symptom prevalence in INFECTED patients:")
    infected_symptoms = []
    for symptom in symptom_cols:
        if symptom in df.columns:
            pct = infected[symptom].mean() * 100
            print(f"  {symptom:25}: {pct:6.2f}%")
            infected_symptoms.append(pct)
    
    print("\n🟢 Symptom prevalence in UNINFECTED patients:")
    uninfected_symptoms = []
    for symptom in symptom_cols:
        if symptom in df.columns:
            pct = uninfected[symptom].mean() * 100
            print(f"  {symptom:25}: {pct:6.2f}%")
            uninfected_symptoms.append(pct)
    
    # Calculate average symptoms
    infected_avg = infected[symptom_cols].sum(axis=1).mean()
    uninfected_avg = uninfected[symptom_cols].sum(axis=1).mean()
    
    print(f"\n📈 Average symptoms in Infected: {infected_avg:.2f}")
    print(f"📉 Average symptoms in Uninfected: {uninfected_avg:.2f}")
    
    return infected_avg, uninfected_avg

def select_features():
    print("🔍 [Step 1] Starting Feature Selection for Bangladesh Data...")
    
    # Create artifacts directory
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    
    # 1. Load Data
    df = pd.read_csv(DATA_PATH)
    print(f"\n✅ Loaded data: {df.shape}")
    
    # 2. Explicitly remove leakage columns FIRST
    leakage_cols = ['Risk_Score', 'IP_Number', 'Primary_Code', 'Diagnosis_Type',
                    'DOA', 'Discharge_Date', 'Residence_Area']
    
    for col in leakage_cols:
        if col in df.columns:
            print(f"⚠️  Removing leakage column: {col}")
            df = df.drop(columns=[col])
    
    # Basic Clean
    if 'Sex' in df.columns:
        df['Sex'] = df['Sex'].astype(str).apply(lambda x: 1 if x.lower().strip() in ['male', 'm'] else 0)
    
    target_col = 'Target' if 'Target' in df.columns else df.columns[-1]
    
    # Analyze dataset after removing leakage
    analyze_dataset(df, target_col)
    
    # Separate features and target
    X_raw = df.drop(columns=[target_col])
    y = df[target_col].values
    
    # Select only numeric columns
    X_numeric = X_raw.select_dtypes(include=[np.number])
    dropped_cols = list(set(X_raw.columns) - set(X_numeric.columns))
    if dropped_cols:
        print(f"\n⚠️ Dropped non-numeric columns: {dropped_cols}")
        
    X = X_numeric.values
    feature_names = X_numeric.columns.tolist()
    
    print(f"\n📋 Features available for selection: {len(feature_names)}")
    print(f"Features: {feature_names}")

    # 3. Impute missing values
    imputer = SimpleImputer(strategy='median')
    X = imputer.fit_transform(X)
    
    # Save imputer for later use
    import joblib
    joblib.dump(imputer, f"{ARTIFACTS_DIR}/tabular_imputer.pkl")
    print("✅ Saved imputer")

    # 4. Calculate Multiple Feature Importance Methods
    print("\n🔍 Calculating feature importance...")
    
    # Method 1: Mutual Information
    print("   -> Mutual Information (MI)...")
    mi_scores = mutual_info_classif(X, y, discrete_features='auto', random_state=42)
    
    # Method 2: Random Forest
    print("   -> Random Forest Importance...")
    rf = RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced')
    rf.fit(X, y)
    rf_scores = rf.feature_importances_
    
    # Method 3: ANOVA F-value
    print("   -> ANOVA F-value...")
    f_scores, _ = f_classif(X, y)
    
    # Method 4: Correlation with target
    print("   -> Correlation with target...")
    corr_scores = []
    for i, feature in enumerate(feature_names):
        if feature in df.columns:
            corr = abs(df[feature].corr(pd.Series(y)))
            corr_scores.append(corr if not pd.isna(corr) else 0)
        else:
            corr_scores.append(0)
    corr_scores = np.array(corr_scores)

    # 5. Normalize and Combine Scores
    def normalize(scores):
        if scores.max() > scores.min():
            return (scores - scores.min()) / (scores.max() - scores.min())
        return scores
    
    mi_norm = normalize(mi_scores)
    rf_norm = normalize(rf_scores)
    f_norm = normalize(f_scores)
    corr_norm = normalize(corr_scores)
    
    # Weighted combination
    hybrid_score = (mi_norm * 0.35 + rf_norm * 0.35 + f_norm * 0.15 + corr_norm * 0.15)
    
    # Create feature dataframe
    feature_df = pd.DataFrame({
        'Feature': feature_names,
        'MI_Score': mi_scores,
        'RF_Score': rf_scores,
        'F_Score': f_scores,
        'Correlation': corr_scores,
        'Hybrid_Score': hybrid_score
    }).sort_values(by='Hybrid_Score', ascending=False)

    # 6. Display top features
    print("\n" + "="*60)
    print("📊 TOP FEATURES RANKING")
    print("="*60)
    for idx, row in feature_df.head(TOP_N_FEATURES).iterrows():
        print(f"{idx+1:2d}. {row['Feature']:25} Score: {row['Hybrid_Score']:.4f}")

    # 7. Select top features
    selected_features = feature_df.head(TOP_N_FEATURES)['Feature'].tolist()
    
    # Ensure critical features are included
    critical_features = ['Age', 'Sex', 'Fever', 'Headache', 'General_Body_Malaise']
    for feat in critical_features:
        if feat not in selected_features and feat in feature_names:
            print(f"\n⚠️ Adding critical feature: {feat}")
            selected_features.append(feat)
    
    # Remove duplicates and keep order
    selected_features = list(dict.fromkeys(selected_features))
    
    print(f"\n✅ Final selected {len(selected_features)} features:")
    print(selected_features)
    
    # Save selected features
    save_path = f"{ARTIFACTS_DIR}/selected_features.json"
    with open(save_path, 'w') as f:
        json.dump(selected_features, f)
    print(f"✅ Saved features to {save_path}")

    # 8. Visualization
    fig, axes = plt.subplots(2, 1, figsize=(12, 12))
    
    # Top features bar plot
    top_features = feature_df.head(TOP_N_FEATURES)
    sns.barplot(x='Hybrid_Score', y='Feature', data=top_features, ax=axes[0], palette='viridis')
    axes[0].set_title(f"Top {TOP_N_FEATURES} Features by Hybrid Score", fontsize=14)
    axes[0].set_xlabel("Importance Score")
    
    # Feature importance comparison
    plot_df = feature_df.head(TOP_N_FEATURES).melt(id_vars=['Feature'], 
                                                    value_vars=['MI_Score', 'RF_Score'],
                                                    var_name='Method', value_name='Score')
    sns.barplot(x='Score', y='Feature', hue='Method', data=plot_df, ax=axes[1])
    axes[1].set_title("Feature Importance: MI vs Random Forest", fontsize=14)
    axes[1].set_xlabel("Importance Score")
    
    plt.tight_layout()
    plt.savefig(f"{ARTIFACTS_DIR}/feature_importance_analysis.png", dpi=150, bbox_inches='tight')
    print(f"✅ Saved feature importance plot")


if __name__ == "__main__":
    select_features()