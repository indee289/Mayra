/**
 * ═══════════════════════════════════════════════════════════
 * MayraAndroidPlugin.kt — Capacitor plugin
 * Exposes native device capabilities to the WebView JS layer.
 *
 * Usage: Add to your Capacitor Android project and register
 * in MainActivity.kt:  add(MayraAndroidPlugin::class.java)
 *
 * The JS side accesses this via:
 *   window.Capacitor.Plugins.MayraAndroid.<method>(args)
 * ═══════════════════════════════════════════════════════════
 */
package com.priyakidost.mayra

import android.content.Intent
import android.net.Uri
import android.provider.ContactsContract
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "MayraAndroid")
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
        // Use ACTION_DIAL (no CALL_PHONE permission needed)
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:+$number"))
        activity.startActivity(intent)
        call.resolve(JSObject().put("success", true))
    }

    // ── callContact ────────────────────────────────────────────
    @PluginMethod
    fun callContact(call: PluginCall) {
        val name = call.getString("name") ?: run { call.reject("name required"); return }
        val matches = mutableListOf<JSObject>()

        val cursor = activity.contentResolver.query(
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

        val result = JSObject()
        val matchArray = com.getcapacitor.JSArray()
        matches.forEach { matchArray.put(it) }
        result.put("matches", matchArray)

        if (matches.size == 1) {
            val number = matches[0].getString("number") ?: ""
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))
            activity.startActivity(intent)
            result.put("calledNumber", number)
        }
        call.resolve(result)
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
    @PluginMethod
    fun requestPermission(call: PluginCall) {
        val perm = call.getString("permission") ?: run { call.reject("permission required"); return }
        // Capacitor handles runtime permissions natively via @NativePermission annotations
        // For a full implementation, use Capacitor's permission API surface.
        // This stub returns false so the JS layer falls through to its own handling.
        call.resolve(JSObject().put("granted", false))
    }
}
