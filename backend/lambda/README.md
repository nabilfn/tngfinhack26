# FacePay Lambda Functions

Two Lambda functions handle face processing asynchronously via S3 event triggers.

## Functions

| Function | Trigger prefix | Purpose |
|---|---|---|
| `enroll/` | `enrollments/` | Calls `IndexFaces`, writes to `FacePayUsers` DynamoDB |
| `verify/` | `verifications/` | Calls `SearchFacesByImage`, writes to `FacePayVerifications` DynamoDB |

## AWS Setup Checklist

### 1. S3 Bucket

```bash
aws s3 mb s3://facepay-bucket --region ap-southeast-1
```

Block public access (all 4 settings on). The backend uses IAM credentials to upload.

Configure S3 event notifications:
- **Enroll trigger**: prefix `enrollments/`, event `s3:ObjectCreated:*` → Lambda `facepay-enroll`
- **Verify trigger**: prefix `verifications/`, event `s3:ObjectCreated:*` → Lambda `facepay-verify`

> ⚠️ Do NOT set a trigger on the root of the bucket — only on specific prefixes to avoid infinite loops.

### 2. Rekognition Collection

```bash
aws rekognition create-collection \
  --collection-id facepay-users \
  --region ap-southeast-1
```

### 3. DynamoDB Tables

**FacePayUsers** (written by Lambda 1):
```bash
aws dynamodb create-table \
  --table-name FacePayUsers \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-1
```

**FacePayVerifications** (written by Lambda 2, queried by backend via GSI):
```bash
aws dynamodb create-table \
  --table-name FacePayVerifications \
  --attribute-definitions \
    AttributeName=verificationId,AttributeType=S \
    AttributeName=transactionId,AttributeType=S \
  --key-schema AttributeName=verificationId,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "transactionId-index",
      "KeySchema": [{"AttributeName":"transactionId","KeyType":"HASH"}],
      "Projection": {"ProjectionType":"ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-1
```

### 4. IAM Role for Lambda

Create a role `facepay-lambda-role` with these policies:
- `AmazonS3ReadOnlyAccess` (or a scoped policy for the bucket)
- `AmazonRekognitionFullAccess`
- `AmazonDynamoDBFullAccess` (or scoped to the two tables)
- `AWSLambdaBasicExecutionRole` (for CloudWatch logs)

### 5. Deploy Lambda Functions

Each function is a single `index.js` file. Package and deploy:

```bash
# Enroll function
cd backend/lambda/enroll
zip -r function.zip index.js
aws lambda create-function \
  --function-name facepay-enroll \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::<ACCOUNT_ID>:role/facepay-lambda-role \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --environment Variables="{
    REKOGNITION_COLLECTION_ID=facepay-users,
    DYNAMO_FACE_TABLE=FacePayUsers,
    AWS_REGION=ap-southeast-1
  }" \
  --region ap-southeast-1

# Verify function
cd ../verify
zip -r function.zip index.js
aws lambda create-function \
  --function-name facepay-verify \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::<ACCOUNT_ID>:role/facepay-lambda-role \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --environment Variables="{
    REKOGNITION_COLLECTION_ID=facepay-users,
    DYNAMO_FACE_TABLE=FacePayUsers,
    DYNAMO_VERIF_TABLE=FacePayVerifications,
    REKOGNITION_THRESHOLD=95,
    AWS_REGION=ap-southeast-1
  }" \
  --region ap-southeast-1
```

### 6. IAM Policy for Backend (EC2 / ECS / local)

The backend needs these permissions:
- `s3:PutObject` on `arn:aws:s3:::facepay-bucket/*`
- `dynamodb:GetItem` on `FacePayUsers`
- `dynamodb:Query` on `FacePayVerifications` and its GSI

## Environment Variables (Lambda)

| Variable | Default | Description |
|---|---|---|
| `REKOGNITION_COLLECTION_ID` | `facepay-users` | Rekognition collection |
| `DYNAMO_FACE_TABLE` | `FacePayUsers` | User-face mapping table |
| `DYNAMO_VERIF_TABLE` | `FacePayVerifications` | Verification results table |
| `REKOGNITION_THRESHOLD` | `95` | Min confidence for a match (verify only) |
| `AWS_REGION` | `ap-southeast-1` | AWS region |
