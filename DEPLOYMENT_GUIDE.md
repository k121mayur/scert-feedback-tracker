# NIPUN Teachers Portal - AWS Deployment Guide

## Overview
Complete deployment configuration for the NIPUN Teachers Portal on AWS, optimized for handling 40,000+ concurrent users with advanced performance optimizations.

## Pre-requisites

### 1. AWS CLI Setup
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure
```

### 2. Docker Installation
```bash
# Install Docker
sudo apt-get update
sudo apt-get install docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

### 3. Required Tools
```bash
# Install jq for JSON processing
sudo apt-get install jq

# Install git
sudo apt-get install git
```

## Infrastructure Setup

### Step 1: Deploy AWS Infrastructure
```bash
# Create the infrastructure stack
aws cloudformation create-stack \
  --stack-name nipun-teachers-portal-infrastructure \
  --template-body file://aws-infrastructure.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-south-1

# Wait for stack creation
aws cloudformation wait stack-create-complete \
  --stack-name nipun-teachers-portal-infrastructure \
  --region ap-south-1
```

### Step 2: Configure Environment Variables
```bash
# Copy and edit environment file
cp .env.example .env

# Edit the .env file with your values:
# - DATABASE_URL (from CloudFormation outputs)
# - AWS credentials
# - Domain configuration
```

### Step 3: Build and Deploy Application
```bash
# Make deployment script executable
chmod +x deploy-to-aws.sh

# Run full deployment
./deploy-to-aws.sh deploy
```

## Configuration Files

### Docker Configuration
- **Dockerfile**: Multi-stage build optimized for production
- **docker-compose.yml**: Local development and testing
- **nginx.conf**: Reverse proxy with rate limiting and security headers

### AWS Configuration
- **aws-ecs-task-definition.json**: ECS Fargate task definition
- **aws-infrastructure.yml**: CloudFormation template for complete infrastructure
- **deploy-to-aws.sh**: Automated deployment script

### Environment Configuration
- **.env.example**: Template for environment variables

## Deployment Options

### Option 1: Full Automated Deployment
```bash
./deploy-to-aws.sh deploy
```

### Option 2: Build Image Only
```bash
./deploy-to-aws.sh build-only
```

### Option 3: Update Service Only
```bash
./deploy-to-aws.sh update-service
```

## Infrastructure Components

### Network Layer
- **VPC**: Custom VPC with public and private subnets
- **ALB**: Application Load Balancer with health checks
- **Security Groups**: Layered security with minimal access

### Compute Layer
- **ECS Fargate**: Serverless container orchestration
- **Auto Scaling**: Automatic scaling based on CPU/memory
- **Load Balancing**: Traffic distribution across instances

### Database Layer
- **RDS PostgreSQL**: Multi-AZ database with encryption
- **Secrets Manager**: Secure credential management
- **Backup**: Automated daily backups with 7-day retention

### Monitoring & Logging
- **CloudWatch**: Application and infrastructure monitoring
- **ECS Logs**: Centralized log aggregation
- **Health Checks**: Application-level health monitoring

## Performance Optimizations

### Connection Management
- **Connection Pool**: Optimized to 500 max connections
- **Keep-Alive**: 2-minute timeout, 1000 max per connection
- **UV Thread Pool**: Increased to 128 threads for I/O handling

### Memory Management
- **Garbage Collection**: Automated memory cleanup
- **Payload Limits**: Reduced to 100KB to prevent memory bloat
- **Resource Limits**: Container memory limits and reservations

### Caching Strategy
- **Node Cache**: In-memory caching for frequent queries
- **CDN Ready**: Static asset optimization
- **Database Query Optimization**: Indexed queries and connection pooling

## Security Features

### Network Security
- **Private Subnets**: Database isolated from internet
- **Security Groups**: Port-specific access control
- **HTTPS Ready**: SSL/TLS termination at load balancer

### Application Security
- **Rate Limiting**: API endpoint protection
- **Security Headers**: XSS, CSRF, and clickjacking protection
- **Secrets Management**: AWS Secrets Manager integration

### Database Security
- **Encryption**: At-rest and in-transit encryption
- **Access Control**: IAM-based database access
- **Network Isolation**: Private subnet deployment

## Monitoring and Maintenance

### Health Monitoring
```bash
# Check application health
curl https://your-domain.com/health

# View ECS service status
aws ecs describe-services \
  --cluster nipun-cluster \
  --services nipun-service \
  --region ap-south-1
```

### Log Access
```bash
# View application logs
aws logs tail /ecs/nipun-teachers-portal \
  --follow \
  --region ap-south-1
```

### Database Management
```bash
# Connect to database (requires bastion host or VPN)
psql -h YOUR_RDS_ENDPOINT -U nipun_admin -d nipun_teachers

# Run database migrations
npm run db:push
```

## Scaling Configuration

### Horizontal Scaling
- **Auto Scaling**: CPU/Memory based scaling
- **Target Tracking**: Maintains 70% CPU utilization
- **Min/Max Instances**: 2 minimum, 50 maximum

### Vertical Scaling
- **Task CPU**: 1 vCPU (can be increased to 4 vCPU)
- **Task Memory**: 2GB (can be increased to 30GB)
- **Database Instance**: db.t3.medium (can scale to db.r5.xlarge)

## Troubleshooting

### Common Issues

1. **Deployment Failures**
   ```bash
   # Check CloudFormation events
   aws cloudformation describe-stack-events \
     --stack-name nipun-teachers-portal-infrastructure
   ```

2. **ECS Task Failures**
   ```bash
   # Check task logs
   aws ecs describe-tasks \
     --cluster nipun-cluster \
     --tasks TASK_ARN
   ```

3. **Database Connection Issues**
   ```bash
   # Verify security group rules
   aws ec2 describe-security-groups \
     --group-names NIPUN-Database-SecurityGroup
   ```

### Performance Monitoring
- **CloudWatch Dashboards**: Real-time metrics
- **Application Metrics**: Response times and error rates
- **Database Performance**: Query performance insights

## Cost Optimization

### Resource Right-Sizing
- **Fargate Spot**: 66% cost reduction for non-critical tasks
- **Reserved Instances**: Database cost optimization
- **Auto Scaling**: Pay only for needed capacity

### Monitoring Costs
```bash
# View cost breakdown
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

## Support and Maintenance

### Regular Maintenance Tasks
1. **Security Updates**: Monthly container image updates
2. **Database Maintenance**: Automated backup verification
3. **Performance Review**: Weekly performance metrics analysis
4. **Cost Review**: Monthly cost optimization review

### Backup and Recovery
- **Database Backups**: Automated daily backups
- **Application State**: Stateless design for easy recovery
- **Disaster Recovery**: Multi-AZ deployment for high availability

## Getting Help

For deployment issues or questions:
1. Check CloudWatch logs for error details
2. Verify all environment variables are set correctly
3. Ensure AWS permissions are properly configured
4. Review security group and network ACL settings

## Next Steps

After successful deployment:
1. Configure domain name and SSL certificate
2. Set up monitoring alerts and dashboards
3. Implement backup verification procedures
4. Configure log retention policies
5. Set up automated security scanning