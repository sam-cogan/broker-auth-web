# Android to Web App SSO Implementation Guide

## Overview

This document describes how to implement seamless Single Sign-On (SSO) from the Android native app to the web application using Chrome Custom Tabs with a secure session token exchange pattern.

## Architecture

```
┌──────────────────────┐
│   Android Hub App    │
│   (MSAL + Broker)    │
└──────────┬───────────┘
           │ 1. Authenticate
           ▼
┌──────────────────────┐
│ Microsoft            │
│ Authenticator Broker │
└──────────┬───────────┘
           │ 2. Access Token
           ▼
┌──────────────────────┐
│   Android Hub App    │
└──────────┬───────────┘
           │ 3. Request Session Token
           ▼
┌──────────────────────┐
│   Backend API        │
│   (Your Server)      │
└──────────┬───────────┘
           │ 4. Session Token (60s, single-use)
           ▼
┌──────────────────────┐
│   Android Hub App    │
└──────────┬───────────┘
           │ 5. Launch Chrome Custom Tabs
           │    URL: https://webapp/?session_token=xyz
           ▼
┌──────────────────────┐
│   Web Application    │
│   (Browser)          │
└──────────┬───────────┘
           │ 6. Exchange Token for Session
           ▼
┌──────────────────────┐
│   Backend API        │
│   (Validates Token)  │
└──────────┬───────────┘
           │ 7. Session Cookie
           ▼
┌──────────────────────┐
│   Web Application    │
│   (Authenticated)    │
└──────────────────────┘
```

## Why Session Tokens Instead of Access Tokens?

### ❌ Problems with Passing Access Tokens Directly

1. **Security Risk**: Access tokens visible in browser history
2. **Long-lived**: Access tokens valid for hours, dangerous if leaked
3. **Multi-use**: Same token could be intercepted and reused
4. **Scope Issues**: Access token has Graph API scopes, not web app scopes

### ✅ Benefits of Session Token Pattern

1. **Short-lived**: 60 seconds maximum lifetime
2. **Single-use**: Backend invalidates after first exchange
3. **Purpose-built**: Designed specifically for session initialization
4. **Minimal exposure**: Removed from URL immediately
5. **Proper session**: Web app gets HTTP-only session cookie

## Implementation Steps

### Step 1: Authenticate User in Android App

Use MSAL Android with Microsoft Authenticator as broker:

```kotlin
import com.microsoft.identity.client.*

class HubActivity : AppCompatActivity() {
    private lateinit var msalApp: ISingleAccountPublicClientApplication
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize MSAL
        PublicClientApplication.createSingleAccountPublicClientApplication(
            this,
            R.raw.auth_config,
            object : IPublicClientApplication.ISingleAccountApplicationCreatedListener {
                override fun onCreated(application: ISingleAccountPublicClientApplication) {
                    msalApp = application
                }
                
                override fun onError(exception: MsalException) {
                    Log.e("MSAL", "Failed to initialize", exception)
                }
            }
        )
    }
    
    private fun signIn() {
        val parameters = AcquireTokenParameters.Builder()
            .startAuthorizationFromActivity(this)
            .withScopes(listOf("User.Read"))
            .withCallback(object : AuthenticationCallback {
                override fun onSuccess(authenticationResult: IAuthenticationResult) {
                    // User authenticated successfully
                    val accessToken = authenticationResult.accessToken
                    // Proceed to Step 2
                    obtainSessionTokenAndLaunchWeb(accessToken)
                }
                
                override fun onError(exception: MsalException) {
                    Log.e("MSAL", "Authentication failed", exception)
                }
                
                override fun onCancel() {
                    Log.d("MSAL", "Authentication cancelled")
                }
            })
            .build()
        
        msalApp.acquireToken(parameters)
    }
}
```

### Step 2: Request Session Token from Backend

Call your backend API to exchange the access token for a session initialization token:

```kotlin
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

data class SessionTokenResponse(
    val sessionToken: String,
    val expiresAt: Long
)

class BackendApiClient(private val baseUrl: String) {
    private val client = OkHttpClient()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    
    suspend fun createSessionToken(accessToken: String): SessionTokenResponse = 
        withContext(Dispatchers.IO) {
            val requestBody = JSONObject().apply {
                put("access_token", accessToken)
            }.toString().toRequestBody(jsonMediaType)
            
            val request = Request.Builder()
                .url("$baseUrl/api/native/create-session-token")
                .post(requestBody)
                .addHeader("Authorization", "Bearer $accessToken")
                .build()
            
            val response = client.newCall(request).execute()
            
            if (!response.isSuccessful) {
                throw Exception("Failed to create session token: ${response.code}")
            }
            
            val responseBody = response.body?.string() 
                ?: throw Exception("Empty response")
            val json = JSONObject(responseBody)
            
            SessionTokenResponse(
                sessionToken = json.getString("session_token"),
                expiresAt = json.getLong("expires_at")
            )
        }
}
```

