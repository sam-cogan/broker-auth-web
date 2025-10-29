# Enterprise SSO Demo - Web Application

A demonstration web application that showcases seamless Entra ID (Azure AD) authentication with support for:
- Standard browser-based MSAL.js authentication
- Token injection from Chrome Custom Tabs (for native app SSO)
- Silent authentication flows

## Features

✅ **Microsoft Entra ID Authentication** - Secure authentication using Azure AD  
✅ **SSO Support** - Seamless single sign-on from native Android app via Chrome Custom Tabs  
✅ **MSAL.js Integration** - Modern authentication library for browser-based auth  
✅ **Token Validation** - Backend JWT token validation for API security  
✅ **Protected API Endpoints** - Demonstrates secured resource access  

## Prerequisites

- Node.js 18.x or higher
- Azure AD tenant with app registration
- Azure account (for deployment)

## Local Development Setup

### 1. Clone and Install

```bash
cd web-app
npm install
```

### 2. Configure Environment

Copy the example environment file and configure your Azure AD settings:

```bash
cp .env.example .env
```

Edit `.env` and fill in your Azure AD app registration details:

```env
CLIENT_ID=your-client-id-here
TENANT_ID=your-tenant-id-here
REDIRECT_URI=http://localhost:3000/auth/callback
AUTHORITY=https://login.microsoftonline.com/your-tenant-id-here
API_SCOPES=User.Read,profile,openid,email
PORT=3000
```

### 3. Run Locally

```bash
npm start
```

Visit `http://localhost:3000` in your browser.

For development with auto-reload:

```bash
npm run dev
```

## Azure AD App Registration

### Create App Registration

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Click "New registration"
3. Configure:
   - **Name**: Enterprise Auth Demo Web
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: 
     - Platform: Single-page application (SPA)
     - URI: `http://localhost:3000/auth/callback` (for local dev)
     - Add production URI when deployed

### Configure API Permissions

1. Go to "API permissions"
2. Add permissions:
   - Microsoft Graph → Delegated permissions
     - `User.Read`
     - `profile`
     - `openid`
     - `email`
3. Grant admin consent (if required)

### Configure Authentication

1. Go to "Authentication"
2. Under "Implicit grant and hybrid flows":
   - Enable "ID tokens"
3. Under "Allow public client flows": No
4. Save changes

### Get Configuration Values

From the app registration overview page, copy:
- **Application (client) ID** → `CLIENT_ID`
- **Directory (tenant) ID** → `TENANT_ID`

## Azure Deployment

### Option 1: Azure App Service

#### Using Azure CLI

```bash
# Login to Azure
az login

# Create resource group
az group create --name enterprise-auth-rg --location uksouth

# Create App Service plan
az appservice plan create \
  --name enterprise-auth-plan \
  --resource-group enterprise-auth-rg \
  --sku B1 \
  --is-linux

# Create web app
az webapp create \
  --name enterprise-auth-demo \
  --resource-group enterprise-auth-rg \
  --plan enterprise-auth-plan \
  --runtime "NODE:18-lts"

# Configure app settings
az webapp config appsettings set \
  --name enterprise-auth-demo \
  --resource-group enterprise-auth-rg \
  --settings \
    CLIENT_ID="your-client-id" \
    TENANT_ID="your-tenant-id" \
    AUTHORITY="https://login.microsoftonline.com/your-tenant-id" \
    REDIRECT_URI="https://enterprise-auth-demo.azurewebsites.net/auth/callback" \
    API_SCOPES="User.Read,profile,openid,email"

# Deploy application
az webapp up \
  --name enterprise-auth-demo \
  --resource-group enterprise-auth-rg
```

#### Using VS Code Azure Extension

1. Install "Azure App Service" extension
2. Right-click on `web-app` folder
3. Select "Deploy to Web App..."
4. Follow prompts to create/select App Service
5. Configure environment variables in Azure Portal

### Option 2: Azure Container Apps

