#!/bin/bash

# NIPUN Teachers Portal - AWS Deployment Script
# This script automates the deployment process to AWS ECS

set -e

# Configuration
AWS_REGION="ap-south-1"
ECR_REPOSITORY="nipun-teachers-portal"
ECS_CLUSTER="nipun-cluster"
ECS_SERVICE="nipun-service"
TASK_DEFINITION_FAMILY="nipun-teachers-portal"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it first."
        exit 1
    fi
    
    log_info "All dependencies are installed."
}

get_aws_account_id() {
    aws sts get-caller-identity --query Account --output text
}

build_and_push_image() {
    log_info "Building Docker image..."
    
    # Get AWS account ID
    ACCOUNT_ID=$(get_aws_account_id)
    ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"
    
    # Build the image
    docker build -t ${ECR_REPOSITORY}:latest .
    
    # Tag for ECR
    docker tag ${ECR_REPOSITORY}:latest ${ECR_URI}:latest
    
    log_info "Logging in to ECR..."
    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}
    
    log_info "Pushing image to ECR..."
    docker push ${ECR_URI}:latest
    
    echo ${ECR_URI}:latest
}

create_or_update_task_definition() {
    local image_uri=$1
    log_info "Creating/updating ECS task definition..."
    
    # Update the task definition with the new image URI
    sed "s|YOUR_ECR_URI/nipun-teachers-portal:latest|${image_uri}|g" aws-ecs-task-definition.json > temp-task-def.json
    sed -i "s|YOUR_ACCOUNT_ID|$(get_aws_account_id)|g" temp-task-def.json
    
    # Register the task definition
    aws ecs register-task-definition \
        --cli-input-json file://temp-task-def.json \
        --region ${AWS_REGION}
    
    # Clean up
    rm temp-task-def.json
    
    log_info "Task definition updated successfully."
}

update_ecs_service() {
    log_info "Updating ECS service..."
    
    # Get the latest task definition ARN
    TASK_DEF_ARN=$(aws ecs describe-task-definition \
        --task-definition ${TASK_DEFINITION_FAMILY} \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text \
        --region ${AWS_REGION})
    
    # Update the service
    aws ecs update-service \
        --cluster ${ECS_CLUSTER} \
        --service ${ECS_SERVICE} \
        --task-definition ${TASK_DEF_ARN} \
        --region ${AWS_REGION}
    
    log_info "ECS service update initiated."
}

wait_for_deployment() {
    log_info "Waiting for deployment to complete..."
    
    aws ecs wait services-stable \
        --cluster ${ECS_CLUSTER} \
        --services ${ECS_SERVICE} \
        --region ${AWS_REGION}
    
    log_info "Deployment completed successfully!"
}

setup_database() {
    log_info "Setting up database..."
    log_warn "Make sure your DATABASE_URL is configured in AWS Secrets Manager"
    log_warn "Run database migrations manually if needed: npm run db:push"
}

# Main deployment process
main() {
    log_info "Starting NIPUN Teachers Portal deployment to AWS..."
    
    check_dependencies
    
    # Build and push Docker image
    IMAGE_URI=$(build_and_push_image)
    log_info "Image pushed: ${IMAGE_URI}"
    
    # Update task definition
    create_or_update_task_definition ${IMAGE_URI}
    
    # Update ECS service
    update_ecs_service
    
    # Wait for deployment
    wait_for_deployment
    
    # Database setup reminder
    setup_database
    
    log_info "Deployment completed! Your application should be running on AWS ECS."
    log_info "Check the ECS console for service status and logs."
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "build-only")
        check_dependencies
        build_and_push_image
        ;;
    "update-service")
        check_dependencies
        update_ecs_service
        wait_for_deployment
        ;;
    *)
        echo "Usage: $0 [deploy|build-only|update-service]"
        echo "  deploy       - Full deployment (default)"
        echo "  build-only   - Only build and push Docker image"
        echo "  update-service - Only update ECS service"
        exit 1
        ;;
esac