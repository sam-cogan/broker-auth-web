# Web Application Component - PoC Documentation

## Overview

The web application component demonstrates seamless Entra ID authentication with support for both standard browser-based authentication and SSO token injection from the native Android app via Chrome Custom Tabs.

## Location

```
/web-app/
├── server.js           # Node.js/Express backend
├── public/
│   ├── index.html      # Frontend application
│   ├── app.js          # MSAL.js authentication logic
│   └── styles.css      # UI styling
├── package.json        # Dependencies
├── .env.example        # Environment template
├── README.md           # Feature overview
├── SETUP.md            # Detailed setup guide
└── QUICKSTART.md       # 5-minute quick start
```

## Key Features

### ✅ Implemented Features

1. **MSAL.js Browser Authentication**
   - Standard OAuth 2.0 / OpenID Connect flow
   - Silent SSO via `ssoSilent()` method
   - Popup and redirect authentication support
   - Automatic token refresh

2. **Chrome Custom Tabs Integration (Primary)**
   - Token parameter detection in URL
   - Backend token validation
   - Automatic authentication without prompts
   - URL cleanup after token processing
   - **Note**: No JavaScript bridge for native functionality (barcode scanning, printing)

3. **WebView Integration (Secondary, If Implemented)**
   - JavaScript interface for token injection
   - Supports native-to-web bridging for device features
   - Alternative approach for apps requiring native functionality
   - **Status**: To be investigated if time permits during PoC

4. **Backend Token Validation**
   - JWT verification using JWKS
   - Audience and issuer validation
   - Token expiry checking
   - Secure API endpoints

5. **Protected API Endpoints**
   - User profile retrieval
   - Demo data endpoints
   - Token validation endpoint
   - Health check endpoint

6. **Azure Deployment Ready**
   - Azure App Service configuration
   - Environment variable management
   - HTTPS enforcement
   - Security headers (Helmet.js)

## Authentication Flow

### Standard Web Authentication Flow

```
User → Web App → MSAL.js → Azure AD Login
                              ↓
User ← Web App ← Access Token ← Azure AD
```

### SSO Flow from Native App (Chrome Custom Tabs - Primary)

```
Native App → Obtains Token → Chrome Custom Tabs
                                     ↓
Web App ← Token in URL ← Opens with Token
    ↓
Backend Validates Token
    ↓
User Authenticated (No Login Prompt)
```

**Limitation**: No JavaScript bridge for native features (barcode scanning, printing)

### Alternative Flow via WebView (Secondary, If Time Permits)

```
Native App → Obtains Token → WebView with JS Bridge
                                     ↓
Web App ← Token via JS Interface ← addJavascriptInterface()
    ↓
Backend Validates Token + Native Bridging Available
    ↓
User Authenticated + Device Features Accessible
```

**Advantage**: Maintains native-to-web bridging for critical functionality

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Backend Runtime | Node.js | 18.x LTS |
| Web Framework | Express | 4.18.x |
| Authentication Library | MSAL.js | 2.38.x |
| Token Validation | jsonwebtoken + jwks-rsa | Latest |
| Security | Helmet.js | 7.x |
| Frontend | Vanilla JavaScript | ES6+ |

## Azure AD Configuration

### Required App Registration Settings

- **Platform**: Single-page application (SPA)
- **Redirect URIs**: 
  - Local: `http://localhost:3000/auth/callback`
  - Production: `https://your-app.azurewebsites.net/auth/callback`
- **API Permissions**:
  - `User.Read` (Microsoft Graph)
  - `profile` (OpenID)
  - `openid` (OpenID)
  - `email` (OpenID)
- **Token Configuration**: ID tokens enabled

## Environment Variables

### Required Configuration

```env
CLIENT_ID=<azure-ad-application-id>
TENANT_ID=<azure-ad-tenant-id>
AUTHORITY=https://login.microsoftonline.com/<tenant-id>
REDIRECT_URI=<app-url>/auth/callback
API_SCOPES=User.Read,profile,openid,email
PORT=3000
NODE_ENV=production
```

