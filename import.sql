-- Import authentic teacher data from CSV
CREATE TEMP TABLE temp_teachers (
    district TEXT,
    batch_name TEXT,
    service_type TEXT,
    training_group TEXT,
    teacher_id TEXT,
    teacher_name TEXT,
    phone_number TEXT
);

-- Copy data from CSV file
COPY temp_teachers FROM '/home/runner/workspace/attached_assets/batch_teachers_1749097105409.csv' 
WITH (FORMAT csv, HEADER true, DELIMITER ',');

-- Insert batches (unique batch names only)
INSERT INTO batches (batch_name, district, coordinator_name, service_type, training_group)
SELECT DISTINCT 
    batch_name,
    district,
    'Production Import' as coordinator_name,
    COALESCE(service_type, 'Primary') as service_type,
    COALESCE(training_group, 'Primary') as training_group
FROM temp_teachers
WHERE batch_name IS NOT NULL AND batch_name != 'null'
ON CONFLICT (batch_name) DO NOTHING;

-- Insert teachers (clean phone numbers and filter valid ones)
INSERT INTO teachers (teacher_id, teacher_name, mobile, district, service_type, training_group)
SELECT DISTINCT
    CASE WHEN teacher_id = 'null' OR teacher_id = '' THEN NULL ELSE teacher_id END as teacher_id,
    teacher_name,
    SUBSTRING(REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g'), 1, 10) as mobile,
    district,
    COALESCE(service_type, 'Primary') as service_type,
    COALESCE(training_group, 'Primary') as training_group
FROM temp_teachers
WHERE phone_number IS NOT NULL 
    AND phone_number != 'null' 
    AND phone_number != ''
    AND LENGTH(REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g')) >= 10
    AND teacher_name IS NOT NULL
    AND teacher_name != ''
ON CONFLICT (mobile) DO NOTHING;

-- Insert batch-teacher relationships
INSERT INTO batch_teachers (batch_name, teacher_mobile, teacher_name, district)
SELECT DISTINCT
    t.batch_name,
    SUBSTRING(REGEXP_REPLACE(t.phone_number, '[^0-9]', '', 'g'), 1, 10) as teacher_mobile,
    t.teacher_name,
    t.district
FROM temp_teachers t
WHERE t.phone_number IS NOT NULL 
    AND t.phone_number != 'null' 
    AND t.phone_number != ''
    AND LENGTH(REGEXP_REPLACE(t.phone_number, '[^0-9]', '', 'g')) >= 10
    AND t.teacher_name IS NOT NULL
    AND t.teacher_name != ''
    AND t.batch_name IS NOT NULL
    AND t.batch_name != 'null'
ON CONFLICT (batch_name, teacher_mobile) DO NOTHING;

-- Show import results
SELECT 'Teachers imported:' as result, COUNT(*) as count FROM teachers
UNION ALL
SELECT 'Districts count:' as result, COUNT(DISTINCT district) as count FROM teachers
UNION ALL
SELECT 'Batches imported:' as result, COUNT(*) as count FROM batches;

DROP TABLE temp_teachers;