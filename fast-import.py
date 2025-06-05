#!/usr/bin/env python3
import csv
import psycopg2
import os
import re

def import_data():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cursor = conn.cursor()
    
    try:
        print("Starting fast import...")
        
        # Read and process CSV in chunks
        batch_size = 1000
        teacher_batch = []
        batch_batch = []
        batch_teacher_batch = []
        
        unique_batches = set()
        
        with open('./attached_assets/batch_teachers_1749097105409.csv', 'r', encoding='utf-8') as file:
            reader = csv.reader(file)
            next(reader)  # Skip header
            
            count = 0
            for row in reader:
                if len(row) < 7:
                    continue
                    
                district, batch_name, service_type, training_group, teacher_id, teacher_name, phone_number = row
                
                # Clean phone number
                mobile = re.sub(r'[^0-9]', '', phone_number)
                if len(mobile) < 10 or phone_number == 'null':
                    continue
                mobile = mobile[:10]
                
                # Handle teacher_id
                clean_teacher_id = None if teacher_id == 'null' or not teacher_id else teacher_id
                
                # Add unique batch
                if batch_name and batch_name != 'null' and batch_name not in unique_batches:
                    unique_batches.add(batch_name)
                    batch_batch.append((
                        batch_name,
                        district,
                        'Production Import',
                        service_type or 'Primary',
                        training_group or 'Primary'
                    ))
                
                # Add teacher
                teacher_batch.append((
                    clean_teacher_id,
                    teacher_name,
                    mobile,
                    district,
                    service_type or 'Primary',
                    training_group or 'Primary'
                ))
                
                # Add batch-teacher relationship
                if batch_name and batch_name != 'null':
                    batch_teacher_batch.append((
                        batch_name,
                        mobile,
                        teacher_name,
                        district
                    ))
                
                count += 1
                
                # Insert in batches
                if len(teacher_batch) >= batch_size:
                    try:
                        cursor.executemany("""
                            INSERT INTO teachers (teacher_id, teacher_name, mobile, district, service_type, training_group)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            ON CONFLICT (mobile) DO NOTHING
                        """, teacher_batch)
                        conn.commit()
                        teacher_batch = []
                        print(f"Inserted batch at record {count}")
                    except Exception as e:
                        print(f"Error inserting teachers: {e}")
                        conn.rollback()
                        teacher_batch = []
                
                if len(batch_batch) >= 50:
                    try:
                        cursor.executemany("""
                            INSERT INTO batches (batch_name, district, coordinator_name, service_type, training_group)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (batch_name) DO NOTHING
                        """, batch_batch)
                        conn.commit()
                        batch_batch = []
                    except Exception as e:
                        print(f"Error inserting batches: {e}")
                        conn.rollback()
                        batch_batch = []
                
                if len(batch_teacher_batch) >= batch_size:
                    try:
                        cursor.executemany("""
                            INSERT INTO batch_teachers (batch_name, teacher_mobile, teacher_name, district)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (batch_name, teacher_mobile) DO NOTHING
                        """, batch_teacher_batch)
                        conn.commit()
                        batch_teacher_batch = []
                    except Exception as e:
                        print(f"Error inserting batch_teachers: {e}")
                        conn.rollback()
                        batch_teacher_batch = []
        
        # Insert remaining records
        if teacher_batch:
            cursor.executemany("""
                INSERT INTO teachers (teacher_id, teacher_name, mobile, district, service_type, training_group)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (mobile) DO NOTHING
            """, teacher_batch)
        
        if batch_batch:
            cursor.executemany("""
                INSERT INTO batches (batch_name, district, coordinator_name, service_type, training_group)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (batch_name) DO NOTHING
            """, batch_batch)
        
        if batch_teacher_batch:
            cursor.executemany("""
                INSERT INTO batch_teachers (batch_name, teacher_mobile, teacher_name, district)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (batch_name, teacher_mobile) DO NOTHING
            """, batch_teacher_batch)
        
        conn.commit()
        
        # Verify results
        cursor.execute("SELECT COUNT(*) FROM teachers")
        teacher_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT district) FROM teachers")
        district_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM batches")
        batch_count = cursor.fetchone()[0]
        
        print(f"\nImport completed!")
        print(f"Total teachers: {teacher_count}")
        print(f"Total districts: {district_count}")
        print(f"Total batches: {batch_count}")
        
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    import_data()