### Step 3: Launch Chrome Custom Tabs with Session Token

Open the web app with the session token as a query parameter:

```kotlin
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

private fun obtainSessionTokenAndLaunchWeb(accessToken: String) {
    lifecycleScope.launch {
        try {
            // Call backend to get session token
            val backendApi = BackendApiClient("https://your-backend-api.com")
            val sessionTokenResponse = backendApi.createSessionToken(accessToken)
            
            // Build web app URL with session token
            val webAppUrl = Uri.parse("https://your-app.azurewebsites.net")
                .buildUpon()
                .appendQueryParameter("session_token", sessionTokenResponse.sessionToken)
                .build()
            
            // Launch Chrome Custom Tabs
            launchChromeCustomTabs(webAppUrl)
            
        } catch (e: Exception) {
            Log.e("SSO", "Failed to launch web app with SSO", e)
            // Show error to user
            Toast.makeText(
                this@HubActivity,
                "Failed to launch web app. Please try again.",
                Toast.LENGTH_LONG
            ).show()
        }
    }
}

private fun launchChromeCustomTabs(url: Uri) {
    val builder = CustomTabsIntent.Builder()
    
    // Customize the toolbar color (optional)
    builder.setToolbarColor(ContextCompat.getColor(this, R.color.primary))
    
    // Add share action (optional)
    builder.setShareState(CustomTabsIntent.SHARE_STATE_ON)
    
    // Build and launch
    val customTabsIntent = builder.build()
    customTabsIntent.launchUrl(this, url)
}
```

### Step 4: Handle Edge Cases

Implement proper error handling and edge cases:

```kotlin
class WebAppLauncher(
    private val context: Context,
    private val backendApi: BackendApiClient
) {
    
    /**
     * Launch web app with SSO from authenticated user
     */
    suspend fun launchWebAppWithSSO(accessToken: String) {
        try {
            // Validate we're on the main thread for UI operations
            if (Looper.myLooper() != Looper.getMainLooper()) {
                throw IllegalStateException("Must be called from main thread")
            }
            
            // Show loading indicator
            showLoadingIndicator()
            
            // Get session token from backend
            val sessionTokenResponse = withTimeout(10_000) { // 10 second timeout
                backendApi.createSessionToken(accessToken)
            }
            
            // Validate token hasn't already expired
            if (sessionTokenResponse.expiresAt < System.currentTimeMillis()) {
                throw Exception("Session token expired before launch")
            }
            
            // Build URL
            val webAppUrl = buildWebAppUrl(sessionTokenResponse.sessionToken)
            
            // Launch Chrome Custom Tabs
            launchChromeCustomTabs(webAppUrl)
            
            Log.i("SSO", "Web app launched successfully with SSO")
            
        } catch (e: TimeoutCancellationException) {
            Log.e("SSO", "Timeout getting session token", e)
            showError("Request timed out. Please check your connection.")
            launchWebAppWithoutSSO() // Fallback
            
        } catch (e: Exception) {
            Log.e("SSO", "Failed to launch with SSO", e)
            showError("Failed to initialize SSO. Launching without SSO.")
            launchWebAppWithoutSSO() // Fallback
            
        } finally {
            hideLoadingIndicator()
        }
    }
    
    /**
     * Fallback: Launch web app without SSO (user will need to login)
     */
    private fun launchWebAppWithoutSSO() {
        val webAppUrl = Uri.parse("https://your-app.azurewebsites.net")
        launchChromeCustomTabs(webAppUrl)
    }
    
    private fun buildWebAppUrl(sessionToken: String): Uri {
        return Uri.parse("https://your-app.azurewebsites.net")
            .buildUpon()
            .appendQueryParameter("session_token", sessionToken)
            .build()
    }
    
    private fun launchChromeCustomTabs(url: Uri) {
        val builder = CustomTabsIntent.Builder()
        builder.setToolbarColor(
            ContextCompat.getColor(context, R.color.primary)
        )
        val customTabsIntent = builder.build()
        customTabsIntent.launchUrl(context, url)
    }
    
    private fun showLoadingIndicator() {
        // Show loading UI
    }
    
    private fun hideLoadingIndicator() {
        // Hide loading UI
    }
    
    private fun showError(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
    }
}
```

## Backend API Requirements

Your backend must implement the session token creation endpoint:

### Endpoint: `POST /api/native/create-session-token`

**Request Headers:**
```
Authorization: Bearer <access_token_from_msal>
Content-Type: application/json
```

**Request Body:**
```json
{
  "access_token": "<access_token_from_msal>"
}
```