```bash
# Build and push Docker image (if using containerization)
docker build -t enterprise-auth-web .
docker tag enterprise-auth-web <your-registry>.azurecr.io/enterprise-auth-web
docker push <your-registry>.azurecr.io/enterprise-auth-web

# Deploy to Container Apps
az containerapp create \
  --name enterprise-auth-demo \
  --resource-group enterprise-auth-rg \
  --image <your-registry>.azurecr.io/enterprise-auth-web \
  --target-port 3000 \
  --ingress external \
  --environment-variables \
    CLIENT_ID="your-client-id" \
    TENANT_ID="your-tenant-id"
```

### Post-Deployment Steps

1. **Update Redirect URI** in Azure AD app registration:
   - Add: `https://your-app-name.azurewebsites.net/auth/callback`
   
2. **Update CORS** (if needed):
   ```bash
   az webapp cors add \
     --name enterprise-auth-demo \
     --resource-group enterprise-auth-rg \
     --allowed-origins '*'
   ```

3. **Enable HTTPS** (enabled by default in Azure App Service)

4. **Configure custom domain** (optional):
   ```bash
   az webapp config hostname add \
     --webapp-name enterprise-auth-demo \
     --resource-group enterprise-auth-rg \
     --hostname your-custom-domain.com
   ```

## API Endpoints

### Public Endpoints

- `GET /` - Main application page
- `GET /api/health` - Health check
- `GET /api/config` - Frontend configuration

### Protected Endpoints (Require Bearer Token)

- `GET /api/user/profile` - Get authenticated user profile
- `GET /api/data` - Get demo protected data
- `POST /api/validate-token` - Validate access token

## Testing with Chrome Custom Tabs

To test SSO from native app:

1. Deploy web app to Azure
2. Native Android app authenticates user and obtains session token from backend
3. Android app opens Chrome Custom Tab with URL:
   ```
   https://your-app.azurewebsites.net/?session_token=<short-lived-token>
   ```
4. Web app exchanges session token for authenticated session
5. User is logged in automatically without prompts

**Session Token Properties**:
- Short-lived (60 seconds)
- Single-use only
- Immediately removed from URL after exchange
- Validated by backend before session creation

## Architecture

```
┌─────────────────┐
│  Native App     │
│  (Android)      │
└────────┬────────┘
         │ Chrome Custom Tabs
         │ + Access Token
         ▼
┌─────────────────┐
│  Web App        │
│  (MSAL.js)      │
├─────────────────┤
│  • Token Check  │
│  • Validation   │
│  • Silent Auth  │
└────────┬────────┘
         │ Bearer Token
         ▼
┌─────────────────┐
│  Backend API    │
│  (Node.js)      │
├─────────────────┤
│  • JWT Verify   │
│  • JWKS Client  │
│  • Protected    │
│    Endpoints    │
└─────────────────┘
```

## Security Considerations

✅ **Token Validation** - All tokens validated using JWKS  
✅ **HTTPS Only** - Production deployment requires HTTPS  
✅ **Content Security Policy** - Restrictive CSP headers configured  
✅ **Helmet.js** - Security headers middleware enabled  
✅ **No Token Logging** - Sensitive data never logged  

## Troubleshooting

### Authentication Fails

1. Check Azure AD app registration redirect URIs match exactly
2. Verify client ID and tenant ID are correct
3. Check browser console for MSAL errors
4. Ensure pop-ups are not blocked

### Token Validation Fails

1. Verify token audience matches client ID
2. Check token issuer matches tenant
3. Ensure system time is synchronized (for expiry checks)
4. Verify JWKS endpoint is accessible

### CORS Errors

1. Configure CORS in Azure App Service settings
2. Ensure allowed origins include your frontend URL
3. Check if credentials are properly configured

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `CLIENT_ID` | Azure AD application (client) ID | `12345678-1234-1234-1234-123456789abc` |
| `TENANT_ID` | Azure AD directory (tenant) ID | `87654321-4321-4321-4321-cba987654321` |
| `AUTHORITY` | Azure AD authority URL | `https://login.microsoftonline.com/<tenant-id>` |
| `REDIRECT_URI` | OAuth redirect URI | `https://your-app.azurewebsites.net/auth/callback` |
| `API_SCOPES` | Required API scopes (comma-separated) | `User.Read,profile,openid` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |

## License

MIT

## Support

For issues and questions related to this PoC, refer to the project documentation.
