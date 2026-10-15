package uk.co.stakeyscycles.staff;

import androidx.annotation.Keep;
import com.onesignal.notifications.INotificationReceivedEvent;
import com.onesignal.notifications.INotificationServiceExtension;

/** Records receipt only; OneSignal keeps its normal notification display behavior. */
@Keep
public final class PushReceiptExtension implements INotificationServiceExtension {
    @Override
    public void onNotificationReceived(INotificationReceivedEvent event) {
        if (event.getRestoring()) return;
        event.getContext().getSharedPreferences("native_push_receipt", 0).edit()
            .putString("messageId", event.getNotification().getNotificationId())
            .putInt("androidId", event.getNotification().getAndroidNotificationId())
            .putLong("receivedAt", System.currentTimeMillis()).apply();
    }
}
