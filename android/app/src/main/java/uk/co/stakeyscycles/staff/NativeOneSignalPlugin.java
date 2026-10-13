package uk.co.stakeyscycles.staff;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.onesignal.OneSignal;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import kotlin.coroutines.Continuation;
import kotlin.coroutines.intrinsics.IntrinsicsKt;
import kotlin.ResultKt;
import android.os.Handler;
import android.os.Looper;
import java.util.concurrent.atomic.AtomicBoolean;
import kotlin.coroutines.CoroutineContext;
import kotlin.coroutines.EmptyCoroutineContext;

@CapacitorPlugin(name = "NativeOneSignal")
public class NativeOneSignalPlugin extends Plugin {
    private boolean initialized = false;
    private String initializedAppId;

    @PluginMethod
    public void initialize(PluginCall call) {
        String appId = call.getString("appId");
        if (appId == null || appId.trim().isEmpty()) {
            call.reject("OneSignal native App ID is missing");
            return;
        }
        if (initialized) {
            if (appId.equals(initializedAppId)) call.resolve();
            else call.reject("Restart the app before changing the push App ID");
            return;
        }
        try {
            OneSignal.initWithContext(getContext(), appId);
            initialized = true;
            initializedAppId = appId;
            call.resolve();
        } catch (Exception e) {
            call.reject("Native OneSignal initialization failed", e);
        }
    }

    @PluginMethod
    public void login(PluginCall call) {
        String externalId = call.getString("externalId");
        if (!initialized || externalId == null || externalId.isEmpty()) {
            call.reject("Initialize native push and provide a user ID first");
            return;
        }
        OneSignal.login(externalId);
        call.resolve();
    }

    @PluginMethod
    public void addTags(PluginCall call) {
        if (!initialized) {
            call.reject("Native OneSignal is not initialized");
            return;
        }
        JSObject tags = call.getObject("tags");
        if (tags == null) {
            call.reject("Missing OneSignal tags");
            return;
        }
        Map<String, String> values = new HashMap<>();
        Iterator<String> keys = tags.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            values.put(key, tags.optString(key, ""));
        }
        OneSignal.getUser().addTags(values);
        call.resolve();
    }

    @PluginMethod
    public void logout(PluginCall call) {
        if (initialized) OneSignal.logout();
        call.resolve();
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (!initialized) {
            call.reject("Native OneSignal is not initialized");
            return;
        }
        Handler handler = new Handler(Looper.getMainLooper());
        AtomicBoolean settled = new AtomicBoolean(false);
        Runnable timeout = () -> {
            if (settled.compareAndSet(false, true)) call.reject("Push permission request timed out. Retry from app settings.");
        };
        handler.postDelayed(timeout, 30000);
        Continuation<Boolean> completion = new Continuation<Boolean>() {
            @Override public CoroutineContext getContext() { return EmptyCoroutineContext.INSTANCE; }
            @Override public void resumeWith(Object result) {
                if (!settled.compareAndSet(false, true)) return;
                handler.removeCallbacks(timeout);
                try {
                    ResultKt.throwOnFailure(result);
                    JSObject data = new JSObject();
                    data.put("granted", result instanceof Boolean ? (Boolean) result : OneSignal.getNotifications().getPermission());
                    call.resolve(data);
                } catch (Throwable error) {
                    call.reject("Push permission failed: " + error.getMessage());
                }
            }
        };
        handler.post(() -> {
            try {
                Object result = OneSignal.getNotifications().requestPermission(true, completion);
                // Kotlin suspend functions can complete immediately WITHOUT invoking continuation.
                if (result != IntrinsicsKt.getCOROUTINE_SUSPENDED()) completion.resumeWith(result);
            } catch (Throwable error) {
                handler.removeCallbacks(timeout);
                if (settled.compareAndSet(false, true)) call.reject("Push permission failed: " + error.getMessage());
            }
        });
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject data = new JSObject();
        data.put("initialized", initialized);
        if (initialized) {
            data.put("permission", OneSignal.getNotifications().getPermission());
            String id = OneSignal.getUser().getPushSubscription().getId();
            data.put("subscriptionId", id == null ? "" : id);
            data.put("optedIn", OneSignal.getUser().getPushSubscription().getOptedIn());
        }
        call.resolve(data);
    }

    @PluginMethod
    public void optIn(PluginCall call) {
        if (!initialized) {
            call.reject("Native OneSignal is not initialized");
            return;
        }
        OneSignal.getUser().getPushSubscription().optIn();
        call.resolve();
    }
}
