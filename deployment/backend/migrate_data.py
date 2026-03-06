"""
Fixed migration script - handles JSON data properly
"""

import sqlite3
import json
from sqlalchemy import create_engine, text
from datetime import datetime

# Database connections
SQLITE_PATH = "malaria.db"
POSTGRES_URL = "postgresql://malaria_user:1111@localhost:5432/malaria_db"

def safe_json_parse(value):
    """Safely parse JSON data"""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return json.dumps(value)
    if isinstance(value, str):
        try:
            # Try to parse and re-stringify to ensure valid JSON
            parsed = json.loads(value)
            return json.dumps(parsed)
        except:
            # If it's not valid JSON, return as string
            return json.dumps({"value": value})
    return json.dumps(str(value))

def migrate_data():
    print("=" * 50)
    print("🚀 Starting data migration from SQLite to PostgreSQL")
    print("=" * 50)
    
    # Connect to SQLite
    print("\n📦 Connecting to SQLite...")
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    print("✅ SQLite connected")
    
    # Connect to PostgreSQL
    print("\n🐘 Connecting to PostgreSQL...")
    pg_engine = create_engine(POSTGRES_URL)
    
    try:
        # Get all predictions from SQLite
        cursor = sqlite_conn.execute("SELECT * FROM predictions ORDER BY id")
        rows = cursor.fetchall()
        
        print(f"📊 Found {len(rows)} records to migrate")
        
        if len(rows) == 0:
            print("⚠️ No records to migrate")
            return
        
        # Get column names
        columns = [description[0] for description in cursor.description]
        print(f"📋 Columns: {', '.join(columns)}")
        
        # Migrate each row
        with pg_engine.connect() as pg_conn:
            success_count = 0
            error_count = 0
            
            for row in rows:
                try:
                    # Convert row to dict
                    data = dict(zip(columns, row))
                    
                    # Handle JSON fields properly
                    json_fields = ['clinical_data_snapshot', 'explanation_json', 
                                  'shap_values', 'lime_values', 'gradcam_metadata']
                    
                    for field in json_fields:
                        if field in data:
                            data[field] = safe_json_parse(data[field])
                    
                    # Build INSERT statement with proper JSON handling
                    insert_sql = f"""
                        INSERT INTO predictions (
                            id, timestamp, model_version, mode, age, sex,
                            clinical_data_snapshot, filename, prediction,
                            confidence_score, risk_level, clinical_score,
                            image_score, explanation_json, shap_values,
                            lime_values, gradcam_metadata, heatmap_path,
                            computation_time, inference_success, error_message
                        ) VALUES (
                            :id, :timestamp, :model_version, :mode, :age, :sex,
                            CAST(:clinical_data_snapshot AS JSONB), :filename, :prediction,
                            :confidence_score, :risk_level, :clinical_score,
                            :image_score, CAST(:explanation_json AS JSONB),
                            CAST(:shap_values AS JSONB), CAST(:lime_values AS JSONB),
                            CAST(:gradcam_metadata AS JSONB), :heatmap_path,
                            :computation_time, :inference_success, :error_message
                        )
                    """
                    
                    # Execute insert
                    pg_conn.execute(text(insert_sql), data)
                    success_count += 1
                    
                    if success_count % 10 == 0:
                        print(f"  ✅ Migrated {success_count} records...")
                        
                except Exception as e:
                    error_count += 1
                    print(f"\n  ❌ Error migrating record {data.get('id', 'unknown')}:")
                    print(f"     {str(e)[:200]}...")
                    
                    # Print the problematic field for debugging
                    if 'explanation_json' in data:
                        print(f"     explanation_json preview: {str(data['explanation_json'])[:100]}...")
            
            # Commit all changes
            pg_conn.commit()
            
            print("\n" + "=" * 50)
            print("📊 Migration Summary:")
            print(f"  ✅ Successfully migrated: {success_count} records")
            print(f"  ❌ Failed: {error_count} records")
            
            # Verify migration
            result = pg_conn.execute(text("SELECT COUNT(*) FROM predictions"))
            pg_count = result.scalar()
            print(f"  📊 Total records in PostgreSQL: {pg_count}")
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        sqlite_conn.close()
        print("\n🔒 Connections closed")

def verify_sample():
    """Verify a sample of migrated data"""
    print("\n" + "=" * 50)
    print("🔍 Verifying sample data...")
    
    pg_engine = create_engine(POSTGRES_URL)
    
    with pg_engine.connect() as conn:
        # Get latest 5 records
        result = conn.execute(text("""
            SELECT id, mode, prediction, confidence_score, 
                   LEFT(explanation_json::text, 100) as explanation_preview
            FROM predictions 
            ORDER BY id DESC 
            LIMIT 5
        """))
        
        rows = result.fetchall()
        
        print("\n📋 Latest 5 records in PostgreSQL:")
        print("-" * 80)
        for row in rows:
            print(f"  ID: {row[0]} | Mode: {row[1]} | Prediction: {row[2]} | Confidence: {row[3]}")
        print("-" * 80)

if __name__ == "__main__":
    # First, clear any existing data (optional)
    print("Do you want to clear existing PostgreSQL data? (yes/no): ")
    choice = input().lower()
    
    if choice == 'yes':
        pg_engine = create_engine(POSTGRES_URL)
        with pg_engine.connect() as conn:
            conn.execute(text("TRUNCATE TABLE predictions RESTART IDENTITY CASCADE"))
            conn.commit()
        print("✅ Existing data cleared")
    
    migrate_data()
    verify_sample()