**Response (Success - 200 OK):**
```json
{
  "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": 1697894523000,
  "expires_in": 60
}
```

**Response (Error - 401 Unauthorized):**
```json
{
  "error": "Invalid or expired access token"
}
```

**Backend Implementation Requirements:**

1. **Validate Access Token**:
   - Verify signature using Azure AD JWKS
   - Check token hasn't expired
   - Validate audience and issuer
   - Verify required scopes are present

2. **Create Session Token**:
   - Generate JWT with claims:
     ```json
     {
       "type": "session_init",
       "sub": "user-oid-from-access-token",
       "name": "User Name",
       "email": "user@example.com",
       "preferred_username": "user@example.com",
       "exp": <current_time + 60 seconds>,
       "iat": <current_time>,
       "jti": "unique-token-id"
     }
     ```
   - Sign with backend secret
   - Store token ID in Redis/cache for single-use validation

3. **Return Response**:
   - Return session token
   - Include expiry timestamp
   - Include expiry duration in seconds

4. **Token Lifecycle**:
   - Token valid for 60 seconds maximum
   - Mark as used when exchanged by web app
   - Reject reuse attempts

## Web App Behavior

The web app is already implemented to handle session tokens:

1. **Detects** `session_token` query parameter
2. **Calls** `POST /api/web/initialize-session` with token
3. **Receives** session cookie from backend
4. **Removes** token from URL immediately
5. **Displays** authenticated view without login prompts

## Testing

### Local Testing Setup

1. **Run Web App Locally:**
   ```bash
   cd web-app
   npm install
   npm start
   # Runs on http://localhost:3000
   ```

2. **Use Android Emulator URL:**
   ```kotlin
   // For Android emulator to reach host machine:
   val webAppUrl = "http://10.0.2.2:3000/?session_token=$sessionToken"
   ```

3. **Mock Session Token for Testing:**
   ```kotlin
   // For testing without backend, use a mock token:
   val mockSessionToken = generateMockSessionToken()
   ```

### Test Scenarios

#### ✅ Happy Path
1. User authenticates in Android app
2. Android app gets session token from backend
3. Android app launches Chrome Custom Tabs
4. Web app loads already authenticated
5. User can access protected features

#### ⏱️ Token Expiry
1. Get session token
2. Wait 61+ seconds
3. Launch web app
4. Should redirect to login (token expired)

#### 🔄 Token Reuse
1. Get session token
2. Launch web app (succeeds)
3. Copy URL with same token
4. Try to use again (should fail)

#### ❌ Network Error
1. Simulate network failure during token request
2. Should show error message
3. Should fallback to launching web app without SSO

#### 🔓 No Auth
1. Launch web app without session token
2. Should show normal login page
3. Standard MSAL.js authentication should work

## Security Considerations

### ✅ Implemented Security Features

1. **Short-lived tokens**: 60 seconds maximum
2. **Single-use**: Backend tracks and rejects reuse
3. **Type validation**: Token must have `type: 'session_init'`
4. **Immediate URL cleanup**: Token removed from browser history
5. **HTTP-only cookies**: Session cookie not accessible to JavaScript
6. **Secure flag**: Cookies only sent over HTTPS (production)
7. **Signature validation**: Backend verifies token signature

### 🚨 Security Best Practices

1. **Never log tokens**: Don't include tokens in logs
2. **HTTPS only**: Use HTTPS for all API calls (production)
3. **Validate token immediately**: Don't store token in Android app
4. **Handle errors gracefully**: Don't expose error details to users
5. **Monitor for abuse**: Track failed token exchange attempts
6. **Rotate secrets**: Regularly rotate token signing keys

## Production Deployment Checklist

### Android App
- [ ] MSAL configured with production tenant
- [ ] Backend API URL configured for production
- [ ] Error handling implemented
- [ ] Fallback to non-SSO launch works
- [ ] Loading indicators implemented
- [ ] Proper timeout handling (10 seconds max)
- [ ] Chrome Custom Tabs color matches branding

### Backend API
- [ ] Session token endpoint implemented
- [ ] Access token validation working
- [ ] Token signing configured
- [ ] Redis/cache for single-use tracking
- [ ] Rate limiting implemented
- [ ] Monitoring and logging configured
- [ ] Error responses don't leak sensitive info

### Web App
- [ ] Deployed to Azure App Service
- [ ] HTTPS enforced
- [ ] Session token exchange endpoint tested
- [ ] Session cookies configured correctly
- [ ] Fallback to normal login works
- [ ] URL cleanup verified
- [ ] Error handling tested

