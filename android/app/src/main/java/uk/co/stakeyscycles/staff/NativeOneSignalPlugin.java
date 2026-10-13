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
import kotlin.coroutines.CoroutineContext;
import kotlin.coroutines.EmptyCoroutineContext;

@CapacitorPlugin(name = "NativeOneSignal")
public class NativeOneSignalPlugin extends Plugin {
    private boolean initialized = false;

    @PluginMethod
    public void initialize(PluginCall call) {
        String appId = call.getString("appId");
        if (appId == null || appId.trim().isEmpty()) {
            call.reject("OneSignal native App ID is missing");
            return;
        }
        try {
            OneSignal.initWithContext(getContext(), appId);
            initialized = true;
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
        OneSignal.getNotifications().requestPermission(true, new Continuation<Boolean>() {
            @Override
            public CoroutineContext getContext() {
                return EmptyCoroutineContext.INSTANCE;
            }

            @Override
            public void resumeWith(Object result) {
                JSObject data = new JSObject();
                // Kotlin suspend functions resume with the unboxed Boolean on success.
                // On failure, read the current permission state instead.
                data.put("granted", result instanceof Boolean
                    ? (Boolean) result
                    : OneSignal.getNotifications().getPermission());
                call.resolve(data);
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
