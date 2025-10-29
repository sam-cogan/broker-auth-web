# Pass This to Copilot in Android Studio

## Context
We're implementing SSO between our Android native app and web app. The native app uses Entra ID authentication via the Authenticator app broker. Users currently have to authenticate again when launching the web app in Chrome Custom Tab, and we need to eliminate this friction.

## Solution Overview
The Android app will obtain a short-lived session initialization token from our backend and pass it to the web app via URL query parameter. The web app will exchange this token for a proper authenticated session.

## What You Need to Implement

### 1. After MSAL Authentication - Request Session Token

```kotlin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import kotlinx.coroutines.*

suspend fun getSessionToken(accessToken: String): String = withContext(Dispatchers.IO) {
    val client = OkHttpClient()
    val mediaType = "application/json; charset=utf-8".toMediaType()
    
    val requestBody = JSONObject().apply {
        put("access_token", accessToken)
    }.toString().toRequestBody(mediaType)
    
    val request = Request.Builder()
        .url("https://your-backend-api.com/api/native/create-session-token")
        .post(requestBody)
        .addHeader("Authorization", "Bearer $accessToken")
        .addHeader("Content-Type", "application/json")
        .build()
    
    val response = client.newCall(request).execute()
    
    if (!response.isSuccessful) {
        throw Exception("Failed to get session token: ${response.code}")
    }
    
    val responseBody = response.body?.string() ?: throw Exception("Empty response")
    val json = JSONObject(responseBody)
    
    return@withContext json.getString("session_token")
}
```

### 2. Launch Chrome Custom Tabs with Session Token

```kotlin
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat
import android.net.Uri

fun launchWebAppWithSSO(context: Context, sessionToken: String) {
    // Build URL with session token as query parameter
    val webAppUrl = Uri.parse("https://your-app.azurewebsites.net")
        .buildUpon()
        .appendQueryParameter("session_token", sessionToken)
        .build()
    
    // Create Chrome Custom Tabs intent
    val builder = CustomTabsIntent.Builder()
    builder.setToolbarColor(ContextCompat.getColor(context, R.color.primary))
    
    val customTabsIntent = builder.build()
    customTabsIntent.launchUrl(context, webAppUrl)
}
```

### 3. Complete Implementation with Error Handling

```kotlin
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.TimeoutCancellationException
import android.util.Log
import android.widget.Toast

class MainActivity : AppCompatActivity() {
    
    private fun launchWebAppWithSSO() {
        lifecycleScope.launch {
            try {
                // Show loading indicator
                showLoading(true)
                
                // Get access token from MSAL (silently if already authenticated)
                val tokenResult = msalApp.acquireTokenSilentAsync(
                    arrayOf("User.Read"),
                    msalApp.currentAccount?.authority
                ).await()
                
                // Request session token from backend (with 10 second timeout)
                val sessionToken = withTimeout(10_000) {
                    getSessionToken(tokenResult.accessToken)
                }
                
                // Build web app URL with session token
                val webAppUrl = Uri.parse("https://your-app.azurewebsites.net")
                    .buildUpon()
                    .appendQueryParameter("session_token", sessionToken)
                    .build()
                
                // Launch Chrome Custom Tabs
                val customTabsIntent = CustomTabsIntent.Builder()
                    .setToolbarColor(ContextCompat.getColor(this@MainActivity, R.color.primary))
                    .build()
                customTabsIntent.launchUrl(this@MainActivity, webAppUrl)
                
                Log.i("SSO", "Web app launched with SSO")
                
            } catch (e: TimeoutCancellationException) {
                Log.e("SSO", "Timeout getting session token", e)
                Toast.makeText(this@MainActivity, "Request timed out", Toast.LENGTH_SHORT).show()
                // Fallback: launch without SSO
                launchWebAppWithoutSSO()
                
            } catch (e: Exception) {
                Log.e("SSO", "Failed to launch with SSO", e)
                Toast.makeText(this@MainActivity, "SSO failed, launching normally", Toast.LENGTH_SHORT).show()
                // Fallback: launch without SSO
                launchWebAppWithoutSSO()
                
            } finally {
                showLoading(false)
            }
        }
    }
    
    private fun launchWebAppWithoutSSO() {
        // Fallback: launch web app without session token
        val webAppUrl = Uri.parse("https://your-app.azurewebsites.net")
        val customTabsIntent = CustomTabsIntent.Builder().build()
        customTabsIntent.launchUrl(this, webAppUrl)
    }
    
    private fun showLoading(show: Boolean) {
        // Your loading indicator logic
    }
}
```

