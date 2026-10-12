package uk.co.stakeyscycles.staff;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeOneSignalPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
