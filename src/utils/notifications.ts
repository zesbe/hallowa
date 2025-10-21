export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      ...options,
    });
  }
}

export function notifyDeviceConnected(deviceName: string) {
  showNotification("Device Connected", {
    body: `${deviceName} berhasil terhubung ke WhatsApp`,
    tag: "device-connected",
  });
}

export function notifyDeviceDisconnected(deviceName: string) {
  showNotification("Device Disconnected", {
    body: `${deviceName} terputus dari WhatsApp`,
    tag: "device-disconnected",
  });
}

export function notifyDeviceError(deviceName: string) {
  showNotification("Device Error", {
    body: `${deviceName} mengalami error koneksi`,
    tag: "device-error",
  });
}
