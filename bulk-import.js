const { readFileSync } = require('fs');
const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function bulkImport() {
  console.log('Starting bulk import of production data...');
  
  const csvContent = readFileSync('./attached_assets/batch_teachers_1749097105409.csv', 'utf8');
  const lines = csvContent.trim().split('\n');
  
  // Skip header row
  const dataRows = lines.slice(1).filter(line => line.trim().length > 0);
  console.log(`Processing ${dataRows.length} teacher records...`);
  
  const batchData = new Map();
  const teacherData = [];
  const batchTeacherData = [];
  
  let validRecords = 0;
  
  for (const line of dataRows) {
    const parts = line.split(',');
    if (parts.length < 7) continue;
    
    const [district, batchName, serviceType, trainingGroup, teacherId, teacherName, phoneNumber] = parts;
    
    // Validate phone number
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10 || phoneNumber === 'null') continue;
    
    const mobile = cleanPhone.substring(0, 10);
    
    // Store unique batches
    if (!batchData.has(batchName)) {
      batchData.set(batchName, {
        batchName,
        district,
        coordinatorName: 'Production Import',
        serviceType: serviceType || 'Primary',
        trainingGroup: trainingGroup || 'Primary'
      });
    }
    
    // Store teachers
    teacherData.push({
      teacherId: teacherId === 'null' ? null : teacherId,
      teacherName,
      mobile,
      district,
      serviceType: serviceType || 'Primary',
      trainingGroup: trainingGroup || 'Primary'
    });
    
    // Store batch-teacher relationships
    batchTeacherData.push({
      batchName,
      teacherMobile: mobile,
      teacherName,
      district
    });
    
    validRecords++;
  }
  
  console.log(`Valid records: ${validRecords}`);
  console.log(`Unique batches: ${batchData.size}`);
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert batches
    console.log('Inserting batches...');
    const batchValues = Array.from(batchData.values());
    for (let i = 0; i < batchValues.length; i += 100) {
      const chunk = batchValues.slice(i, i + 100);
      const placeholders = chunk.map((_, idx) => `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5})`).join(',');
      const values = chunk.flatMap(b => [b.batchName, b.district, b.coordinatorName, b.serviceType, b.trainingGroup]);
      
      await client.query(`
        INSERT INTO batches (batch_name, district, coordinator_name, service_type, training_group)
        VALUES ${placeholders}
        ON CONFLICT (batch_name) DO NOTHING
      `, values);
    }
    
    // Insert teachers
    console.log('Inserting teachers...');
    for (let i = 0; i < teacherData.length; i += 1000) {
      const chunk = teacherData.slice(i, i + 1000);
      const placeholders = chunk.map((_, idx) => `($${idx * 6 + 1}, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${idx * 6 + 5}, $${idx * 6 + 6})`).join(',');
      const values = chunk.flatMap(t => [t.teacherId, t.teacherName, t.mobile, t.district, t.serviceType, t.trainingGroup]);
      
      await client.query(`
        INSERT INTO teachers (teacher_id, teacher_name, mobile, district, service_type, training_group)
        VALUES ${placeholders}
        ON CONFLICT (mobile) DO NOTHING
      `, values);
      
      if ((i + 1000) % 5000 === 0) {
        console.log(`Inserted ${i + 1000} teachers...`);
      }
    }
    
    // Insert batch-teacher relationships
    console.log('Inserting batch-teacher relationships...');
    for (let i = 0; i < batchTeacherData.length; i += 1000) {
      const chunk = batchTeacherData.slice(i, i + 1000);
      const placeholders = chunk.map((_, idx) => `($${idx * 4 + 1}, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4})`).join(',');
      const values = chunk.flatMap(bt => [bt.batchName, bt.teacherMobile, bt.teacherName, bt.district]);
      
      await client.query(`
        INSERT INTO batch_teachers (batch_name, teacher_mobile, teacher_name, district)
        VALUES ${placeholders}
        ON CONFLICT (batch_name, teacher_mobile) DO NOTHING
      `, values);
      
      if ((i + 1000) % 5000 === 0) {
        console.log(`Inserted ${i + 1000} batch relationships...`);
      }
    }
    
    await client.query('COMMIT');
    
    // Verify results
    const teacherCount = await client.query('SELECT COUNT(*) FROM teachers');
    const districtCount = await client.query('SELECT COUNT(DISTINCT district) FROM teachers');
    const batchCount = await client.query('SELECT COUNT(*) FROM batches');
    
    console.log('\nImport completed successfully!');
    console.log(`Total teachers: ${teacherCount.rows[0].count}`);
    console.log(`Total districts: ${districtCount.rows[0].count}`);
    console.log(`Total batches: ${batchCount.rows[0].count}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import failed:', error);
  } finally {
    client.release();
  }
}

bulkImport().catch(console.error);