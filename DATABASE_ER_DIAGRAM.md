# Teacher Training Assessment Platform - Database ER Diagram

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            TEACHER TRAINING ASSESSMENT PLATFORM DATABASE                                       │
│                                     ER DIAGRAM                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐         ┌──────────────────────────┐         ┌─────────────────────────────┐
│        USERS            │         │        TEACHERS          │         │        BATCHES              │
├─────────────────────────┤         ├──────────────────────────┤         ├─────────────────────────────┤
│ • id (PK, Serial)       │         │ • id (PK, Serial)        │         │ • id (PK, Serial)           │
│ • username (Unique)     │         │ • teacherId              │         │ • batchName (Unique)        │
│ • password              │         │ • teacherName            │         │ • district                  │
│                         │         │ • mobile (Indexed)       │         │ • coordinatorName           │
└─────────────────────────┘         │ • payId                  │         │ • serviceType               │
                                    │ • district (Indexed)     │         │ • trainingGroup             │
                                    │ • serviceType            │         │ • createdAt                 │
                                    │ • trainingGroup          │         └─────────────────────────────┘
                                    │ • createdAt              │                        │
                                    └──────────────────────────┘                        │
                                                │                                       │
                                                │                                       │
                                                │                                       │
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    BATCH_TEACHERS (Junction Table)                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • id (PK, Serial)                                                                                              │
│ • batchName (FK → batches.batchName, Indexed)                                                                 │
│ • district (Indexed)                                                                                          │
│ • teacherId (Indexed)                                                                                         │
│ • teacherName                                                                                                 │
│ • teacherMobile (Indexed) - Critical for 40K concurrent user lookups                                         │
│ • serviceType                                                                                                 │
│ • trainingGroup                                                                                               │
│ • topicId                                                                                                     │
│ • registerId                                                                                                  │
│ • stopTime                                                                                                    │
│ • createdAt                                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ASSESSMENT_SCHEDULES                                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • id (PK, Serial)                                                                                              │
│ • assessmentDate (Indexed)                                                                                    │
│ • topicId (Indexed)                                                                                           │
│ • topicName                                                                                                   │
│ • isActive (Indexed)                                                                                          │
│ • createdAt                                                                                                   │
│ Composite Index: (assessmentDate, topicId)                                                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │
                                                ▼
┌─────────────────────────┐         ┌──────────────────────────┐         ┌─────────────────────────────┐
│      QUESTIONS          │         │     EXAM_RESULTS         │         │     EXAM_ANSWERS            │
├─────────────────────────┤         ├──────────────────────────┤         ├─────────────────────────────┤
│ • id (PK, Serial)       │         │ • id (PK, Serial)        │◄────────┤ • id (PK, Serial)           │
│ • serviceType (Indexed) │         │ • mobile (Indexed)       │         │ • mobile (Indexed)          │
│ • trainingGroup (Indexed)│        │ • topicId (Indexed)      │         │ • topicId (Indexed)         │
│ • topicId (Indexed)     │         │ • topicName              │         │ • question                  │
│ • topic                 │         │ • assessmentDate (Indexed)│        │ • selectedAnswer            │
│ • question              │         │ • batchName              │         │ • correctAnswer             │
│ • optionA               │         │ • district               │         │ • isCorrect                 │
│ • optionB               │         │ • registerId             │         │ • submittedAt (Indexed)     │
│ • optionC               │         │ • correctCount           │         └─────────────────────────────┘
│ • optionD               │         │ • wrongCount             │                        │
│ • correctAnswer         │         │ • unansweredCount        │                        │
│ • correctOption         │         │ • totalQuestions         │                        │
│ • createdAt (Indexed)   │         │ • submittedAt (Indexed)  │                        │
└─────────────────────────┘         │ Composite Index:         │                        │
                                    │ (mobile,topicId,date)    │                        │
                                    └──────────────────────────┘                        │
                                                │                                       │
                                                │                                       │
                                                ▼                                       │
┌─────────────────────────────────────────────────────────────────────────────────────▼───────────────────────┐
│                                    TRAINER_FEEDBACK                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • id (PK, Serial)                                                                                              │
│ • topicId (Indexed)                                                                                           │
│ • mobile (Indexed)                                                                                            │
│ • feedbackQue                                                                                                 │
│ • feedback                                                                                                    │
│ • batchName                                                                                                   │
│ • district                                                                                                    │
│ • submittedAt (Indexed)                                                                                       │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │
                                                ▼
┌─────────────────────────┐         ┌──────────────────────────┐
│  FEEDBACK_QUESTIONS     │         │    TOPIC_FEEDBACK        │
├─────────────────────────┤         │    (tot_feedback)        │
│ • id (PK, Serial)       │         ├──────────────────────────┤
│ • feedbackQues          │         │ • id (PK, Serial)        │
│ • option1               │         │ • topicName              │
│ • option2               │         │ • mobile                 │
│ • option3               │         │ • submittedAt            │
│ • option4               │         └──────────────────────────┘
│ • option5               │
│ • createdAt             │
└─────────────────────────┘

## Key Relationships

1. **BATCHES ↔ BATCH_TEACHERS** (1:N)
   - One batch contains many teachers
   - batchName is the foreign key

2. **TEACHERS ↔ EXAM_RESULTS** (1:N)
   - One teacher can have multiple exam results
   - Linked by mobile number

3. **EXAM_RESULTS ↔ EXAM_ANSWERS** (1:N)
   - One exam result has multiple answers
   - Composite relationship on (mobile, topicId)

4. **QUESTIONS → EXAM_ANSWERS** (Reference)
   - Questions provide the source for exam answers
   - Linked by topicId and question content

5. **TEACHERS ↔ TRAINER_FEEDBACK** (1:N)
   - One teacher can provide multiple feedback entries
   - Linked by mobile number

## Data Examples (Authentic Maharashtra Data)

### Batch Names (From CSV):
- "BATCH1 BHIVAPUR" (Nagpur)
- "SL KOLOSHI" (Sindhudurg)
- "SENIOR_PRIM_5" (Amravati)
- "MADHA-SEC/HS-NI" (Solapur)
- "AHE_SEL_PRI_1" (Ahmednagar)
- "१२ MIDD KARANJA" (Washim)
- "४०गाव व.प्रा." (Pune - Marathi)

### Teacher Data Structure:
- Teacher ID: "02DEDEDPM7201"
- Name: "EKNATH DADARAO PATIL"
- Mobile: "9764959805"
- District: "Nagpur"
- Service Type: "Selection Grade"
- Training Group: "Primary"

### Performance Optimizations:
- **Critical Indexes** for 40K concurrent users:
  - batch_teachers.teacherMobile (most frequent lookup)
  - exam_results.mobile + topicId + assessmentDate
  - exam_answers.mobile + topicId
  - assessment_schedules.assessmentDate + topicId

### Database Features:
- **Composite Indexes** for complex queries
- **Foreign Key Relationships** with proper referential integrity
- **Timestamp Tracking** for audit trails
- **Boolean Flags** for assessment control
- **Text Arrays** for multilingual support (Marathi/English)
- **Varchar Constraints** for mobile numbers (10-15 chars)
- **Serial Primary Keys** for auto-incrementing IDs