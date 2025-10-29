# Android SSO Implementation - Quick Reference for Copilot

## Context
Implementing seamless Single Sign-On from Android native app to web application via Chrome Custom Tabs using a secure session token exchange pattern.

## Implementation Steps

### 1. After MSAL Authentication, Request Session Token

```kotlin
// After successful MSAL authentication:
val accessToken = authResult.accessToken

// Call backend API to get session token
suspend fun getSessionToken(accessToken: String): String {
    val client = OkHttpClient()
    val requestBody = JSONObject().apply {
        put("access_token", accessToken)
    }.toString().toRequestBody("application/json".toMediaType())
    
    val request = Request.Builder()
        .url("https://your-backend-api.com/api/native/create-session-token")
        .post(requestBody)
        .addHeader("Authorization", "Bearer $accessToken")
        .build()
    
    val response = client.newCall(request).execute()
    if (!response.isSuccessful) throw Exception("Failed to get session token")
    
    val json = JSONObject(response.body?.string() ?: "")
    return json.getString("session_token")
}
```

### 2. Launch Chrome Custom Tabs with Session Token

```kotlin
import androidx.browser.customtabs.CustomTabsIntent
import android.net.Uri

fun launchWebAppWithSSO(sessionToken: String) {
    // Build URL with session token as query parameter
    val webAppUrl = Uri.parse("https://your-app.azurewebsites.net")
        .buildUpon()
        .appendQueryParameter("session_token", sessionToken)
        .build()
    
    // Create and launch Chrome Custom Tabs
    val builder = CustomTabsIntent.Builder()
    builder.setToolbarColor(ContextCompat.getColor(context, R.color.primary))
    val customTabsIntent = builder.build()
    customTabsIntent.launchUrl(context, webAppUrl)
}
```

### 3. Complete Flow with Error Handling

```kotlin
private fun launchWebAppWithSSO() {
    lifecycleScope.launch {
        try {
            // Show loading
            showLoading(true)
            
            // Get access token silently from MSAL
            val tokenResult = msalApp.acquireTokenSilentAsync(
                arrayOf("User.Read"),
                msalApp.currentAccount?.authority
            ).await()
            
            // Get session token from backend
            val sessionToken = withTimeout(10_000) { // 10 second timeout
                getSessionToken(tokenResult.accessToken)
            }
            
            // Build web app URL
            val webAppUrl = Uri.parse("https://your-app.azurewebsites.net")
                .buildUpon()
                .appendQueryParameter("session_token", sessionToken)
                .build()
            
            // Launch Chrome Custom Tabs
            val customTabsIntent = CustomTabsIntent.Builder()
                .setToolbarColor(ContextCompat.getColor(this@MainActivity, R.color.primary))
                .build()
            customTabsIntent.launchUrl(this@MainActivity, webAppUrl)
            
        } catch (e: TimeoutCancellationException) {
            Log.e("SSO", "Timeout getting session token", e)
            // Fallback: launch without SSO
            launchWebAppWithoutSSO()
            
        } catch (e: Exception) {
            Log.e("SSO", "Failed to launch with SSO", e)
            // Fallback: launch without SSO
            launchWebAppWithoutSSO()
            
        } finally {
            showLoading(false)
        }
    }
}

private fun launchWebAppWithoutSSO() {
    val webAppUrl = Uri.parse("https://your-app.azurewebsites.net")
    CustomTabsIntent.Builder().build().launchUrl(this, webAppUrl)
}
```

## Backend API Contract

### Endpoint: `POST /api/native/create-session-token`

**Request:**
```json
{
  "access_token": "eyJ0eXAi..."
}
```

**Headers:**
```
Authorization: Bearer eyJ0eXAi...
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "session_token": "eyJhbGciOiJIUzI1NiI...",
  "expires_at": 1697894523000,
  "expires_in": 60
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid or expired access token"
}
```

## Web App Behavior

The web app automatically:
1. Detects `session_token` query parameter
2. Calls `POST /api/web/initialize-session` to exchange token for session
3. Receives HTTP-only session cookie
4. Removes token from URL (security)
5. Shows authenticated view without login prompts

## Security Features

- **Short-lived**: Session token valid for 60 seconds only
- **Single-use**: Backend marks token as used after first exchange
- **Immediate cleanup**: Token removed from browser URL/history
- **Fallback**: If SSO fails, web app shows normal login

## Testing

### Local Development
```kotlin
// For Android emulator to reach host machine:
val localUrl = Uri.parse("http://10.0.2.2:3000")
    .buildUpon()
    .appendQueryParameter("session_token", sessionToken)
    .build()
```

### Test Scenarios
1. ✅ Happy path: Auth → Get token → Launch → Auto-login
2. ⏱️ Timeout: Wait 61+ seconds before launch → Shows login
3. ❌ Network error: Backend unreachable → Fallback to normal launch
4. 🔄 Token reuse: Use same token twice → Second attempt fails

## Dependencies

Add to `build.gradle`:
```gradle
dependencies {
    // MSAL for Android
    implementation 'com.microsoft.identity.client:msal:4.+'
    
    // Chrome Custom Tabs
    implementation 'androidx.browser:browser:1.7.0'
    
    // OkHttp for API calls
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    
    // Coroutines
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
}
```

## AndroidManifest.xml

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    
    <application>
        <!-- Your activities -->
    </application>
</manifest>
```

## Expected User Experience

1. User clicks "Open Web App" button in Android app
2. Brief loading indicator (1-2 seconds)
3. Chrome Custom Tabs opens with web app
4. **No login prompt** - user is already authenticated
5. Web app displays personalized content immediately

## Troubleshooting

### "Failed to create session token"
- Check backend API URL is correct
- Verify access token is valid
- Check network connectivity

### "Web app shows login page"
- Check URL contains `session_token` parameter
- Verify token hasn't expired (>60 seconds)
- Check backend logs for validation errors

### "Chrome Custom Tabs not opening"
- Verify Chrome is installed on device
- Add fallback to default browser
- Check INTERNET permission in manifest

## Complete Example

See `/docs/android-web-sso-implementation.md` for complete implementation with:
- Full error handling
- Loading indicators
- Retry logic
- MSAL setup
- Testing guide

---

**Copy this entire document and paste into your Android IDE's Copilot chat to get implementation assistance.**
