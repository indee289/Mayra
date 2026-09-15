package com.priyakidost.mayra

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Register the custom Mayra plugin before the bridge is created.
        registerPlugin(MayraAndroidPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
