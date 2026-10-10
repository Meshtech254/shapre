type Kind = "video" | "audio";
export const initialMedia = {
  devices: [] as MediaDeviceInfo[],
  stream: null as MediaStream | null,
  camera: "",
  microphone: "",
  cameraOn: true,
  micOn: true,
  busy: false,
  cameraState: "camera unavailable",
  error: "",
};
/** Capture ownership is independent of inference and isolated per input. */
export class MediaController {
  private value = { ...initialMedia };
  private tracks: Partial<Record<Kind, MediaStreamTrack>> = {};
  private revisions = { video: 0, audio: 0 };
  private pending = { video: false, audio: false };
  private errors = { video: "", audio: "" };
  private enabled = false;
  private disposed = false;
  private enumeration = 0;
  constructor(
    private devices: Pick<MediaDevices, "enumerateDevices" | "getUserMedia">,
    private publish: (value: typeof initialMedia) => void,
    private makeStream = (tracks: MediaStreamTrack[]) =>
      new MediaStream(tracks),
    private remember: (kind: Kind, id: string) => void = () => {},
    preferences: { camera?: string; microphone?: string } = {},
  ) {
    this.value.camera = preferences.camera ?? "";
    this.value.microphone = preferences.microphone ?? "";
    this.emit();
  }
  private emit(streamChanged = false) {
    if (this.disposed) return;
    const tracks = Object.values(this.tracks).filter(
      (t) => t.readyState === "live",
    );
    this.value = {
      ...this.value,
      ...(streamChanged &&
      (tracks.length !== (this.value.stream?.getTracks().length ?? 0) ||
        tracks.some((t) => !this.value.stream?.getTracks().includes(t)))
        ? { stream: tracks.length ? this.makeStream(tracks) : null }
        : {}),
      busy: this.pending.video || this.pending.audio,
      cameraState: this.pending.video
        ? "requesting permission"
        : this.tracks.video?.readyState === "live"
          ? "camera ready"
          : "camera unavailable",
      error: [this.errors.video, this.errors.audio].filter(Boolean).join(" "),
    };
    this.publish(this.value);
  }
  async refresh() {
    const revision = ++this.enumeration;
    try {
      const devices = await this.devices.enumerateDevices();
      if (this.disposed || revision !== this.enumeration) return;
      this.value.devices = devices.filter(
        (d) => d.kind === "videoinput" || d.kind === "audioinput",
      );
      let removed = false;
      for (const kind of ["video", "audio"] as const) {
        const id = this.tracks[kind]?.getSettings().deviceId;
        if (
          id &&
          !this.pending[kind] &&
          !devices.some((d) => d.deviceId === id)
        ) {
          this.release(kind);
          removed = true;
          this.errors[kind] =
            `${kind === "video" ? "Camera" : "Microphone"} disconnected. Select another device or retry access.`;
        }
      }
      this.emit(removed);
    } catch {
      /* Capture may work even when enumeration is restricted. */
    }
  }
  private release(kind: Kind) {
    const track = this.tracks[kind];
    if (track) {
      track.onended = null;
      track.stop();
    }
    delete this.tracks[kind];
  }
  async select(kind: Kind, id: string) {
    this.value[kind === "video" ? "camera" : "microphone"] = id;
    this.remember(kind, id);
    this.emit();
    if (this.enabled) await this.acquire(kind);
  }
  async open() {
    this.enabled = true;
    // Separate, sequential permission requests keep microphone failure from
    // preventing a raw camera preview and avoid overlapping permission prompts.
    await this.acquire("video", true);
    if (!this.disposed) await this.acquire("audio", true);
    return this.tracks.video?.readyState === "live";
  }
  private async acquire(kind: Kind, fallback = false) {
    const revision = ++this.revisions[kind];
    const key = kind === "video" ? "camera" : "microphone";
    const id = this.value[key];
    this.pending[kind] = true;
    this.errors[kind] = "";
    this.release(kind); // Release only the changed input before reacquiring it.
    this.emit(true);
    try {
      const constraints = {
        ...(id ? { deviceId: { exact: id } } : {}),
        ...(kind === "video"
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30, max: 30 },
            }
          : {}),
      };
      let captured: MediaStream;
      try {
        captured = await this.devices.getUserMedia({
          video: kind === "video" ? constraints : false,
          audio: kind === "audio" ? constraints : false,
        });
      } catch (e) {
        if (this.disposed || revision !== this.revisions[kind]) return;
        if (
          kind === "video" &&
          (e as Error).name === "OverconstrainedError" &&
          ["width", "height", "frameRate"].includes(
            (e as OverconstrainedError).constraint,
          )
        ) {
          captured = await this.devices.getUserMedia({
            video: id ? { deviceId: { exact: id } } : true,
            audio: false,
          });
        } else {
          // Remembered IDs can be stale. Never substitute an explicit selection.
          if (
            !fallback ||
            !id ||
            !["NotFoundError", "OverconstrainedError"].includes(
              (e as Error).name,
            )
          )
            throw e;
          if (this.disposed || revision !== this.revisions[kind]) return;
          captured = await this.devices.getUserMedia({
            video:
              kind === "video"
                ? { width: { ideal: 1280 }, height: { ideal: 720 } }
                : false,
            audio: kind === "audio",
          });
        }
      }
      if (this.disposed || revision !== this.revisions[kind]) {
        captured.getTracks().forEach((t) => t.stop());
        return;
      }
      const track = captured.getTracks().find((t) => t.kind === kind);
      captured
        .getTracks()
        .filter((t) => t !== track)
        .forEach((t) => t.stop());
      if (!track) throw new Error("The device returned no media track.");
      track.enabled = kind === "video" ? this.value.cameraOn : this.value.micOn;
      this.tracks[kind] = track;
      this.value[key] = track.getSettings().deviceId || id;
      this.remember(kind, this.value[key]);
      track.onended = () => {
        if (this.disposed || this.tracks[kind] !== track) return;
        this.release(kind);
        this.errors[kind] =
          `${kind === "video" ? "Camera" : "Microphone"} disconnected. Select another device or retry access.`;
        this.emit(true);
        void this.refresh();
      };
      this.emit(true);
      await this.refresh();
    } catch (e) {
      if (this.disposed || revision !== this.revisions[kind]) return;
      const label = kind === "video" ? "Camera" : "Microphone";
      const name = (e as Error).name;
      this.errors[kind] =
        name === "NotAllowedError"
          ? `${label} permission denied. Allow access in your browser and retry.`
          : ["NotFoundError", "OverconstrainedError"].includes(name)
            ? `${label} unavailable. Connect or select another device.`
            : `${label} could not initialize. Close other applications using it and retry.`;
    } finally {
      if (!this.disposed && revision === this.revisions[kind]) {
        this.pending[kind] = false;
        this.emit(true);
      }
    }
  }
  toggle(kind: Kind) {
    const key = kind === "video" ? "cameraOn" : "micOn";
    this.value[key] = !this.value[key];
    const track = this.tracks[kind];
    if (track) track.enabled = this.value[key];
    this.emit();
  }
  dispose() {
    this.disposed = true;
    this.revisions.video++;
    this.revisions.audio++;
    this.release("video");
    this.release("audio");
  }
}
