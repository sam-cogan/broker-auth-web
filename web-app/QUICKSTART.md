# Quick Start Guide - Enterprise SSO Demo Web App

Get the web app running locally in under 5 minutes.

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
cd web-app
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your Azure AD details
```

Required values from Azure AD:
- `CLIENT_ID` - Application (client) ID
- `TENANT_ID` - Directory (tenant) ID

### 3. Run Locally
```bash
npm start
```

Visit: http://localhost:3000

## 📋 Azure AD Setup (2 minutes)

1. Go to [Azure Portal](https://portal.azure.com) → Azure AD → App registrations
2. Create new registration:
   - Name: `Enterprise Auth Demo - Web`
   - Redirect URI: `http://localhost:3000/auth/callback` (SPA type)
3. Add API permissions: `User.Read`, `profile`, `openid`
4. Copy Client ID and Tenant ID to `.env`

## ☁️ Deploy to Azure (1 command)

```bash
az webapp up \
  --name enterprise-auth-demo-web \
  --resource-group enterprise-auth-rg \
  --runtime "NODE:18-lts"
```

Then configure app settings in Azure Portal.

## 🧪 Test SSO

Open web app with token parameter:
```
https://your-app.azurewebsites.net/?access_token=YOUR_TOKEN
```

## 📚 Full Documentation

- **[README.md](README.md)** - Complete feature overview
- **[SETUP.md](SETUP.md)** - Detailed setup guide with troubleshooting

## 🆘 Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| Login fails | Check redirect URI matches Azure AD exactly |
| Token invalid | Verify CLIENT_ID and TENANT_ID are correct |
| API errors | Ensure API permissions are granted in Azure AD |
| Can't deploy | Verify Azure CLI is installed and logged in |

## 🔗 Useful Links

- [Azure Portal](https://portal.azure.com)
- [Azure AD App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)

---

**Need help?** Check [SETUP.md](SETUP.md) for detailed instructions.