## API Endpoints

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main application page |
| `/api/health` | GET | Health check |
| `/api/config` | GET | Frontend configuration |

### Protected Endpoints (Require Bearer Token)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/profile` | GET | User profile data |
| `/api/data` | GET | Demo protected data |
| `/api/validate-token` | POST | Token validation |

## Deployment Options

### Local Development
```bash
cd web-app
npm install
cp .env.example .env
# Configure .env
npm start
```

### Azure App Service (Recommended)
```bash
az webapp up \
  --name enterprise-auth-demo-web \
  --resource-group enterprise-auth-rg \
  --runtime "NODE:18-lts"
```

### Docker (Alternative)
```bash
docker build -t enterprise-auth-web .
docker run -p 3000:3000 --env-file .env enterprise-auth-web
```

## Security Considerations

### ✅ Implemented Security Measures

1. **Token Validation**
   - JWKS-based signature verification
   - Audience validation (CLIENT_ID)
   - Issuer validation (Azure AD tenant)
   - Expiry checking

2. **Security Headers**
   - Content Security Policy
   - HSTS (HTTPS Strict Transport Security)
   - X-Frame-Options
   - X-Content-Type-Options

3. **CORS Configuration**
   - Restricted to known origins
   - Credentials support where needed

4. **Token Storage**
   - localStorage for browser tokens
   - No sensitive data in cookies
   - Automatic token cleanup

5. **Error Handling**
   - No sensitive information in error messages
   - Debug mode only in development
   - Secure logging practices

### ⚠️ Production Considerations

- Use Azure Key Vault for CLIENT_SECRET (if needed)
- Enable Application Insights for monitoring
- Configure custom domain with SSL certificate
- Implement rate limiting for API endpoints
- Set up Azure Front Door or CDN for performance
- Review and optimize Conditional Access policies

## Testing the Web App

### Manual Testing Checklist

- [ ] Standard login works
- [ ] Profile data retrieval works
- [ ] Protected endpoints return data
- [ ] Logout redirects correctly
- [ ] Token refresh works silently
- [ ] SSO from URL token parameter works
- [ ] Invalid token handling works
- [ ] Error messages are user-friendly

### SSO Integration Testing

1. **Obtain Access Token** (from native app or manually)
2. **Construct URL**: `https://your-app.com/?access_token=<token>`
3. **Open in Chrome Custom Tabs**
4. **Verify**:
   - No login prompt appears
   - User is authenticated immediately
   - Token is validated and accepted
   - URL is cleaned (token removed)
   - Protected content loads

## Integration with Native App

### Chrome Custom Tabs Integration (Primary Approach)

#### Native App Requirements

The native Android app must:

1. Obtain a valid access token from Azure AD
2. Construct the web app URL with token parameter:
   ```kotlin
   val webAppUrl = "https://your-app.com/?access_token=$accessToken"
   ```
3. Launch Chrome Custom Tabs with the URL:
   ```kotlin
   val builder = CustomTabsIntent.Builder()
   val customTabsIntent = builder.build()
   customTabsIntent.launchUrl(context, Uri.parse(webAppUrl))
   ```

#### Limitations

- **No JavaScript Bridge**: Cannot pass native events (barcode scans, print commands) to web app
- **Best For**: Web apps without native dependency requirements
- **Trade-off**: Better authentication experience vs. native functionality access

### WebView Integration (Alternative Approach, If Implemented)

#### Native App Requirements

The native Android app would:

1. Obtain a valid access token from Azure AD
2. Create WebView with JavaScript interface:
   ```kotlin
   webView.settings.javaScriptEnabled = true
   
   val authBridge = object {
       @JavascriptInterface
       fun getAccessToken(): String = accessToken
       
       @JavascriptInterface
       fun onBarcodeScanned(barcode: String) {
           // Native scanner event
       }
   }
   
   webView.addJavascriptInterface(authBridge, "AndroidBridge")
   webView.loadUrl("https://your-app.com")
   ```

3. Web app retrieves token via JavaScript:
   ```javascript
   const token = window.AndroidBridge.getAccessToken();
   // Use token for authentication
   ```

