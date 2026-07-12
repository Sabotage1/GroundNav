package com.groundnav.llbg;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(GroundNavUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
