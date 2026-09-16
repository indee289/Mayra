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
import android.provider.MediaStore
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
        Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS]),
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
    // Opens an app / system surface by name. Package apps use their launch
    // intent (Play Store fallback if not installed); camera/gallery/dialer
    // use standard system intents wrapped in try/catch so a device without a
    // resolving app never crashes — it resolves { success:false, reason }.
    @PluginMethod
    fun openApp(call: PluginCall) {
        val appName = call.getString("appName") ?: run {
            call.reject("appName required"); return
        }
        val act = activity
        if (act == null) {
            call.resolve(JSObject().put("success", false).put("reason", "no_activity"))
            return
        }

        // ── System-intent apps (no installed-package assumption) ──
        // Camera: fire the standard image-capture intent; try/catch fallback.
        if (appName.contains("camera", ignoreCase = true)) {
            try {
                var intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                if (intent.resolveActivity(act.packageManager) == null) {
                    intent = Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
                }
                act.startActivity(intent)
                call.resolve(JSObject().put("success", true).put("intent", "IMAGE_CAPTURE"))
            } catch (e: Exception) {
                call.resolve(JSObject().put("success", false).put("reason", "not_found")
                    .put("error", "${e.javaClass.simpleName}: ${e.message ?: "camera_failed"}"))
            }
            return
        }

        // Gallery / Photos: view images from the media store; try/catch fallback.
        if (appName.contains("gallery", ignoreCase = true) ||
            appName.contains("photos", ignoreCase = true) ||
            appName.contains("gallary", ignoreCase = true)) {
            try {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setType("image/*")
                    setDataAndType(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image/*")
                }
                act.startActivity(intent)
                call.resolve(JSObject().put("success", true).put("intent", "VIEW_IMAGES"))
            } catch (e: Exception) {
                call.resolve(JSObject().put("success", false).put("reason", "not_found")
                    .put("error", "${e.javaClass.simpleName}: ${e.message ?: "gallery_failed"}"))
            }
            return
        }

        // Phone / Dialer: open the dialer with no number (ACTION_DIAL).
        if (appName.contains("dialer", ignoreCase = true) ||
            appName.contains("phone", ignoreCase = true)) {
            try {
                act.startActivity(Intent(Intent.ACTION_DIAL))
                call.resolve(JSObject().put("success", true).put("intent", "ACTION_DIAL"))
            } catch (e: Exception) {
                call.resolve(JSObject().put("success", false).put("reason", "not_found")
                    .put("error", "${e.javaClass.simpleName}: ${e.message ?: "dialer_failed"}"))
            }
            return
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
            val intent = act.packageManager.getLaunchIntentForPackage(pkg)
            if (intent != null) {
                act.startActivity(intent)
                call.resolve(JSObject().put("success", true))
            } else {
                // Not installed — open Play Store
                try {
                    val storeIntent = Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=$pkg"))
                    act.startActivity(storeIntent)
                } catch (_: Exception) { /* never crash on a missing store */ }
                call.resolve(JSObject().put("success", false).put("reason", "not_installed"))
            }
        } else if (appName.contains("settings", ignoreCase = true)) {
            act.startActivity(Intent(android.provider.Settings.ACTION_SETTINGS))
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
    // Re-delivered after the OS contacts dialog resolves. Routes back to the
    // action that requested it (call vs whatsapp) based on the "action" arg.
    // If denied, resolves a safe { matches: [], permission: "denied" }.
    @PermissionCallback
    private fun contactsPermissionCallback(call: PluginCall) {
        val name = call.getString("name") ?: ""
        val action = call.getString("action") ?: "call"
        if (getPermissionState("contacts") == PermissionState.GRANTED) {
            if (action == "whatsapp") {
                doSendWhatsAppByName(call, name, call.getString("message") ?: "")
            } else {
                doCallContact(call, name)
            }
        } else {
            val result = JSObject()
            result.put("matches", com.getcapacitor.JSArray())
            result.put("permission", "denied")
            call.resolve(result)
        }
    }

    // ── lookupContacts (SHARED helper) ────────────────────────
    // The single DRY contact-lookup used by BOTH callContact and
    // sendWhatsAppMessage. Assumes READ_CONTACTS is granted. Returns a list of
    // { name, number } JSObjects. Wrapped by callers in try/catch; itself
    // throws on cursor/security errors so callers can surface a safe result.
    private fun lookupContacts(name: String): MutableList<JSObject> {
        val matches = mutableListOf<JSObject>()
        val act = activity ?: return matches
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
        return matches
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
            val matches = lookupContacts(name)
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
            // Surface the exception CLASS + message for the debug panel.
            result.put("matches", matchArray)
            result.put("error", "${e.javaClass.simpleName}: ${e.message ?: "contacts_failed"}")
            call.resolve(result)
        }
    }

    // ── sendWhatsAppMessage ───────────────────────────────────
    // SAFE WhatsApp pre-fill: opens the WhatsApp chat for a contact (by name
    // or by explicit phoneNumber) with the message PRE-TYPED. The user still
    // taps Send themselves — we NEVER auto-send or simulate taps.
    //   { name?, phoneNumber?, message }
    // If a name is given and READ_CONTACTS is not granted, the contacts
    // dialog is requested first (routed back via contactsPermissionCallback).
    @PluginMethod
    fun sendWhatsAppMessage(call: PluginCall) {
        val message = call.getString("message") ?: ""
        val phoneNumber = call.getString("phoneNumber")
        val name = call.getString("name")

        // Direct number path — no contact lookup needed.
        if (!phoneNumber.isNullOrBlank()) {
            openWhatsAppChat(call, phoneNumber, message, null)
            return
        }

        if (name.isNullOrBlank()) {
            call.resolve(JSObject().put("success", false).put("reason", "no_target"))
            return
        }

        // Name path — permission-gate exactly like callContact, tagging the
        // callback so it routes back to WhatsApp (not dial).
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            call.data.put("action", "whatsapp")
            requestPermissionForAlias("contacts", call, "contactsPermissionCallback")
            return
        }
        doSendWhatsAppByName(call, name, message)
    }

    // ── doSendWhatsAppByName ──────────────────────────────────
    // Contacts lookup (DRY via lookupContacts) then open the WhatsApp chat
    // pre-filled. 0 matches → no_match; >1 → ambiguous (return matches);
    // exactly 1 → open WhatsApp prefilled. Never crashes.
    private fun doSendWhatsAppByName(call: PluginCall, name: String, message: String) {
        val result = JSObject()
        val matchArray = com.getcapacitor.JSArray()
        try {
            val matches = lookupContacts(name)
            matches.forEach { matchArray.put(it) }
            if (matches.isEmpty()) {
                result.put("success", false).put("reason", "no_match").put("matches", matchArray)
                call.resolve(result)
                return
            }
            if (matches.size > 1) {
                result.put("success", false).put("reason", "ambiguous").put("matches", matchArray)
                call.resolve(result)
                return
            }
            val number = matches[0].getString("number") ?: ""
            openWhatsAppChat(call, number, message, matches[0].getString("name"))
        } catch (e: Exception) {
            result.put("success", false).put("reason", "no_match").put("matches", matchArray)
                .put("error", "${e.javaClass.simpleName}: ${e.message ?: "contacts_failed"}")
            call.resolve(result)
        }
    }

    // ── openWhatsAppChat ──────────────────────────────────────
    // Opens the WhatsApp chat for an international number with the message
    // PRE-TYPED via wa.me deep link (setPackage com.whatsapp). NEVER sends.
    private fun openWhatsAppChat(call: PluginCall, rawNumber: String, message: String, matchedName: String?) {
        val act = activity
        if (act == null) {
            call.resolve(JSObject().put("success", false).put("reason", "no_activity"))
            return
        }
        try {
            val intl = normalizeToInternational(rawNumber)
            val encoded = Uri.encode(message)
            // wa.me expects the number WITHOUT the leading '+' or spaces.
            val uri = Uri.parse("https://wa.me/$intl?text=$encoded")
            val intent = Intent(Intent.ACTION_VIEW, uri)
            intent.setPackage("com.whatsapp")
            act.startActivity(intent)
            val result = JSObject().put("success", true).put("prefilled", true)
            if (matchedName != null) result.put("name", matchedName)
            call.resolve(result)
        } catch (e: Exception) {
            // WhatsApp not installed or no activity to resolve the intent.
            call.resolve(JSObject().put("success", false).put("reason", "whatsapp_not_found")
                .put("error", "${e.javaClass.simpleName}: ${e.message ?: "whatsapp_failed"}"))
        }
    }

    // ── normalizeToInternational ──────────────────────────────
    // Best-effort normalization for wa.me. Strips non-digits. If the number
    // already carries a country code (starts with '+' or is >10 digits) it is
    // used as-is; a bare 10-digit number is assumed to be India (+91). This
    // is intentionally simple and documented — international users with a
    // non-+91 default should ask Mayra using the full number.
    private fun normalizeToInternational(raw: String): String {
        val hadPlus = raw.trim().startsWith("+")
        val digits = raw.filter { it.isDigit() }
        return when {
            hadPlus -> digits                 // already international
            digits.length == 10 -> "91$digits" // assume India
            digits.length > 10 -> digits       // already has a country code
            else -> digits
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
    // the declared aliases: 'microphone' | 'contacts' | 'notifications' | 'location'.
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
        alias == "microphone" || alias == "contacts" ||
        alias == "notifications" || alias == "location"
}
