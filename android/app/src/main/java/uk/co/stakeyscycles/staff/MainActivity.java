package uk.co.stakeyscycles.staff;

import android.os.Bundle;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    public static final String EXTRA_NOTIFICATION_OPEN_URL = "stakeys_notification_open_url";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeOneSignalPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String url = intent.getStringExtra(EXTRA_NOTIFICATION_OPEN_URL);
        if (url == null || getBridge() == null || getBridge().getWebView() == null) return;
        String detail = JSONObject.quote(url);
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('stakeys:notification-open',{detail:" + detail + "}));", null));
    }
}
