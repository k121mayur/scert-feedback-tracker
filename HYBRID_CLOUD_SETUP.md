# NIPUN Teachers Portal - Hybrid Cloud Setup Guide

## Architecture Overview

Your system uses **Replit as the primary host** with **AWS services as intelligent fallbacks** to handle 40,000+ concurrent users. This hybrid approach gives you:

- **Cost Efficiency**: Use Replit's free/affordable hosting for normal loads
- **Automatic Scaling**: AWS services activate only when load thresholds are exceeded
- **High Availability**: Seamless failover between services
- **Performance Optimization**: Load distribution across multiple services

## Hybrid Cloud Components

### 1. Cache Layer (Local + AWS Redis)
- **Primary**: Node.js in-memory cache (fast, free)
- **Fallback**: AWS Redis (activated at 1,000+ concurrent users)
- **Strategy**: Local cache first, Redis for overflow and persistence

### 2. Database Layer (Replit DB + AWS RDS)
- **Primary**: Replit PostgreSQL database (300 max connections)
- **Fallback**: AWS RDS PostgreSQL (500 max connections)
- **Strategy**: Read distribution and write replication

### 3. Queue Processing (Memory + AWS SQS)
- **Primary**: In-memory queue processing
- **Fallback**: AWS SQS (activated at 500+ queued items)
- **Strategy**: Local processing with cloud overflow

## Environment Configuration

### Required Environment Variables

Add these to your Replit environment or `.env` file:

```bash
# Core Application
DATABASE_URL=your_replit_database_url
NODE_ENV=production
PORT=5000

# AWS Configuration (Optional - enables hybrid mode)
AWS_SERVICES_ENABLED=true
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# AWS Redis (Optional)
AWS_REDIS_ENABLED=true
AWS_REDIS_URL=redis://your-aws-redis-endpoint:6379

# AWS RDS (Optional)
AWS_RDS_URL=postgresql://username:password@your-rds-endpoint:5432/database

# AWS SQS (Optional)
AWS_SQS_ENABLED=true
AWS_SQS_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/account/queue-name

# Load Thresholds (Customize based on your needs)
CACHE_FAILOVER_THRESHOLD=1000
DATABASE_FAILOVER_THRESHOLD=2000
QUEUE_FAILOVER_THRESHOLD=500
```

## AWS Services Setup (Optional)

### 1. AWS Redis ElastiCache

```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id nipun-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1 \
  --region ap-south-1
```

### 2. AWS RDS PostgreSQL

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier nipun-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username nipun_admin \
  --master-user-password your_secure_password \
  --allocated-storage 20 \
  --region ap-south-1
```

### 3. AWS SQS Queue

```bash
# Create SQS queue
aws sqs create-queue \
  --queue-name nipun-exam-queue \
  --region ap-south-1
```

## Load Distribution Logic

### Cache Strategy
```
Local Memory Cache (0-1K users)
├── Fast access to frequently used data
└── 10,000 key limit with LRU eviction

AWS Redis Hybrid (1K+ users)
├── Overflow cache for high-load scenarios
├── Persistent cache across server restarts
└── Multi-region distribution capability
```

### Database Strategy
```
Replit Primary DB (0-2K users)
├── All read and write operations
└── 300 connection limit

AWS RDS Hybrid (2K+ users)
├── Read queries: 70% Primary, 30% RDS
├── Write queries: Primary with RDS replication
└── Automatic failover on primary failure
```

### Queue Strategy
```
Local Memory Queue (0-500 items)
├── Immediate processing
└── No external dependencies

AWS SQS Hybrid (500+ items)
├── Overflow queue processing
├── Guaranteed message delivery
└── Auto-scaling processing
```

## Deployment Steps

### 1. Replit-Only Mode (Default)
Your application works perfectly on Replit without any AWS services:

```bash
# Set environment variables in Replit
DATABASE_URL=your_replit_db_url
NODE_ENV=production

# Deploy normally
npm run dev
```

### 2. Hybrid Mode (Recommended for High Load)

#### Step 1: Set up AWS credentials
```bash
# In Replit Secrets
AWS_SERVICES_ENABLED=true
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

#### Step 2: Configure AWS services (as needed)
```bash
# Enable Redis fallback
AWS_REDIS_ENABLED=true
AWS_REDIS_URL=redis://your-endpoint:6379

# Enable RDS fallback
AWS_RDS_URL=postgresql://user:pass@endpoint:5432/db

# Enable SQS fallback
AWS_SQS_ENABLED=true
AWS_SQS_QUEUE_URL=https://sqs.region.amazonaws.com/account/queue
```

