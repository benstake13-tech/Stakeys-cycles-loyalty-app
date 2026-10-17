package uk.co.stakeyscycles.staff;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.onesignal.Continue;
import com.onesignal.OneSignal;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import android.os.Handler;
import android.os.Looper;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "NativeOneSignal")
public class NativeOneSignalPlugin extends Plugin {
    @PluginMethod
    public void getDeliveryDiagnostics(PluginCall call) {
        android.app.NotificationManager manager = (android.app.NotificationManager)
            getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        JSObject data = new JSObject();
        data.put("notificationsEnabled", androidx.core.app.NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        String token = ApplicationClass.isOneSignalInitialized() ? OneSignal.getUser().getPushSubscription().getToken() : null;
        data.put("initializationError", ApplicationClass.getInitializationError());
        data.put("hasPushToken", token != null && !token.isEmpty());
        data.put("interruptionFilter", manager.getCurrentInterruptionFilter());
        com.getcapacitor.JSArray channels = new com.getcapacitor.JSArray();
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            for (android.app.NotificationChannel channel : manager.getNotificationChannels()) {
                JSObject entry = new JSObject();
                entry.put("name", channel.getName().toString());
                entry.put("id", channel.getId());
                entry.put("importance", channel.getImportance());
                channels.put(entry);
            }
        }
        data.put("channels", channels);
        android.content.SharedPreferences receipt = getContext().getSharedPreferences("native_push_receipt", 0);
        data.put("lastMessageId", receipt.getString("messageId", ""));
        data.put("receivedAt", receipt.getLong("receivedAt", 0));
        boolean inTray = false;
        if (receipt.contains("androidId")) {
            for (android.service.notification.StatusBarNotification active : manager.getActiveNotifications()) {
                if (active.getId() == receipt.getInt("androidId", -1)) inTray = true;
            }
        }
        data.put("lastMessageInTray", inTray);
        call.resolve(data);
    }

    @PluginMethod
    public void getPendingNotificationOpen(PluginCall call) {
        android.content.SharedPreferences receipt = getContext().getSharedPreferences("native_push_receipt", 0);
        String url = receipt.getString("pendingOpenUrl", "");
        if (url != null && !url.isEmpty()) {
            receipt.edit().remove("pendingOpenUrl").apply();
        }
        JSObject data = new JSObject();
        data.put("url", url == null ? "" : url);
        call.resolve(data);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        String appId = call.getString("appId");
        if (appId == null || appId.trim().isEmpty()) {
            call.reject("OneSignal native App ID is missing");
            return;
        }
        String configuredAppId = getContext().getString(R.string.onesignal_app_id);
        if (!configuredAppId.equals(appId)) {
            call.reject("The requested OneSignal App ID does not match the native app configuration");
            return;
        }
        if (!ApplicationClass.isOneSignalInitialized()) {
            getActivity().runOnUiThread(() -> {
                ApplicationClass application = (ApplicationClass) getActivity().getApplication();
                if (application.initializePush()) call.resolve();
                else call.reject("Native push initialization failed: " + ApplicationClass.getInitializationError());
            });
            return;
        }
        // ApplicationClass initializes the SDK before any Activity starts.
        // This method is retained for the existing JS bridge contract only.
        call.resolve();
    }

    @PluginMethod
    public void login(PluginCall call) {
        String externalId = call.getString("externalId");
        if (!ApplicationClass.isOneSignalInitialized() || externalId == null || externalId.isEmpty()) {
            call.reject("Native push is unavailable or the user ID is missing");
            return;
        }
        OneSignal.login(externalId);
        call.resolve();
    }

    @PluginMethod
    public void addTags(PluginCall call) {
        if (!ApplicationClass.isOneSignalInitialized()) {
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
        if (ApplicationClass.isOneSignalInitialized()) OneSignal.logout();
        call.resolve();
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (!ApplicationClass.isOneSignalInitialized()) {
            call.reject("Native OneSignal is not initialized");
            return;
        }
        Handler handler = new Handler(Looper.getMainLooper());
        AtomicBoolean settled = new AtomicBoolean(false);
        Runnable timeout = () -> {
            if (settled.compareAndSet(false, true)) call.reject("Push permission request timed out. Retry from app settings.");
        };
        handler.postDelayed(timeout, 30000);
        handler.post(() -> {
            try {
                OneSignal.getNotifications().requestPermission(true, Continue.with(result -> {
                    handler.post(() -> {
                        if (!settled.compareAndSet(false, true)) return;
                        handler.removeCallbacks(timeout);
                        if (!result.isSuccess()) {
                            Throwable error = result.getThrowable();
                            call.reject("Push permission failed: " + (error == null ? "unknown OneSignal error" : error.getMessage()));
                            return;
                        }
                        JSObject data = new JSObject();
                        data.put("granted", Boolean.TRUE.equals(result.getData()));
                        call.resolve(data);
                    });
                }));
            } catch (Throwable error) {
                handler.removeCallbacks(timeout);
                if (settled.compareAndSet(false, true)) call.reject("Push permission failed: " + error.getMessage());
            }
        });
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject data = new JSObject();
        boolean initialized = ApplicationClass.isOneSignalInitialized();
        data.put("initialized", initialized);
        data.put("appId", getContext().getString(R.string.onesignal_app_id));
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
        if (!ApplicationClass.isOneSignalInitialized()) {
            call.reject("Native OneSignal is not initialized");
            return;
        }
        OneSignal.getUser().getPushSubscription().optIn();
        call.resolve();
    }
}
