# Face2Go Deployment Guide

## Local Docker

```bash
docker-compose down
docker-compose up --build
```

The backend runs Prisma `db push` during container startup so the PostgreSQL schema is created automatically.

## AWS deployment target

Recommended AWS services:

- Backend: EC2, ECS, or Elastic Beanstalk
- Database: AWS RDS PostgreSQL
- AI: AWS Rekognition
- Secrets: AWS Secrets Manager or environment variables
- Future AI risk layer: Bedrock-ready config

Required backend environment variables:

```env
PORT=4000
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/face2go
JWT_SECRET=long_random_secret
FRONTEND_URL=https://your-frontend-domain.com
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
REKOGNITION_THRESHOLD=95
AUTO_SEED=false
BEDROCK_ENABLED=false
```

## Alibaba Cloud role

Alibaba Cloud can be used for:

- Container Registry image storage
- Optional ECS deployment
- Optional ApsaraDB PostgreSQL alternative
- Optional Facebody alternative if replacing AWS Rekognition

## Production notes

- Use HTTPS for camera access.
- Do not commit `.env` in production repositories.
- Use a long random JWT secret.
- Use RDS/ApsaraDB managed backups.
- Replace base64 face storage with S3/object storage for production scale.
- Keep transaction approval logic in backend only.
