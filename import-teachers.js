import { parse } from 'csv-parse';
import { createReadStream } from 'fs';
import { db } from './server/db.js';
import { teachers, batches, batchTeachers } from './shared/schema.js';

async function importTeachers() {
  console.log('Starting teacher data import...');
  
  const parser = createReadStream('./attached_assets/batch_teachers_1749097105409.csv')
    .pipe(parse({ 
      columns: true, 
      skip_empty_lines: true,
      trim: true
    }));

  let imported = 0;
  let batchesCreated = new Set();
  let teachersData = [];
  let batchTeachersData = [];

  for await (const record of parser) {
    const {
      'District': district,
      'batch Name': batchName,
      'Service type': serviceType,
      'Training group': trainingGroup,
      'Teacher ID': teacherId,
      'Teacher name': teacherName,
      'Phone number': phoneNumber
    } = record;

    if (!phoneNumber || phoneNumber === 'null') continue;

    // Clean phone number
    const mobile = phoneNumber.replace(/\D/g, '').substring(0, 10);
    if (mobile.length !== 10) continue;

    // Create batch if not exists
    if (!batchesCreated.has(batchName)) {
      try {
        await db.insert(batches).values({
          batchName,
          district,
          coordinatorName: 'System Import',
          serviceType: serviceType || 'Primary',
          trainingGroup: trainingGroup || 'Primary'
        }).onConflictDoNothing();
        batchesCreated.add(batchName);
      } catch (error) {
        // Batch already exists
      }
    }

    // Prepare teacher data
    teachersData.push({
      teacherId: teacherId === 'null' ? null : teacherId,
      teacherName,
      mobile,
      district,
      serviceType: serviceType || 'Primary',
      trainingGroup: trainingGroup || 'Primary'
    });

    // Prepare batch-teacher relationship
    batchTeachersData.push({
      batchName,
      teacherMobile: mobile,
      teacherName,
      district
    });

    imported++;

    // Batch insert every 1000 records
    if (imported % 1000 === 0) {
      try {
        await db.insert(teachers).values(teachersData).onConflictDoNothing();
        await db.insert(batchTeachers).values(batchTeachersData).onConflictDoNothing();
        teachersData = [];
        batchTeachersData = [];
        console.log(`Imported ${imported} teachers...`);
      } catch (error) {
        console.error(`Error importing batch at ${imported}:`, error);
      }
    }
  }

  // Insert remaining records
  if (teachersData.length > 0) {
    try {
      await db.insert(teachers).values(teachersData).onConflictDoNothing();
      await db.insert(batchTeachers).values(batchTeachersData).onConflictDoNothing();
    } catch (error) {
      console.error('Error importing final batch:', error);
    }
  }

  console.log(`Import completed! Total teachers imported: ${imported}`);
  
  // Verify import
  const count = await db.execute(`SELECT COUNT(*) as count FROM teachers`);
  console.log(`Total teachers in database: ${count.rows[0].count}`);
  
  const districtCount = await db.execute(`SELECT COUNT(DISTINCT district) as count FROM teachers`);
  console.log(`Total districts: ${districtCount.rows[0].count}`);
}

importTeachers().catch(console.error);