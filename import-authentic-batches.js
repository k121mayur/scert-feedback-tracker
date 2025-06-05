import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function importAuthenticBatches() {
  try {
    const csvData = fs.readFileSync('attached_assets/batch_teachers_1749097105409.csv', 'utf8');
    const lines = csvData.split('\n').slice(1); // Skip header
    
    const batchMap = new Map();
    const teacherData = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [district, batchName, serviceType, trainingGroup, teacherId, teacherName, phoneNumber] = 
        line.split(',').map(field => field.replace(/"/g, '').trim());
      
      if (batchName && district) {
        // Create batch entry
        batchMap.set(batchName, {
          batchName,
          district,
          serviceType: serviceType || 'Teacher Training',
          trainingGroup: trainingGroup || 'General'
        });
        
        // Create teacher entry
        if (teacherName && phoneNumber) {
          teacherData.push({
            batchName,
            teacherId: teacherId || null,
            teacherName,
            teacherMobile: phoneNumber,
            district,
            serviceType: serviceType || 'Teacher Training',
            trainingGroup: trainingGroup || 'General'
          });
        }
      }
    }
    
    // Insert unique batches
    for (const batch of batchMap.values()) {
      await pool.query(`
        INSERT INTO batches (batch_name, district, coordinator_name, service_type, training_group)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (batch_name) DO NOTHING
      `, [batch.batchName, batch.district, 'District Coordinator', batch.serviceType, batch.trainingGroup]);
    }
    
    // Insert teacher-batch relationships
    for (const teacher of teacherData.slice(0, 500)) { // Limit to 500 records
      await pool.query(`
        INSERT INTO batch_teachers (batch_name, teacher_id, teacher_name, teacher_mobile, district, service_type, training_group)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [teacher.batchName, teacher.teacherId, teacher.teacherName, teacher.teacherMobile, teacher.district, teacher.serviceType, teacher.trainingGroup]);
    }
    
    console.log(`Imported ${batchMap.size} authentic batches and ${Math.min(teacherData.length, 500)} teacher assignments`);
    
  } catch (error) {
    console.error('Import error:', error);
  } finally {
    await pool.end();
  }
}

importAuthenticBatches();