#### Step 3: Deploy with hybrid capabilities
```bash
npm run dev
```

## Monitoring and Load Testing

### Real-time System Status
Access system status at: `https://your-replit-url.replit.dev/api/system-status`

### Load Testing
```bash
# Test with 1K users (local mode)
curl -X POST https://your-replit-url.replit.dev/api/simulate-load \
  -H "Content-Type: application/json" \
  -d '{"users": 1000}'

# Test with 5K users (hybrid mode)
curl -X POST https://your-replit-url.replit.dev/api/simulate-load \
  -H "Content-Type: application/json" \
  -d '{"users": 5000}'
```

### Performance Metrics
Monitor these metrics in your application:
- Concurrent users
- Cache hit ratio
- Database connection count
- Queue length
- Response times
- Service health status

## Cost Optimization

### Replit-Only Costs
- **Free Tier**: Up to ~100 concurrent users
- **Hacker Plan**: $7/month for higher limits
- **Pro Plan**: $20/month for production use

### AWS Hybrid Costs (Only when needed)
- **Redis**: $15-50/month (only when load > 1K users)
- **RDS**: $25-100/month (only when load > 2K users)  
- **SQS**: $0.40 per million messages (only when queue > 500 items)

### Total Monthly Cost Examples
- **0-1K users**: $7-20 (Replit only)
- **1K-2K users**: $22-70 (Replit + Redis)
- **2K-5K users**: $47-170 (Replit + Redis + RDS)
- **5K+ users**: $47-170 + SQS usage

## Failover Scenarios

### Scenario 1: High Cache Load
```
1. Local cache reaches 10,000 keys
2. System automatically enables AWS Redis
3. New cache entries go to Redis
4. Reads check local first, then Redis
5. Automatic cost optimization
```

### Scenario 2: Database Overload
```
1. Replit DB connections reach 250/300
2. System automatically enables AWS RDS
3. Read queries distributed 70/30
4. Write queries replicated to both
5. Seamless user experience
```

### Scenario 3: Queue Overflow
```
1. Local queue reaches 500 items
2. System automatically enables AWS SQS
3. New items go to SQS
4. Parallel processing from both queues
5. Guaranteed message delivery
```

## Security Considerations

### Network Security
- All AWS services in private subnets
- VPC security groups restrict access
- Encrypted connections (TLS)

### Data Security
- Database encryption at rest
- Redis AUTH enabled
- SQS message encryption
- IAM role-based access

### Access Control
- Minimal AWS permissions
- Temporary credentials where possible
- Regular credential rotation

## Troubleshooting

### Common Issues

#### AWS Services Not Connecting
1. Check AWS credentials in Replit Secrets
2. Verify AWS service endpoints
3. Check security group rules
4. Test connectivity manually

#### High Latency
1. Check service health status
2. Monitor cache hit ratios
3. Verify database connection pools
4. Review load distribution

#### Memory Issues
1. Monitor Replit memory usage
2. Adjust cache limits
3. Enable AWS fallbacks earlier
4. Optimize data structures

### Debug Commands
```bash
# Check system status
curl https://your-app.replit.dev/api/system-status

# View service health
curl https://your-app.replit.dev/api/health

# Monitor performance
curl https://your-app.replit.dev/api/performance-metrics
```

## Migration Strategy

### Phase 1: Start with Replit-Only
Deploy your application on Replit without AWS services to establish baseline performance.

### Phase 2: Add AWS Redis
When you consistently see >1K concurrent users, enable AWS Redis for cache overflow.

### Phase 3: Add AWS RDS
When database connections consistently exceed 200, enable AWS RDS for read distribution.

### Phase 4: Add AWS SQS
When queue processing becomes a bottleneck, enable AWS SQS for reliable message handling.

## Next Steps

1. **Deploy on Replit**: Start with Replit-only mode
2. **Monitor Usage**: Track concurrent users and performance
3. **Enable AWS Services**: Add services as load increases
4. **Optimize Costs**: Fine-tune thresholds based on usage patterns
5. **Scale Further**: Consider additional AWS services for extreme loads

Your hybrid cloud architecture ensures optimal performance and cost efficiency while providing seamless scaling to handle 40,000+ concurrent users.