const fs = require('fs');
const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importQuestions() {
  try {
    const sqlContent = fs.readFileSync('attached_assets/questions_1749097704660.sql', 'utf8');
    
    // Extract INSERT statements
    const insertMatch = sqlContent.match(/INSERT INTO `questions`[^;]+;/gs);
    if (!insertMatch) {
      console.error('No INSERT statements found');
      return;
    }
    
    // Parse the INSERT statement
    const insertStatement = insertMatch[0];
    const valuesMatch = insertStatement.match(/VALUES\s+([\s\S]+);$/);
    if (!valuesMatch) {
      console.error('No VALUES found');
      return;
    }
    
    // Split individual value sets
    const valuesString = valuesMatch[1];
    const valuesSets = valuesString.split(/\),\s*\(/);
    
    console.log(`Found ${valuesSets.length} questions to import`);
    
    // Clear existing questions
    await pool.query('TRUNCATE TABLE questions RESTART IDENTITY');
    console.log('Cleared existing questions');
    
    let imported = 0;
    for (let i = 0; i < valuesSets.length; i++) {
      let valueSet = valuesSets[i];
      
      // Clean up the value set
      valueSet = valueSet.replace(/^\(/, '').replace(/\)$/, '');
      
      // Parse values using a more robust approach
      const values = [];
      let currentValue = '';
      let inQuotes = false;
      let quoteChar = '';
      
      for (let j = 0; j < valueSet.length; j++) {
        const char = valueSet[j];
        
        if (!inQuotes && (char === "'" || char === '"')) {
          inQuotes = true;
          quoteChar = char;
          currentValue += char;
        } else if (inQuotes && char === quoteChar) {
          // Check if it's an escaped quote
          if (j + 1 < valueSet.length && valueSet[j + 1] === quoteChar) {
            currentValue += char + char;
            j++; // Skip next quote
          } else {
            inQuotes = false;
            currentValue += char;
          }
        } else if (!inQuotes && char === ',') {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      
      // Add the last value
      if (currentValue.trim()) {
        values.push(currentValue.trim());
      }
      
      if (values.length >= 11) {
        // Skip id (auto-generated), extract other fields
        const serviceType = values[1] === 'NULL' ? null : values[1].replace(/'/g, '');
        const trainingGroup = values[2] === 'NULL' ? null : values[2].replace(/'/g, '');
        const topicId = values[3].replace(/'/g, '');
        const topic = values[4].replace(/'/g, '');
        const question = values[5].replace(/'/g, '');
        const optionA = values[6].replace(/'/g, '');
        const optionB = values[7].replace(/'/g, '');
        const optionC = values[8].replace(/'/g, '');
        const optionD = values[9].replace(/'/g, '');
        const correctOption = values[10].replace(/'/g, '');
        
        try {
          await pool.query(`
            INSERT INTO questions (service_type, training_group, topic_id, topic, question, option_a, option_b, option_c, option_d, correct_option, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          `, [serviceType, trainingGroup, topicId, topic, question, optionA, optionB, optionC, optionD, correctOption]);
          
          imported++;
          if (imported % 50 === 0) {
            console.log(`Imported ${imported} questions...`);
          }
        } catch (err) {
          console.error(`Error importing question ${i + 1}:`, err.message);
        }
      }
    }
    
    console.log(`Successfully imported ${imported} questions`);
    
    // Update the database schema to match
    await pool.query(`
      UPDATE questions SET correct_answer = correct_option WHERE correct_answer IS NULL
    `);
    
    console.log('Database import completed successfully');
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await pool.end();
  }
}

importQuestions();