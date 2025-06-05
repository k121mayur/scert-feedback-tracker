-- Create a complete test teacher profile with all required parameters
-- Using authentic Mumbai district data structure

INSERT INTO teachers (
  teacher_id,
  teacher_name,
  mobile,
  pay_id,
  district,
  service_type,
  training_group
) VALUES (
  'TEST001',
  'Priya Sharma',
  '9876543100',
  'PAY12345',
  'Mumbai',
  'Primary Teacher',
  'Group A'
);

-- Verify the teacher was created
SELECT * FROM teachers WHERE mobile = '9876543100';