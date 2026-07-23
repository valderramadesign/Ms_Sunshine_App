const STORAGE_KEY = "deviceId";

// Anonymous per-device identifier used only to annotate "liked by this
// device" state and comment authorship display — never for access control.
export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
