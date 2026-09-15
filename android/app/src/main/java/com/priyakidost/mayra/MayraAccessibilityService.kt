/**
 * ═══════════════════════════════════════════════════════════
 * MayraAccessibilityService.kt — minimal AccessibilityService
 *
 * Purpose: its mere presence (declared in AndroidManifest.xml with the
 * android.accessibilityservice.AccessibilityService intent-filter and the
 * @xml/accessibility_service_config meta-data) makes "Priya ki Dost" appear
 * in the system Accessibility settings list so the user can actually toggle
 * it ON. Once enabled, MayraAndroidPlugin.isAccessibilityEnabled() (which
 * checks Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES for this package)
 * returns true.
 *
 * No behaviour is implemented on purpose — presence is what matters.
 * ═══════════════════════════════════════════════════════════
 */
package com.priyakidost.mayra

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class MayraAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Intentionally empty — no event handling needed.
    }

    override fun onInterrupt() {
        // Intentionally empty — nothing to interrupt.
    }
}
