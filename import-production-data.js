import { readFileSync } from 'fs';
import { db } from './server/db.js';

async function importProductionData() {
  console.log('Starting production data import...');
  
  // Read CSV file
  const csvContent = readFileSync('./attached_assets/batch_teachers_1749097105409.csv', 'utf8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  
  console.log('Headers:', headers);
  
  const teachersToInsert = [];
  const batchesToInsert = [];
  const batchTeachersToInsert = [];
  const uniqueBatches = new Set();
  
  let processed = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',');
    if (values.length < 7) continue;
    
    const [district, batchName, serviceType, trainingGroup, teacherId, teacherName, phoneNumber] = values;
    
    // Clean and validate phone number
    if (!phoneNumber || phoneNumber === 'null' || phoneNumber.length < 10) continue;
    const mobile = phoneNumber.replace(/\D/g, '').substring(0, 10);
    if (mobile.length !== 10) continue;
    
    // Add unique batch
    if (!uniqueBatches.has(batchName)) {
      batchesToInsert.push({
        batchName: batchName,
        district: district,
        coordinatorName: 'Production Import',
        serviceType: serviceType || 'Primary',
        trainingGroup: trainingGroup || 'Primary'
      });
      uniqueBatches.add(batchName);
    }
    
    // Add teacher
    teachersToInsert.push({
      teacherId: teacherId === 'null' ? null : teacherId,
      teacherName: teacherName,
      mobile: mobile,
      district: district,
      serviceType: serviceType || 'Primary',
      trainingGroup: trainingGroup || 'Primary'
    });
    
    // Add batch-teacher relationship
    batchTeachersToInsert.push({
      batchName: batchName,
      teacherMobile: mobile,
      teacherName: teacherName,
      district: district
    });
    
    processed++;
    
    if (processed % 5000 === 0) {
      console.log(`Processed ${processed} records...`);
    }
  }
  
  console.log(`Total records processed: ${processed}`);
  console.log(`Unique batches: ${batchesToInsert.length}`);
  console.log(`Teachers to insert: ${teachersToInsert.length}`);
  
  // Insert batches first
  console.log('Inserting batches...');
  for (let i = 0; i < batchesToInsert.length; i += 100) {
    const batch = batchesToInsert.slice(i, i + 100);
    await db.execute(`
      INSERT INTO batches (batch_name, district, coordinator_name, service_type, training_group)
      VALUES ${batch.map(() => '(?, ?, ?, ?, ?)').join(', ')}
      ON CONFLICT (batch_name) DO NOTHING
    `, batch.flatMap(b => [b.batchName, b.district, b.coordinatorName, b.serviceType, b.trainingGroup]));
  }
  
  // Insert teachers
  console.log('Inserting teachers...');
  for (let i = 0; i < teachersToInsert.length; i += 1000) {
    const batch = teachersToInsert.slice(i, i + 1000);
    await db.execute(`
      INSERT INTO teachers (teacher_id, teacher_name, mobile, district, service_type, training_group)
      VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}
      ON CONFLICT (mobile) DO NOTHING
    `, batch.flatMap(t => [t.teacherId, t.teacherName, t.mobile, t.district, t.serviceType, t.trainingGroup]));
    
    if ((i + 1000) % 5000 === 0) {
      console.log(`Inserted ${i + 1000} teachers...`);
    }
  }
  
  // Insert batch-teacher relationships
  console.log('Inserting batch-teacher relationships...');
  for (let i = 0; i < batchTeachersToInsert.length; i += 1000) {
    const batch = batchTeachersToInsert.slice(i, i + 1000);
    await db.execute(`
      INSERT INTO batch_teachers (batch_name, teacher_mobile, teacher_name, district)
      VALUES ${batch.map(() => '(?, ?, ?, ?)').join(', ')}
      ON CONFLICT (batch_name, teacher_mobile) DO NOTHING
    `, batch.flatMap(bt => [bt.batchName, bt.teacherMobile, bt.teacherName, bt.district]));
    
    if ((i + 1000) % 5000 === 0) {
      console.log(`Inserted ${i + 1000} batch-teacher relationships...`);
    }
  }
  
  // Verify import
  const teacherCount = await db.execute(`SELECT COUNT(*) as count FROM teachers`);
  const districtCount = await db.execute(`SELECT COUNT(DISTINCT district) as count FROM teachers`);
  const batchCount = await db.execute(`SELECT COUNT(*) as count FROM batches`);
  
  console.log(`\nImport completed successfully!`);
  console.log(`Total teachers: ${teacherCount.rows[0].count}`);
  console.log(`Total districts: ${districtCount.rows[0].count}`);
  console.log(`Total batches: ${batchCount.rows[0].count}`);
}

importProductionData().catch(console.error);