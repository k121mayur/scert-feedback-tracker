const fs = require('fs');
const { Pool } = require('pg');

async function bulkImport() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Starting bulk import...');
    
    const data = fs.readFileSync('./attached_assets/batch_teachers_1749097105409.csv', 'utf8');
    const lines = data.split('\n').slice(1); // Skip header
    
    let insertedCount = 0;
    let batchCount = 0;
    const batchSize = 500;
    let values = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const cols = line.split(',');
      if (cols.length < 7) continue;
      
      const [district, batchName, serviceType, trainingGroup, teacherId, teacherName, phoneNumber] = cols;
      
      // Clean phone number
      const mobile = phoneNumber.replace(/[^0-9]/g, '').substring(0, 10);
      if (mobile.length !== 10 || phoneNumber === 'null') continue;
      
      // Handle null teacher_id
      const cleanTeacherId = (teacherId === 'null' || !teacherId) ? null : teacherId;
      
      values.push([
        cleanTeacherId,
        teacherName.replace(/'/g, "''"),
        mobile,
        district.replace(/'/g, "''"),
        serviceType || 'Primary',
        trainingGroup || 'Primary'
      ]);
      
      if (values.length >= batchSize) {
        try {
          const placeholders = values.map((_, i) => `($${i*6 + 1}, $${i*6 + 2}, $${i*6 + 3}, $${i*6 + 4}, $${i*6 + 5}, $${i*6 + 6})`).join(',');
          const flatValues = values.flat();
          
          await pool.query(`
            INSERT INTO teachers (teacher_id, teacher_name, mobile, district, service_type, training_group)
            VALUES ${placeholders}
            ON CONFLICT (mobile) DO NOTHING
          `, flatValues);
          
          insertedCount += values.length;
          batchCount++;
          console.log(`Batch ${batchCount}: ${insertedCount} records processed`);
          values = [];
        } catch (err) {
          console.log(`Error in batch ${batchCount}:`, err.message);
          values = [];
        }
      }
    }
    
    // Insert remaining records
    if (values.length > 0) {
      try {
        const placeholders = values.map((_, i) => `($${i*6 + 1}, $${i*6 + 2}, $${i*6 + 3}, $${i*6 + 4}, $${i*6 + 5}, $${i*6 + 6})`).join(',');
        const flatValues = values.flat();
        
        await pool.query(`
          INSERT INTO teachers (teacher_id, teacher_name, mobile, district, service_type, training_group)
          VALUES ${placeholders}
          ON CONFLICT (mobile) DO NOTHING
        `, flatValues);
        
        insertedCount += values.length;
        console.log(`Final batch: ${insertedCount} total records processed`);
      } catch (err) {
        console.log('Error in final batch:', err.message);
      }
    }
    
    // Verify results
    const result = await pool.query('SELECT COUNT(*) as count FROM teachers');
    const districtResult = await pool.query('SELECT COUNT(DISTINCT district) as count FROM teachers');
    
    console.log(`\nImport completed!`);
    console.log(`Total teachers in database: ${result.rows[0].count}`);
    console.log(`Total districts: ${districtResult.rows[0].count}`);
    
  } catch (error) {
    console.error('Import error:', error);
  } finally {
    await pool.end();
  }
}

bulkImport();