# AWS Cognito Authentication Setup

This guide explains how to set up AWS Cognito Hosted UI authentication for the Fitness Planner application.

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured
- Angular 19 application already set up

## Step 1: Deploy Cognito Infrastructure

1. **Deploy the CloudFormation stack:**
   ```bash
   aws cloudformation create-stack \
     --stack-name fitness-planner-cognito \
     --template-body file://cognito-setup.yaml \
     --parameters ParameterKey=AppName,ParameterValue=fitness-planner \
                  ParameterKey=Environment,ParameterValue=dev \
     --capabilities CAPABILITY_IAM
   ```

2. **Get the stack outputs:**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name fitness-planner-cognito \
     --query 'Stacks[0].Outputs'
   ```

3. **Note down these values:**
   - UserPoolId
   - UserPoolClientId  
   - IdentityPoolId
   - AuthDomain

## Step 2: Configure Application

1. **Update `src/aws-exports.ts` with your Cognito configuration:**
   ```typescript
   export const awsExports = {
     aws_project_region: 'us-east-1',
     aws_cognito_identity_pool_id: 'YOUR_IDENTITY_POOL_ID', // From stack output
     aws_cognito_region: 'us-east-1',
     aws_user_pools_id: 'YOUR_USER_POOL_ID', // From stack output
     aws_user_pools_web_client_id: 'YOUR_CLIENT_ID', // From stack output
     oauth: {
       domain: 'YOUR_AUTH_DOMAIN', // From stack output
       scope: ['phone', 'email', 'openid', 'profile', 'aws.cognito.signin.user.admin'],
       redirectSignIn: 'http://localhost:4200/',
       redirectSignOut: 'http://localhost:4200/',
       responseType: 'code'
     },
     // ... rest of configuration
   };
   ```

2. **Update redirect URLs for production:**
   ```bash
   aws cognito-idp update-user-pool-client \
     --user-pool-id YOUR_USER_POOL_ID \
     --client-id YOUR_CLIENT_ID \
     --callback-ur-ls "https://yourdomain.com/","http://localhost:4200/" \
     --logout-ur-ls "https://yourdomain.com/","http://localhost:4200/"
   ```

## Step 3: Create Initial Users and Groups

1. **Create a test admin user:**
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id YOUR_USER_POOL_ID \
     --username admin@example.com \
     --user-attributes Name=email,Value=admin@example.com \
                       Name=given_name,Value=Admin \
                       Name=family_name,Value=User \
                       Name=custom:role,Value=admin \
     --message-action SUPPRESS \
     --temporary-password TempPass123!
   ```

2. **Add user to Admin group:**
   ```bash
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id YOUR_USER_POOL_ID \
     --username admin@example.com \
     --group-name Admin
   ```

3. **Create a trainer user:**
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id YOUR_USER_POOL_ID \
     --username trainer@example.com \
     --user-attributes Name=email,Value=trainer@example.com \
                       Name=given_name,Value=Trainer \
                       Name=family_name,Value=User \
                       Name=custom:role,Value=trainer \
                       Name=custom:companyId,Value=GYM001 \
     --message-action SUPPRESS \
     --temporary-password TempPass123!
   ```

4. **Add user to Trainer group:**
   ```bash
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id YOUR_USER_POOL_ID \
     --username trainer@example.com \
     --group-name Trainer
   ```

## Step 4: Test the Authentication Flow

1. **Start the development server:**
   ```bash
   ng serve
   ```

2. **Navigate to `http://localhost:4200`**

3. **You should be redirected to `/login`**

4. **Click "Iniciar Sesión" to test the Hosted UI flow**

5. **Use one of the created test accounts to sign in**

## Step 5: Configure User Roles

The application supports three user roles:

### Admin
- Full access to all features
- Can manage exercises and users
- Can view all workout plans

### Trainer  
- Can create and manage workout plans
- Can manage exercises
- Can view plans for assigned clients
- Access to exercise manager

### Client
- Can view assigned workout plans
- Can use the planner to create personal plans
- Limited access to exercise database

## User Role Assignment

Roles can be assigned in two ways:

1. **Custom Attribute (`custom:role`):**
   ```bash
   aws cognito-idp admin-update-user-attributes \
     --user-pool-id YOUR_USER_POOL_ID \
     --username user@example.com \
     --user-attributes Name=custom:role,Value=trainer
   ```

2. **Cognito Groups:**
   ```bash
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id YOUR_USER_POOL_ID \
     --username user@example.com \
     --group-name Trainer
   ```

## Custom Attributes

The application uses these custom attributes:

- `custom:role` - User role (admin, trainer, client)
- `custom:companyId` - Company/gym identifier
- `custom:trainerIds` - Comma-separated list of trainer IDs (for clients)

## Troubleshooting

### 1. "User not authenticated" errors
- Check that aws-exports.ts has correct configuration
- Verify the user pool and client IDs
- Check browser console for CORS issues

### 2. Redirect loops
- Ensure callback URLs are correctly configured
- Check that routes are properly protected with guards

### 3. Role permissions issues
- Verify user has correct custom:role attribute
- Check if user is added to appropriate Cognito group
- Review route data for required roles

### 4. API authentication fails
- Ensure AuthInterceptor is properly configured
- Check that JWT tokens are being sent in headers
- Verify backend API accepts the tokens

## Security Best Practices

1. **Use HTTPS in production**
2. **Set appropriate session timeouts**
3. **Enable MFA for admin users**
4. **Use least privilege principle for IAM roles**
5. **Regularly rotate secrets and tokens**
6. **Monitor authentication logs**

## Production Deployment

1. **Update callback URLs for production domain**
2. **Configure custom domain for Cognito Hosted UI**
3. **Set up monitoring and logging**
4. **Configure backup and recovery procedures**
5. **Set up proper SSL certificates**

For production deployment, refer to the main deployment documentation.