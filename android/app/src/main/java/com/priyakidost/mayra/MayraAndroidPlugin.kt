/**
 * ═══════════════════════════════════════════════════════════
 * MayraAndroidPlugin.kt — Capacitor plugin
 * Exposes native device capabilities to the WebView JS layer.
 *
 * Registered in MainActivity.kt:  registerPlugin(MayraAndroidPlugin::class.java)
 *
 * The JS side accesses this via:
 *   window.Capacitor.Plugins.MayraAndroid.<method>(args)
 * ═══════════════════════════════════════════════════════════
 */
package com.priyakidost.mayra

import android.Manifest
import android.content.Intent
import android.net.Uri
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "MayraAndroid",
    permissions = [
        Permission(alias = "microphone", strings = [Manifest.permission.RECORD_AUDIO]),
        Permission(
            alias = "location",
            strings = [
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ]
        )
    ]
)
class MayraAndroidPlugin : Plugin() {

    // ── openApp ──────────────────────────────────────────────
    @PluginMethod
    fun openApp(call: PluginCall) {
        val appName = call.getString("appName") ?: run {
            call.reject("appName required"); return
        }
        val packageMap = mapOf(
            "whatsapp"  to "com.whatsapp",
            "youtube"   to "com.google.android.youtube",
            "instagram" to "com.instagram.android",
            "chrome"    to "com.android.chrome",
            "spotify"   to "com.spotify.music",
            "gmail"     to "com.google.android.gm",
            "maps"      to "com.google.android.apps.maps",
        )
        val pkg = packageMap.entries
            .firstOrNull { appName.contains(it.key, ignoreCase = true) }
            ?.value

        if (pkg != null) {
            val intent = activity.packageManager.getLaunchIntentForPackage(pkg)
            if (intent != null) {
                activity.startActivity(intent)
                call.resolve(JSObject().put("success", true))
            } else {
                // Not installed — open Play Store
                val storeIntent = Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=$pkg"))
                activity.startActivity(storeIntent)
                call.resolve(JSObject().put("success", false).put("reason", "not_installed"))
            }
        } else if (appName.contains("settings", ignoreCase = true)) {
            activity.startActivity(Intent(android.provider.Settings.ACTION_SETTINGS))
            call.resolve(JSObject().put("success", true))
        } else {
            call.resolve(JSObject().put("success", false).put("reason", "not_found"))
        }
    }

    // ── openUrl ───────────────────────────────────────────────
    @PluginMethod
    fun openUrl(call: PluginCall) {
        val url = call.getString("url") ?: run { call.reject("url required"); return }
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        activity.startActivity(intent)
        call.resolve(JSObject().put("success", true))
    }

    // ── makeCall ──────────────────────────────────────────────
    @PluginMethod
    fun makeCall(call: PluginCall) {
        val number = call.getString("phoneNumber") ?: run { call.reject("phoneNumber required"); return }
        val act = activity
        if (act == null) {
            // No activity to launch the dialer from — never crash.
            call.resolve(JSObject().put("success", false).put("error", "no_activity"))
            return
        }
        // ACTION_DIAL only OPENS the dialer prefilled (no CALL_PHONE permission,
        // no auto-dial). This is intentional and safe. We additionally report
        // WHICH intent was used and the resolved tel: URI so the on-screen
        // debug panel can show exactly what happened (DIAGNOSTICS).
        val telUri = "tel:+$number"
        try {
            // Use ACTION_DIAL (no CALL_PHONE permission needed)
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse(telUri))
            act.startActivity(intent)
            call.resolve(
                JSObject()
                    .put("success", true)
                    .put("intent", "ACTION_DIAL")
                    .put("uri", telUri)
            )
        } catch (e: Exception) {
            // ActivityNotFoundException / SecurityException / anything else — resolve safely.
            // Surface the exception CLASS + message so the failure reason is visible.
            call.resolve(
                JSObject()
                    .put("success", false)
                    .put("intent", "ACTION_DIAL")
                    .put("uri", telUri)
                    .put("error", "${e.javaClass.simpleName}: ${e.message ?: "dial_failed"}")
            )
        }
    }

    // ── openSettings ──────────────────────────────────────────
    @PluginMethod
    fun openSettings(call: PluginCall) {
        val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        intent.data = Uri.parse("package:${activity.packageName}")
        activity.startActivity(intent)
        call.resolve()
    }

    // ── requestPermission ─────────────────────────────────────
    // Real Capacitor 6 runtime permission request. 'permission' is one of
    // the declared aliases: 'microphone' | 'location'.
    @PluginMethod
    fun requestPermission(call: PluginCall) {
        val alias = call.getString("permission")
        if (alias.isNullOrBlank() || !isKnownAlias(alias)) {
            // Unknown/blank alias — never crash, just report not granted.
            call.resolve(JSObject().put("granted", false))
            return
        }
        if (getPermissionState(alias) == PermissionState.GRANTED) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        requestPermissionForAlias(alias, call, "permissionCallback")
    }

    // ── permissionCallback ────────────────────────────────────
    // Invoked by Capacitor after the OS permission dialog resolves.
    // The original PluginCall (with its "permission" arg) is re-delivered.
    @PermissionCallback
    private fun permissionCallback(call: PluginCall) {
        val alias = call.getString("permission")
        if (alias.isNullOrBlank() || !isKnownAlias(alias)) {
            call.resolve(JSObject().put("granted", false))
            return
        }
        val granted = getPermissionState(alias) == PermissionState.GRANTED
        call.resolve(JSObject().put("granted", granted))
    }

    // ── checkPermission ───────────────────────────────────────
    // Reports the current state without prompting: 'granted' | 'denied' | 'prompt'.
    @PluginMethod
    fun checkPermission(call: PluginCall) {
        val alias = call.getString("permission")
        if (alias.isNullOrBlank() || !isKnownAlias(alias)) {
            call.resolve(JSObject().put("status", "denied"))
            return
        }
        val status = when (getPermissionState(alias)) {
            PermissionState.GRANTED -> "granted"
            PermissionState.DENIED -> "denied"
            else -> "prompt" // PROMPT / PROMPT_WITH_RATIONALE
        }
        call.resolve(JSObject().put("status", status))
    }

    // ── Helper ────────────────────────────────────────────────
    private fun isKnownAlias(alias: String): Boolean =
        alias == "microphone" || alias == "location"
}
