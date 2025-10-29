# Web App Setup Guide

Complete guide for setting up and deploying the Enterprise Auth Demo web application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Azure AD App Registration](#azure-ad-app-registration)
- [Local Development Setup](#local-development-setup)
- [Azure Deployment](#azure-deployment)
- [Testing SSO Integration](#testing-sso-integration)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts & Tools

- **Azure Subscription** with permissions to:
  - Create Azure AD app registrations
  - Create App Service resources
  - Configure application settings
  
- **Development Tools**:
  - Node.js 20.x or higher
  - npm or yarn
  - Git
  - Azure CLI (optional but recommended)
  - VS Code with Azure extensions (optional)

### Azure AD Requirements

- Access to an Azure AD tenant (Microsoft Entra ID)
- Permissions to create app registrations
- Permissions to grant API permissions (or access to admin)

---

## Azure AD App Registration

### Step 1: Create the App Registration

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** (or Microsoft Entra ID)
3. Select **App registrations** from the left menu
4. Click **+ New registration**

### Step 2: Configure Basic Settings

Fill in the registration form:

- **Name**: `Enterprise Auth Demo - Web App`
- **Supported account types**: 
  - Select "Accounts in this organizational directory only (Single tenant)"
- **Redirect URI**: 
  - Platform: **Single-page application (SPA)**
  - URI: `http://localhost:3000/auth/callback`
  - Click "Add"

Click **Register** to create the app.

### Step 3: Note Configuration Values

From the **Overview** page, copy these values (you'll need them later):

```
Application (client) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Directory (tenant) ID:   yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
```

### Step 4: Configure Authentication

1. Go to **Authentication** in the left menu
2. Under **Implicit grant and hybrid flows**:
   - ✅ Check **ID tokens (used for implicit and hybrid flows)**
   - ⬜ Leave **Access tokens** unchecked (not needed for SPA)
3. Under **Allow public client flows**: 
   - Select **No**
4. Click **Save**

### Step 5: Add API Permissions

1. Go to **API permissions** in the left menu
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add these permissions:
   - `User.Read`
   - `profile`
   - `openid`
   - `email`
6. Click **Add permissions**

### Step 6: Grant Admin Consent (if required)

If your organization requires admin consent:

1. Click **Grant admin consent for [Your Organization]**
2. Confirm the action
3. Wait for all permissions to show "Granted" status

### Step 7: Add Production Redirect URI (After Deployment)

After deploying to Azure, add the production redirect URI:

1. Go back to **Authentication**
2. Under **Single-page application** platform, click **+ Add URI**
3. Add: `https://your-app-name.azurewebsites.net/auth/callback`
4. Click **Save**

---

## Local Development Setup

### Step 1: Navigate to Web App Directory

```bash
cd web-app
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your Azure AD values:

```env
# Azure AD Configuration
CLIENT_ID=your-application-client-id-here
TENANT_ID=your-directory-tenant-id-here
AUTHORITY=https://login.microsoftonline.com/your-tenant-id-here
REDIRECT_URI=http://localhost:3000/auth/callback

# API Scopes
API_SCOPES=User.Read,profile,openid,email

# Server Configuration
PORT=3000
NODE_ENV=development
```

Replace:
- `your-application-client-id-here` with the Application (client) ID from Step 3
- `your-directory-tenant-id-here` with the Directory (tenant) ID from Step 3
- `your-tenant-id-here` (in AUTHORITY) with the same tenant ID

### Step 4: Start the Application

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### Step 5: Test Locally

1. Open browser to: `http://localhost:3000`
2. Click **Sign In with Microsoft**
3. Authenticate with your Azure AD credentials
4. Test the protected endpoints:
   - Click **Get Profile Data**
   - Click **Fetch Protected Data**

---

## Azure Deployment

### Option A: Deploy Using Azure CLI

#### 1. Install Azure CLI

If not already installed:

```bash
# macOS
brew install azure-cli

# Windows
# Download from: https://aka.ms/installazurecliwindows

# Linux
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

#### 2. Login to Azure

```bash
az login
```

#### 3. Create Resource Group

```bash
az group create \
  --name enterprise-auth-rg \
  --location uksouth
```

#### 4. Create App Service Plan

```bash
az appservice plan create \
  --name enterprise-auth-plan \
  --resource-group enterprise-auth-rg \
  --sku B1 \
  --is-linux
```

#### 5. Create Web App

```bash
az webapp create \
  --name enterprise-auth-demo-web \
  --resource-group enterprise-auth-rg \
  --plan enterprise-auth-plan \
  --runtime "NODE:20-lts"
```

**Note**: The app name must be globally unique. If `enterprise-auth-demo-web` is taken, try adding your initials or a number.

#### 6. Configure Application Settings

```bash
az webapp config appsettings set \
  --name enterprise-auth-demo-web \
  --resource-group enterprise-auth-rg \
  --settings \
    CLIENT_ID="your-client-id" \
    TENANT_ID="your-tenant-id" \
    AUTHORITY="https://login.microsoftonline.com/your-tenant-id" \
    REDIRECT_URI="https://enterprise-auth-demo-web.azurewebsites.net/auth/callback" \
    API_SCOPES="User.Read,profile,openid,email" \
    NODE_ENV="production"
```

Replace the placeholders with your actual Azure AD values.

#### 7. Deploy Application

From the `web-app` directory:

```bash
az webapp up \
  --name enterprise-auth-demo-web \
  --resource-group enterprise-auth-rg \
  --location uksouth
```

#### 8. Enable HTTPS Only

```bash
az webapp update \
  --name enterprise-auth-demo-web \
  --resource-group enterprise-auth-rg \
  --https-only true
```

#### 9. View Application

```bash
az webapp browse \
  --name enterprise-auth-demo-web \
  --resource-group enterprise-auth-rg
```

Or visit: `https://enterprise-auth-demo-web.azurewebsites.net`

### Option B: Deploy Using VS Code

#### 1. Install Extensions

Install these VS Code extensions:
- **Azure Account**
- **Azure App Service**

#### 2. Sign In to Azure

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type: `Azure: Sign In`
3. Follow the authentication flow

#### 3. Deploy Web App

1. Right-click on the `web-app` folder in VS Code Explorer
2. Select **Deploy to Web App...**
3. Choose **+ Create new Web App... Advanced**
4. Follow the prompts:
   - **Name**: `enterprise-auth-demo-web` (or your unique name)
   - **Resource Group**: Create new or select existing
  - **Runtime**: Node 20 LTS
  - **OS**: Linux
  - **Location**: UK South
   - **App Service Plan**: Create new (B1 Basic)

#### 4. Configure Environment Variables

1. In VS Code, open the **Azure** sidebar
2. Expand **APP SERVICE** → Your subscription
3. Right-click your web app → **Application Settings**
4. Click **+ Add New Setting** for each:
   ```
   CLIENT_ID = your-client-id
   TENANT_ID = your-tenant-id
   AUTHORITY = https://login.microsoftonline.com/your-tenant-id
   REDIRECT_URI = https://your-app-name.azurewebsites.net/auth/callback
   API_SCOPES = User.Read,profile,openid,email
   NODE_ENV = production
   ```

#### 5. Restart the App

Right-click the web app → **Restart**

### Option C: Deploy Using Azure Portal

#### 1. Create App Service

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **+ Create a resource**
3. Search for **Web App**
4. Click **Create**
5. Configure:
   - **Subscription**: Your subscription
   - **Resource Group**: Create new: `enterprise-auth-rg`
   - **Name**: `enterprise-auth-demo-web`
  - **Publish**: Code
  - **Runtime stack**: Node 20 LTS
  - **Operating System**: Linux
   - **Region**: UK South
   - **App Service Plan**: Create new (B1 Basic)
6. Click **Review + create** → **Create**

#### 2. Configure Application Settings

1. Go to your App Service resource
2. Select **Configuration** from left menu
3. Under **Application settings**, click **+ New application setting**
4. Add each setting:
   ```
   Name: CLIENT_ID
   Value: your-client-id
   
   Name: TENANT_ID
   Value: your-tenant-id
   
   Name: AUTHORITY
   Value: https://login.microsoftonline.com/your-tenant-id
   
   Name: REDIRECT_URI
   Value: https://enterprise-auth-demo-web.azurewebsites.net/auth/callback
   
   Name: API_SCOPES
   Value: User.Read,profile,openid,email
   
   Name: NODE_ENV
   Value: production
   ```
5. Click **Save** at the top

#### 3. Deploy Code

**Using Local Git:**

1. In App Service, go to **Deployment Center**
2. Select **Local Git** → **Save**
3. Copy the Git Clone URI
4. In your local terminal:
   ```bash
   cd web-app
   git remote add azure <Git-Clone-URI>
   git push azure main
   ```

**Using ZIP Deploy:**

1. Create a ZIP of the web-app directory (excluding node_modules)
2. In App Service, go to **Advanced Tools** → **Go**
3. Navigate to **Tools** → **Zip Push Deploy**
4. Drag and drop your ZIP file

---

## Testing SSO Integration

### Verify Web App Authentication

1. Navigate to your deployed web app URL
2. Click **Sign In with Microsoft**
3. Authenticate with Azure AD credentials
4. Verify you're redirected back and logged in
5. Test the API endpoints:
   - Click **Get Profile Data** - should display your user info
   - Click **Fetch Protected Data** - should show demo data

### Test Chrome Custom Tabs Integration

#### Session Token Flow Overview

The web app uses a **session token exchange pattern** for secure SSO from the native Android app:

1. **Native app** authenticates user via MSAL + Microsoft Authenticator broker
2. **Native app** calls backend to obtain short-lived session token (60 seconds, single-use)
3. **Native app** launches Chrome Custom Tabs with: `https://your-app.azurewebsites.net/?session_token=<token>`
4. **Web app** detects session token and exchanges it for authenticated session via `POST /api/web/initialize-session`
5. **Backend** validates token, marks as used, and returns session cookie
6. **User** is authenticated without any login prompts

#### Simulate Session Token Exchange

To test the session token flow:

**Step 1: Generate a Session Token (Mock)**

For testing purposes, create a JWT that simulates a session initialization token:

```javascript
// Use jwt.io or generate via Node.js
const payload = {
  type: 'session_init',
  sub: 'user-id-123',
  name: 'Test User',
  email: 'test.user@example.com',
  preferred_username: 'test.user@example.com',
  exp: Math.floor(Date.now() / 1000) + 60, // Expires in 60 seconds
  iat: Math.floor(Date.now() / 1000)
};
// Sign with secret (for demo only - production uses proper validation)
```

**Step 2: Test the Exchange**

Open the web app with the session token:
```
https://your-app-name.azurewebsites.net/?session_token=<session-token-here>
```

**Step 3: Verify Behavior**

The web app should:
1. Detect the `session_token` query parameter
2. Call `POST /api/web/initialize-session` with the token
3. Receive session cookie from backend
4. **Immediately** remove token from URL (security)
5. Display authenticated view without login prompts
6. Allow access to protected endpoints

#### Expected Behavior

✅ **Success Path**:
- Session token detected in URL parameter
- Token exchanged successfully with backend
- Session cookie set (HTTP-only, Secure)
- User authenticated without login prompts
- URL cleaned immediately (token removed from browser history)
- Protected endpoints accessible

❌ **Failure Scenarios**:
- **Expired token** (>60 seconds old) → Shows error, redirects to login
- **Reused token** → Backend rejects, redirects to login
- **Invalid token format** → Shows error, redirects to login
- **Missing token** → Normal MSAL.js authentication flow
- **Network error** → Shows error message with retry option

#### Security Features

🔒 **Session Token Properties**:
- **Short-lived**: 60 seconds maximum lifetime
- **Single-use**: Backend marks as used after first exchange
- **Type-validated**: Must have `type: 'session_init'` claim
- **URL-cleaned**: Removed from browser history immediately
- **HTTP-only cookie**: Session cookie not accessible to JavaScript
- **Secure flag**: Cookies only sent over HTTPS in production

#### Integration with Native Android App

The Android app should:

```kotlin
// 1. Authenticate user via MSAL Android
val authResult = msalApp.acquireToken(params)

// 2. Call backend to get session token
val sessionToken = backendApi.createSessionToken(
    accessToken = authResult.accessToken
)

// 3. Launch Chrome Custom Tabs with session token
val url = "https://your-web-app.azurewebsites.net/?session_token=$sessionToken"
val intent = CustomTabsIntent.Builder().build()
intent.launchUrl(context, Uri.parse(url))

// Token is valid for 60 seconds - launch immediately
```

#### Backend Requirements

Your backend API needs to implement:

**Endpoint**: `POST /api/native/create-session-token`
- **Input**: User's access token (from MSAL Android)
- **Output**: Short-lived session initialization token
- **Validation**: Verify access token, check user permissions
- **Token claims**: Include `type: 'session_init'`, user info, 60s expiry

**Endpoint**: `POST /api/web/initialize-session` (implemented in web app)
- **Input**: Session token from query parameter
- **Output**: Session cookie + user info
- **Validation**: Check expiry, single-use, token type
- **Side effects**: Mark token as used, create session

#### Testing Checklist

- [ ] Valid token → Session created successfully
- [ ] Expired token → Error message, redirect to login
- [ ] Reused token → Rejected by backend
- [ ] Invalid token format → Error handling works
- [ ] URL cleaned → Token not in browser history
- [ ] Session persists → Refresh page stays logged in
- [ ] Normal web login → Still works without session token

---

## Troubleshooting

### Authentication Errors

#### Error: "AADSTS50011: The reply URL specified in the request does not match"

**Solution**:
1. Check the redirect URI in `.env` matches exactly what's in Azure AD
2. Verify the URI includes the protocol (`http://` or `https://`)
3. Ensure there are no trailing slashes unless configured in Azure AD
4. Add the production URI to Azure AD app registration

#### Error: "AADSTS700016: Application not found in the directory"

**Solution**:
1. Verify the `CLIENT_ID` is correct
2. Ensure you're using the right Azure AD tenant
3. Check the app registration wasn't deleted

#### Error: "User login is required"

**Solution**:
1. This is expected if no cached session exists
2. Click the login button to authenticate
3. For SSO, ensure a valid token is passed from native app

### Token Validation Errors

#### Error: "Invalid token"

**Solution**:
1. Check token hasn't expired
2. Verify token audience matches `CLIENT_ID`
3. Ensure token issuer matches expected tenant
4. Check system clock is synchronized

#### Error: "Failed to fetch profile"

**Solution**:
1. Verify API permissions are granted in Azure AD
2. Check the token includes required scopes
3. Ensure backend can reach Microsoft Graph API
4. Review backend logs for specific errors

### Deployment Issues

#### App shows "Your App Service app is up and running"

**Solution**:
1. Check if `npm install` ran successfully
2. Verify `server.js` is in the root of deployment
3. Check Application Logs in Azure Portal
4. Ensure startup command is set correctly

#### Environment variables not working

**Solution**:
1. Verify settings are saved in Azure Portal Configuration
2. Restart the App Service after adding settings
3. Check spelling of environment variable names
4. Use Azure Portal → Configuration to verify values

#### CORS errors in browser

**Solution**:
1. Configure CORS in App Service:
   ```bash
   az webapp cors add \
     --name your-app-name \
     --resource-group enterprise-auth-rg \
     --allowed-origins 'https://your-frontend-domain.com'
   ```
2. Or use Azure Portal → CORS settings

### Checking Logs

#### Azure Portal

1. Go to your App Service
2. Select **Log stream** from left menu
3. Watch real-time logs

#### Azure CLI

```bash
az webapp log tail \
  --name enterprise-auth-demo-web \
  --resource-group enterprise-auth-rg
```

#### Download Logs

```bash
az webapp log download \
  --name enterprise-auth-demo-web \
  --resource-group enterprise-auth-rg \
  --log-file logs.zip
```

---

## Next Steps

After successful deployment:

1. ✅ Test web app authentication independently
2. ✅ Integrate with native Android hub app
3. ✅ Test end-to-end SSO flow via Chrome Custom Tabs
4. ✅ Document any Conditional Access policy impacts
5. ✅ Prepare demo script for stakeholders

## Security Checklist

Before going to production:

- [ ] HTTPS enforced (done automatically in Azure App Service)
- [ ] Environment variables stored securely (use Azure Key Vault for sensitive data)
- [ ] CORS properly configured (not wildcard `*`)
- [ ] API permissions reviewed and minimized
- [ ] Token expiration handling implemented
- [ ] Error messages don't expose sensitive info
- [ ] Logging doesn't capture tokens or secrets
- [ ] Content Security Policy configured
- [ ] Regular security updates planned

## Support

For issues specific to this PoC:
- Check the troubleshooting section above
- Review Azure App Service logs
- Check browser console for client-side errors
- Review backend logs for API errors

For Azure AD / Entra ID issues:
- Contact your Azure AD administrator
- Review Entra ID sign-in logs
- Check Conditional Access policies
