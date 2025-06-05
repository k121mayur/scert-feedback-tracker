import { readFileSync } from 'fs';
import { db } from './db';
import { sql } from 'drizzle-orm';

export class ProductionDataImporter {
  async importCompleteDataset(csvPath: string): Promise<void> {
    console.log('Starting production data import...');
    
    const csvContent = readFileSync(csvPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const dataRows = lines.slice(1).filter(line => line.trim().length > 0);
    
    console.log(`Processing ${dataRows.length} teacher records...`);
    
    const batchData = new Map<string, any>();
    const teacherInserts: string[] = [];
    const batchInserts: string[] = [];
    const batchTeacherInserts: string[] = [];
    
    let validRecords = 0;
    
    for (const line of dataRows) {
      const parts = this.parseCSVLine(line);
      if (parts.length < 7) continue;
      
      const [district, batchName, serviceType, trainingGroup, teacherId, teacherName, phoneNumber] = parts;
      
      // Validate phone number
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 10 || phoneNumber === 'null') continue;
      
      const mobile = cleanPhone.substring(0, 10);
      
      // Store unique batches
      if (!batchData.has(batchName) && batchName && batchName !== 'null') {
        batchData.set(batchName, true);
        batchInserts.push(`('${this.escapeSql(batchName)}', '${this.escapeSql(district)}', 'Production Import', '${this.escapeSql(serviceType || 'Primary')}', '${this.escapeSql(trainingGroup || 'Primary')}')`);
      }
      
      // Add teacher
      const cleanTeacherId = teacherId === 'null' || !teacherId ? 'NULL' : `'${this.escapeSql(teacherId)}'`;
      teacherInserts.push(`(${cleanTeacherId}, '${this.escapeSql(teacherName)}', '${mobile}', '${this.escapeSql(district)}', '${this.escapeSql(serviceType || 'Primary')}', '${this.escapeSql(trainingGroup || 'Primary')}')`);
      
      // Add batch-teacher relationship
      if (batchName && batchName !== 'null') {
        batchTeacherInserts.push(`('${this.escapeSql(batchName)}', '${mobile}', '${this.escapeSql(teacherName)}', '${this.escapeSql(district)}')`);
      }
      
      validRecords++;
      
      if (validRecords % 5000 === 0) {
        console.log(`Processed ${validRecords} records...`);
      }
    }
    
    console.log(`Total valid records: ${validRecords}`);
    console.log(`Unique batches: ${batchData.size}`);
    
    // Execute insertions in batches
    await this.executeBatchInserts('batches', ['batch_name', 'district', 'coordinator_name', 'service_type', 'training_group'], batchInserts);
    await this.executeBatchInserts('teachers', ['teacher_id', 'teacher_name', 'mobile', 'district', 'service_type', 'training_group'], teacherInserts);
    await this.executeBatchInserts('batch_teachers', ['batch_name', 'teacher_mobile', 'teacher_name', 'district'], batchTeacherInserts);
    
    // Verify import
    const results = await this.verifyImport();
    console.log('Import completed successfully!');
    console.log(`Total teachers: ${results.teachers}`);
    console.log(`Total districts: ${results.districts}`);
    console.log(`Total batches: ${results.batches}`);
  }
  
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }
  
  private escapeSql(str: string): string {
    if (!str) return '';
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
  }
  
  private async executeBatchInserts(tableName: string, columns: string[], values: string[]): Promise<void> {
    if (values.length === 0) return;
    
    console.log(`Inserting ${values.length} records into ${tableName}...`);
    
    const batchSize = 1000;
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${batch.join(', ')}`;
      
      try {
        await db.execute(sql.raw(query));
        
        if ((i + batchSize) % 5000 === 0) {
          console.log(`Inserted ${i + batchSize} ${tableName} records...`);
        }
      } catch (error) {
        console.error(`Error inserting batch ${i}-${i + batchSize} into ${tableName}:`, error);
        // Continue with next batch
      }
    }
  }
  
  private async verifyImport(): Promise<{ teachers: number; districts: number; batches: number }> {
    const teacherCount = await db.execute(sql`SELECT COUNT(*) as count FROM teachers`);
    const districtCount = await db.execute(sql`SELECT COUNT(DISTINCT district) as count FROM teachers`);
    const batchCount = await db.execute(sql`SELECT COUNT(*) as count FROM batches`);
    
    return {
      teachers: Number(teacherCount.rows[0]?.count || 0),
      districts: Number(districtCount.rows[0]?.count || 0),
      batches: Number(batchCount.rows[0]?.count || 0)
    };
  }
}

export const productionImporter = new ProductionDataImporter();