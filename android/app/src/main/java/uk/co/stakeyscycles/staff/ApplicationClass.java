package uk.co.stakeyscycles.staff;

import android.app.Application;
import android.content.Intent;
import android.net.Uri;

import com.onesignal.OneSignal;

/** Initializes the shared native OneSignal app before Capacitor creates an Activity. */
public final class ApplicationClass extends Application {
    public static final String PUSH_CHANNEL_ID = "stakeys_cycles_updates";
    private static volatile boolean oneSignalInitialized = false;

    private static volatile String initializationError = "";

    @Override
    public void onCreate() {
        super.onCreate();
        initializePush();
    }

    /** A push SDK failure must remain diagnosable without closing the workshop app. */
    public synchronized boolean initializePush() {
        if (oneSignalInitialized) return true;
        try {
        OneSignal.initWithContext(this, getString(R.string.onesignal_app_id));
        OneSignal.getNotifications().addClickListener(event -> {
            String url = event.getResult() == null ? null : event.getResult().getUrl();
            if (url == null || url.trim().isEmpty()) {
                url = event.getNotification().getLaunchURL();
            }
            if (url == null || url.trim().isEmpty()) return;

            Uri clicked = Uri.parse(url);
            String bookingId = clicked.getQueryParameter("booking");
            if (!"1".equals(clicked.getQueryParameter("staff")) || bookingId == null || bookingId.trim().isEmpty()) return;

            getSharedPreferences("native_push_receipt", MODE_PRIVATE).edit()
                .putString("pendingOpenUrl", url).apply();
            Intent openStaffApp = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(MainActivity.EXTRA_NOTIFICATION_OPEN_URL, url);
            startActivity(openStaffApp);
        });
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            android.app.NotificationChannel channel = new android.app.NotificationChannel(
                PUSH_CHANNEL_ID, "Stakey's Cycles", android.app.NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Staff app updates and notifications from Stakey's Cycles");
            channel.enableLights(true);
            channel.setLightColor(android.graphics.Color.rgb(5, 193, 71));
            channel.enableVibration(true);
            ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
        oneSignalInitialized = true;
        initializationError = "";
        return true;
        } catch (RuntimeException error) {
            initializationError = error.getClass().getSimpleName() + ": " + error.getMessage();
            android.util.Log.e("StakeysPush", "Native push initialization failed", error);
            return false;
        }
    }

    public static String getInitializationError() {
        return initializationError;
    }

    public static boolean isOneSignalInitialized() {
        return oneSignalInitialized;
    }
}