## Backend API Contract

### Endpoint: `POST /api/native/create-session-token`

**Request Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLC..."
}
```

**Success Response (200 OK):**
```json
{
  "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": 1697894523000,
  "expires_in": 60
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "Invalid or expired access token"
}
```

## How It Works

### Flow Diagram
```
1. Android App
   ↓ (MSAL Authentication)
2. Microsoft Authenticator Broker
   ↓ (Access Token)
3. Android App
   ↓ (POST /api/native/create-session-token)
4. Backend API
   ↓ (Session Token - 60 seconds, single-use)
5. Android App
   ↓ (Launch Chrome Custom Tabs with ?session_token=xyz)
6. Web Application
   ↓ (POST /api/web/initialize-session)
7. Backend API
   ↓ (Validates token, sets session cookie)
8. Web Application - AUTHENTICATED ✅
```

### Web App Behavior (Already Implemented)
The web app automatically:
1. Detects `session_token` query parameter in URL
2. Calls `POST /api/web/initialize-session` to exchange token
3. Receives HTTP-only session cookie from backend
4. Removes token from URL (security - won't appear in history)
5. Shows authenticated view without login prompts

## Security Features

✅ **Short-lived**: Session token valid for only 60 seconds  
✅ **Single-use**: Backend marks token as used after first exchange  
✅ **Type-validated**: Token must have `type: 'session_init'` claim  
✅ **Immediate cleanup**: Token removed from browser URL/history  
✅ **HTTP-only cookie**: Session cookie not accessible to JavaScript  
✅ **Secure flag**: Cookies only sent over HTTPS in production  
✅ **Fallback**: If SSO fails, user sees normal login page

## Testing

### For Local Development
```kotlin
// For Android emulator to reach host machine (localhost):
val localUrl = Uri.parse("http://10.0.2.2:3000")
    .buildUpon()
    .appendQueryParameter("session_token", sessionToken)
    .build()
```

### Test Scenarios
1. ✅ **Happy path**: Auth → Get token → Launch → Auto-login works
2. ⏱️ **Timeout**: Wait 61+ seconds before launch → Should redirect to login
3. ❌ **Network error**: Backend unreachable → Fallback to normal launch
4. 🔄 **Token reuse**: Try to use same token twice → Second attempt fails

## Dependencies

Add to `build.gradle`:
```gradle
dependencies {
    // MSAL for Android
    implementation 'com.microsoft.identity.client:msal:4.+'
    
    // Chrome Custom Tabs
    implementation 'androidx.browser:browser:1.7.0'
    
    // OkHttp for HTTP requests
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    
    // Kotlin Coroutines
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
    
    // JSON handling
    implementation 'org.json:json:20230227'
}
```

## AndroidManifest.xml

Ensure you have internet permission:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    
    <application>
        <!-- Your activities -->
    </application>
</manifest>
```

## Expected User Experience

1. User taps "Open Web App" button
2. Brief loading indicator (1-2 seconds)
3. Chrome Custom Tabs opens
4. **No login prompt** - user already authenticated
5. Web app displays personalized content immediately

## Troubleshooting

### "Failed to create session token"
- Check backend API URL is correct
- Verify access token is valid
- Check device has internet connectivity
- Check backend logs for errors

### "Web app shows login page instead of authenticated view"
- Verify URL contains `session_token` parameter (check logs)
- Ensure token hasn't expired (>60 seconds between request and launch)
- Check backend logs for token validation errors
- Confirm token has `type: 'session_init'` claim

### "Chrome Custom Tabs not opening"
- Verify Chrome browser is installed on device
- Check `androidx.browser:browser` dependency is added
- Verify INTERNET permission in AndroidManifest.xml
- Try fallback to default browser intent

## Additional Documentation

For more detailed information:
- **Complete guide**: `/docs/android-web-sso-implementation.md`
- **Web app setup**: `/web-app/SETUP.md`
- **Browser strategy**: `/docs/browser-integration-strategy.md`

---

**Copy this entire document and paste into Android Studio's Copilot chat to get implementation assistance.**

Quick request: "Implement the SSO flow described in this document. Start with the session token request function, then the Chrome Custom Tabs launch, and finally integrate it into the main activity with proper error handling."
