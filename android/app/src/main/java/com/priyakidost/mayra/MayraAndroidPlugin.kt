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
import android.provider.ContactsContract
import android.provider.Settings
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
        Permission(alias = "contacts", strings = [Manifest.permission.READ_CONTACTS]),
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
        try {
            // Use ACTION_DIAL (no CALL_PHONE permission needed)
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:+$number"))
            act.startActivity(intent)
            call.resolve(JSObject().put("success", true))
        } catch (e: Exception) {
            // ActivityNotFoundException / SecurityException / anything else — resolve safely.
            call.resolve(JSObject().put("success", false).put("error", e.message ?: "dial_failed"))
        }
    }

    // ── callContact ────────────────────────────────────────────
    // Crash-proof: never queries contacts without a granted READ_CONTACTS,
    // and wraps all cursor/startActivity work in try/catch so any failure
    // resolves a safe result instead of throwing (which would crash the app).
    @PluginMethod
    fun callContact(call: PluginCall) {
        val name = call.getString("name") ?: run { call.reject("name required"); return }

        // Permission gate: if READ_CONTACTS is not granted, request it FIRST
        // rather than querying (an unguarded query throws SecurityException).
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            requestPermissionForAlias("contacts", call, "contactsPermissionCallback")
            return
        }
        doCallContact(call, name)
    }

    // ── contactsPermissionCallback ────────────────────────────
    // Re-delivered after the OS contacts dialog resolves. If granted, do the
    // lookup; otherwise resolve a safe { matches: [], permission: "denied" }.
    @PermissionCallback
    private fun contactsPermissionCallback(call: PluginCall) {
        val name = call.getString("name") ?: ""
        if (getPermissionState("contacts") == PermissionState.GRANTED) {
            doCallContact(call, name)
        } else {
            val result = JSObject()
            result.put("matches", com.getcapacitor.JSArray())
            result.put("permission", "denied")
            call.resolve(result)
        }
    }

    // ── doCallContact ─────────────────────────────────────────
    // The actual contacts lookup + dial. Assumes READ_CONTACTS is granted.
    // Everything is wrapped so no failure can crash the app.
    private fun doCallContact(call: PluginCall, name: String) {
        val result = JSObject()
        val matchArray = com.getcapacitor.JSArray()

        val act = activity
        if (act == null) {
            result.put("matches", matchArray)
            result.put("error", "no_activity")
            call.resolve(result)
            return
        }

        try {
            val matches = mutableListOf<JSObject>()
            val cursor = act.contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                arrayOf(
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                ),
                "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?",
                arrayOf("%$name%"),
                null
            )

            cursor?.use {
                val nameIdx = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                val numIdx  = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                while (it.moveToNext()) {
                    val entry = JSObject()
                        .put("name",   it.getString(nameIdx))
                        .put("number", it.getString(numIdx))
                    matches.add(entry)
                }
            }

            matches.forEach { matchArray.put(it) }
            result.put("matches", matchArray)

            if (matches.size == 1) {
                val number = matches[0].getString("number") ?: ""
                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))
                act.startActivity(intent)
                result.put("calledNumber", number)
            }
            call.resolve(result)
        } catch (e: Exception) {
            // SecurityException, ActivityNotFoundException, cursor issues, etc.
            result.put("matches", matchArray)
            result.put("error", e.message ?: "contacts_failed")
            call.resolve(result)
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
    // the declared aliases: 'microphone' | 'contacts' | 'location'.
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

    // ── openAccessibilitySettings ─────────────────────────────
    // Deep-links the user to the system Accessibility settings screen.
    @PluginMethod
    fun openAccessibilitySettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve(JSObject().put("success", true))
    }

    // ── isAccessibilityEnabled ────────────────────────────────
    // Reports whether an accessibility service belonging to THIS app is enabled.
    // MayraAccessibilityService is shipped, so this flips to true once the user
    // enables it from the system Accessibility settings screen.
    @PluginMethod
    fun isAccessibilityEnabled(call: PluginCall) {
        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )
        val enabled = enabledServices?.contains(context.packageName) == true
        call.resolve(JSObject().put("enabled", enabled))
    }

    // ── Helper ────────────────────────────────────────────────
    private fun isKnownAlias(alias: String): Boolean =
        alias == "microphone" || alias == "contacts" || alias == "location"
}
