self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "56사랑", {
      body: data.body || "",
      icon: "/icons/56-love-192.png",
      badge: "/icons/56-love-192.png",
      tag: data.tag,
      data: { url: data.url || "/notices" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notices";
  event.waitUntil(clients.openWindow(url));
});