### Integration Testing
- [ ] End-to-end flow tested on real devices
- [ ] Zebra TC53/TC52 devices tested
- [ ] Network error scenarios tested
- [ ] Token expiry tested
- [ ] Token reuse rejection tested
- [ ] Conditional Access policies tested
- [ ] Multiple users tested

## Troubleshooting

### Issue: "Failed to create session token"

**Possible Causes:**
- Backend API unreachable
- Access token invalid or expired
- Network connectivity issues
- Backend rate limiting

**Solutions:**
- Check network connectivity
- Verify backend API URL is correct
- Check access token is valid
- Implement retry logic with exponential backoff

### Issue: "Session token expired before launch"

**Possible Causes:**
- Slow backend response
- Device clock skew
- Network latency

**Solutions:**
- Reduce time between token request and launch
- Check device clock is synchronized
- Increase token lifetime to 90 seconds (if acceptable)

### Issue: "Chrome Custom Tabs not opening"

**Possible Causes:**
- Chrome not installed on device
- Invalid URL format
- App doesn't have internet permission

**Solutions:**
- Check Chrome is installed
- Add fallback to default browser
- Verify AndroidManifest.xml has INTERNET permission

### Issue: "Web app shows login page instead of authenticated view"

**Possible Causes:**
- Session token not in URL
- Token expired
- Token already used
- Backend validation failed

**Solutions:**
- Check URL contains `session_token` parameter
- Verify token hasn't expired
- Check backend logs for validation errors
- Ensure token is marked as `type: 'session_init'`

## Support and Documentation

- **Web App Docs**: `/web-app/SETUP.md`
- **Browser Integration**: `/docs/browser-integration-strategy.md`
- **PoC Requirements**: `/docs/poc-requirements.md`
- **Problem Statement**: `/docs/problem-statement.md`

## Example: Complete Flow

```kotlin
class MainActivity : AppCompatActivity() {
    private lateinit var msalApp: ISingleAccountPublicClientApplication
    private lateinit var webAppLauncher: WebAppLauncher
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Initialize MSAL
        initializeMSAL()
        
        // Initialize web app launcher
        val backendApi = BackendApiClient("https://your-backend.azurewebsites.net")
        webAppLauncher = WebAppLauncher(this, backendApi)
        
        // Button to launch web app
        findViewById<Button>(R.id.launchWebAppButton).setOnClickListener {
            launchWebAppWithSSO()
        }
    }
    
    private fun initializeMSAL() {
        PublicClientApplication.createSingleAccountPublicClientApplication(
            this,
            R.raw.auth_config,
            object : IPublicClientApplication.ISingleAccountApplicationCreatedListener {
                override fun onCreated(application: ISingleAccountPublicClientApplication) {
                    msalApp = application
                    checkForExistingAccount()
                }
                
                override fun onError(exception: MsalException) {
                    Log.e("MSAL", "Failed to initialize", exception)
                }
            }
        )
    }
    
    private fun checkForExistingAccount() {
        msalApp.getCurrentAccountAsync(object : ISingleAccountPublicClientApplication.CurrentAccountCallback {
            override fun onAccountLoaded(account: IAccount?) {
                if (account != null) {
                    // User already signed in
                    Log.d("MSAL", "User already signed in: ${account.username}")
                } else {
                    // Prompt for sign in
                    signIn()
                }
            }
            
            override fun onAccountChanged(priorAccount: IAccount?, currentAccount: IAccount?) {
                // Handle account changes
            }
            
            override fun onError(exception: MsalException) {
                Log.e("MSAL", "Error loading account", exception)
            }
        })
    }
    
    private fun signIn() {
        val parameters = AcquireTokenParameters.Builder()
            .startAuthorizationFromActivity(this)
            .withScopes(listOf("User.Read"))
            .withCallback(object : AuthenticationCallback {
                override fun onSuccess(authenticationResult: IAuthenticationResult) {
                    Log.d("MSAL", "Authentication successful")
                }
                
                override fun onError(exception: MsalException) {
                    Log.e("MSAL", "Authentication failed", exception)
                }
                
                override fun onCancel() {
                    Log.d("MSAL", "Authentication cancelled")
                }
            })
            .build()
        
        msalApp.acquireToken(parameters)
    }
    
    private fun launchWebAppWithSSO() {
        // Get current access token silently
        lifecycleScope.launch {
            try {
                val result = msalApp.acquireTokenSilentAsync(
                    arrayOf("User.Read"),
                    msalApp.currentAccount?.authority
                ).await()
                
                // Launch web app with SSO
                webAppLauncher.launchWebAppWithSSO(result.accessToken)
                
            } catch (e: Exception) {
                Log.e("SSO", "Failed to get token", e)
                // Fallback: launch without SSO
                webAppLauncher.launchWebAppWithoutSSO()
            }
        }
    }
}
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-14  
**Status**: Ready for Implementation
