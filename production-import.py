#!/usr/bin/env python3
import csv
import psycopg2
import os
import sys
from typing import List, Tuple

def clean_phone_number(phone: str) -> str:
    """Clean phone number to extract 10 digits"""
    if not phone or phone == 'null':
        return None
    
    # Remove all non-digit characters
    digits = ''.join(filter(str.isdigit, phone))
    
    # Return first 10 digits if available
    if len(digits) >= 10:
        return digits[:10]
    return None

def escape_sql_string(value: str) -> str:
    """Escape SQL string to prevent injection"""
    if not value:
        return ''
    return value.replace("'", "''").replace('\\', '\\\\')

def import_production_data():
    """Import the complete production dataset"""
    print("Starting production data import...")
    
    # Database connection
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cursor = conn.cursor()
    
    try:
        # Read CSV file
        csv_file = './attached_assets/batch_teachers_1749097105409.csv'
        
        batch_data = {}
        teacher_records = []
        batch_teacher_records = []
        
        print("Processing CSV file...")
        
        with open(csv_file, 'r', encoding='utf-8') as file:
            reader = csv.reader(file)
            header = next(reader)  # Skip header
            
            for row_num, row in enumerate(reader, start=2):
                if len(row) < 7:
                    continue
                    
                district, batch_name, service_type, training_group, teacher_id, teacher_name, phone_number = row
                
                # Clean phone number
                mobile = clean_phone_number(phone_number)
                if not mobile:
                    continue
                
                # Handle teacher_id
                clean_teacher_id = None if teacher_id == 'null' or not teacher_id else teacher_id
                
                # Store unique batches
                if batch_name and batch_name != 'null' and batch_name not in batch_data:
                    batch_data[batch_name] = {
                        'district': district,
                        'service_type': service_type or 'Primary',
                        'training_group': training_group or 'Primary'
                    }
                
                # Store teacher record
                teacher_records.append((
                    clean_teacher_id,
                    teacher_name,
                    mobile,
                    district,
                    service_type or 'Primary',
                    training_group or 'Primary'
                ))
                
                # Store batch-teacher relationship
                if batch_name and batch_name != 'null':
                    batch_teacher_records.append((
                        batch_name,
                        mobile,
                        teacher_name,
                        district
                    ))
                
                if row_num % 5000 == 0:
                    print(f"Processed {row_num-1} rows...")
        
        print(f"Total valid records: {len(teacher_records)}")
        print(f"Unique batches: {len(batch_data)}")
        
        # Insert batches
        print("Inserting batches...")
        batch_values = []
        for batch_name, data in batch_data.items():
            batch_values.append((
                batch_name,
                data['district'],
                'Production Import',
                data['service_type'],
                data['training_group']
            ))
        
        if batch_values:
            cursor.executemany("""
                INSERT INTO batches (batch_name, district, coordinator_name, service_type, training_group)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (batch_name) DO NOTHING
            """, batch_values)
        
        print(f"Inserted {len(batch_values)} batches")
        
        # Insert teachers in batches
        print("Inserting teachers...")
        batch_size = 1000
        for i in range(0, len(teacher_records), batch_size):
            batch = teacher_records[i:i+batch_size]
            cursor.executemany("""
                INSERT INTO teachers (teacher_id, teacher_name, mobile, district, service_type, training_group)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (mobile) DO NOTHING
            """, batch)
            
            if (i + batch_size) % 5000 == 0:
                print(f"Inserted {i + batch_size} teachers...")
        
        print(f"Inserted {len(teacher_records)} teachers")
        
        # Insert batch-teacher relationships
        print("Inserting batch-teacher relationships...")
        for i in range(0, len(batch_teacher_records), batch_size):
            batch = batch_teacher_records[i:i+batch_size]
            cursor.executemany("""
                INSERT INTO batch_teachers (batch_name, teacher_mobile, teacher_name, district)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (batch_name, teacher_mobile) DO NOTHING
            """, batch)
            
            if (i + batch_size) % 5000 == 0:
                print(f"Inserted {i + batch_size} relationships...")
        
        print(f"Inserted {len(batch_teacher_records)} batch-teacher relationships")
        
        # Commit transaction
        conn.commit()
        
        # Verify results
        cursor.execute("SELECT COUNT(*) FROM teachers")
        teacher_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT district) FROM teachers")
        district_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM batches")
        batch_count = cursor.fetchone()[0]
        
        print("\nImport completed successfully!")
        print(f"Total teachers: {teacher_count}")
        print(f"Total districts: {district_count}")
        print(f"Total batches: {batch_count}")
        
    except Exception as e:
        print(f"Error during import: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    import_production_data()