#### Advantages

- **JavaScript Bridge Available**: Native-to-web communication for device features
- **Best For**: Web apps requiring barcode scanning, printing, or other native functionality
- **Trade-off**: Native functionality access vs. less optimal browser experience

### Browser Integration Strategy

See **[Browser Integration Strategy Documentation](browser-integration-strategy.md)** for comprehensive details on:
- Chrome Custom Tabs vs WebView trade-offs
- Native-to-web bridging requirements
- Trusted Web Activities exploration
- Migration strategy for production

### Current PoC Scope

**Phase 1** (Days 1-3): Chrome Custom Tabs implementation  
**Phase 2** (Day 4, if time permits): WebView approach investigation  
**Phase 3** (Stretch goal): Trusted Web Activities research

### Token Format

The web app expects:
- **URL Parameter**: `?access_token=<token>` or `?token=<token>`
- **Token Type**: Azure AD access token (Bearer)
- **Valid Audience**: Must match web app's CLIENT_ID
- **Valid Issuer**: Azure AD tenant

## Troubleshooting Guide

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Login redirect loop | Redirect URI mismatch | Verify URI in Azure AD and .env match exactly |
| Token validation fails | Wrong CLIENT_ID/TENANT_ID | Check environment variables |
| CORS errors | Origin not allowed | Configure CORS in backend |
| SSO doesn't work | Invalid token from native app | Verify token audience and expiry |
| Profile data missing | Missing API permissions | Grant User.Read in Azure AD |

### Debug Mode

Enable detailed logging in development:

```javascript
// In app.js, MSAL config
loggerOptions: {
  logLevel: 'Verbose',
  loggerCallback: (level, message) => {
    console.log(`[MSAL ${level}] ${message}`);
  }
}
```

### Backend Logs

Check server logs for detailed error information:

```bash
# Local
npm start  # Check console output

# Azure
az webapp log tail --name your-app-name --resource-group your-rg
```

## Performance Considerations

- **Token Caching**: Tokens cached in localStorage for fast retrieval
- **Silent Authentication**: Avoids unnecessary interactive prompts
- **Static Assets**: Served with proper cache headers
- **API Response Time**: Minimal backend processing for token validation
- **CDN Integration**: Can use Azure CDN for static content

## Monitoring & Logging

### Recommended Monitoring

1. **Application Insights** (Azure)
   - Track authentication success/failure rates
   - Monitor API endpoint performance
   - Alert on token validation errors

2. **Metrics to Track**
   - Authentication success rate
   - Token validation failures
   - API response times
   - Error rates by endpoint

3. **Logging Strategy**
   - Info: Authentication attempts
   - Warning: Token validation failures
   - Error: API errors, unexpected failures
   - Never log: Actual tokens or secrets

## Next Steps

1. ✅ Complete - Web app built and ready for deployment
2. 🔄 In Progress - Integration with native hub app
3. ⏳ Pending - Chrome Custom Tabs authentication testing
4. ⏳ Pending - WebView approach investigation (if time permits)
5. ⏳ Pending - Trusted Web Activities research (stretch goal)
6. ⏳ Pending - End-to-end SSO testing
7. ⏳ Pending - Demo preparation

## Documentation Links

- **[Web App README](../web-app/README.md)** - Feature overview and architecture
- **[Setup Guide](../web-app/SETUP.md)** - Detailed deployment instructions
- **[Quick Start](../web-app/QUICKSTART.md)** - 5-minute setup guide
- **[Browser Integration Strategy](browser-integration-strategy.md)** - Chrome Custom Tabs vs WebView analysis
- **[PoC Requirements](poc-requirements.md)** - Overall PoC specifications
- **[Problem Statement](problem-statement.md)** - Business context

## Support

For issues or questions:
1. Check the [SETUP.md troubleshooting section](../web-app/SETUP.md#troubleshooting)
2. Review Azure App Service logs
3. Check browser console for client-side errors
4. Verify Azure AD configuration

---

**Status**: ✅ Complete and ready for deployment
**Last Updated**: 2025-10-09
**Component Owner**: PoC Development Team
