import { test } from "node:test";
import assert from "node:assert/strict";
import { initialMedia, MediaController } from "../src/lib/media/controller";

function track(kind: "video" | "audio", id: string) {
  return {
    kind,
    enabled: true,
    readyState: "live",
    onended: null,
    getSettings: () => ({ deviceId: id }),
    stop(this: { readyState: string }) {
      this.readyState = "ended";
    },
  } as unknown as MediaStreamTrack;
}
function stream(tracks: MediaStreamTrack[]) {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
  } as MediaStream;
}
function fixture() {
  let value = initialMedia;
  let available = ["camera-a", "camera-b", "camera-c", "mic-a", "mic-b"];
  const requests: MediaStreamConstraints[] = [];
  const acquired: MediaStreamTrack[] = [];
  const media = {
    enumerateDevices: async () =>
      available.map(
        (id) =>
          ({
            deviceId: id,
            kind: id.startsWith("camera") ? "videoinput" : "audioinput",
            label: `OS label ${id}`,
          }) as MediaDeviceInfo,
      ),
    getUserMedia: async (constraints: MediaStreamConstraints) => {
      requests.push(constraints);
      const kind = constraints.video ? "video" : "audio";
      const options = (
        kind === "video" ? constraints.video : constraints.audio
      ) as MediaTrackConstraints;
      const id =
        (options.deviceId as { exact: string })?.exact ??
        (kind === "video" ? "camera-a" : "mic-a");
      if (!available.includes(id))
        throw new DOMException("Missing device", "NotFoundError");
      const next = track(kind, id);
      acquired.push(next);
      return stream([next]);
    },
  };
  const controller = new MediaController(
    media,
    (next) => {
      value = next;
    },
    stream,
  );
  return {
    controller,
    media,
    requests,
    acquired,
    get value() {
      return value;
    },
    remove: (id: string) => {
      available = available.filter((d) => d !== id);
    },
  };
}
test("unsupported capture dimensions fall back to the same camera and preserve the mic", async () => {
  const f = fixture();
  await f.controller.open();
  const mic = f.value.stream!.getAudioTracks()[0];
  const capture = f.media.getUserMedia;
  f.media.getUserMedia = async (c) => {
    if (c.video && typeof c.video === "object" && c.video.frameRate)
      throw Object.assign(new Error("Unsupported frame rate"), {
        name: "OverconstrainedError",
        constraint: "frameRate",
      });
    return capture(c);
  };
  await f.controller.select("video", "camera-b");
  assert.equal(f.value.camera, "camera-b");
  assert.equal(f.value.stream!.getAudioTracks()[0], mic);
  assert.deepEqual(f.requests.at(-1)?.video, {
    deviceId: { exact: "camera-b" },
  });
  f.controller.dispose();
});

test("camera switching releases old camera and preserves selected, muted microphone", async () => {
  const f = fixture();
  await f.controller.open();
  f.controller.toggle("audio");
  const mic = f.value.stream!.getAudioTracks()[0];
  await f.controller.select("video", "camera-b");
  assert.equal(f.acquired[0].readyState, "ended");
  assert.equal(f.value.stream!.getAudioTracks()[0], mic);
  assert.equal(mic.enabled, false);
  assert.equal(mic.readyState, "live");
  assert.deepEqual(
    f.requests.at(-1)?.video &&
      (f.requests.at(-1)?.video as MediaTrackConstraints).deviceId,
    { exact: "camera-b" },
  );
  await f.controller.select("audio", "mic-b");
  assert.equal(mic.readyState, "ended");
  assert.equal(f.acquired[2].readyState, "live");
  f.controller.dispose();
  assert.ok(f.acquired.every((t) => t.readyState === "ended"));
});
test("microphone permission failure does not prevent raw video or later mic selection", async () => {
  const f = fixture();
  const capture = f.media.getUserMedia;
  f.media.getUserMedia = async (c) => {
    if (c.audio) throw new DOMException("Denied", "NotAllowedError");
    return capture(c);
  };
  assert.equal(await f.controller.open(), true);
  assert.equal(f.value.cameraState, "camera ready");
  assert.match(f.value.error, /Microphone permission denied/);
  f.media.getUserMedia = capture;
  await f.controller.select("audio", "mic-b");
  assert.equal(f.value.error, "");
  f.controller.dispose();
});
test("hot removal and failed selection preserve the other input, labels refresh", async () => {
  const f = fixture();
  await f.controller.open();
  f.remove("camera-a");
  await f.controller.refresh();
  assert.equal(f.value.cameraState, "camera unavailable");
  assert.equal(f.value.stream!.getAudioTracks()[0].readyState, "live");
  assert.ok(f.value.devices.every((d) => d.deviceId !== "camera-a"));
  await f.controller.select("video", "missing");
  assert.match(f.value.error, /Camera unavailable/);
  await f.controller.select("video", "camera-b");
  assert.equal(f.value.cameraState, "camera ready");
  assert.equal(
    f.value.devices.find((d) => d.deviceId === "camera-b")?.label,
    "OS label camera-b",
  );
  f.controller.dispose();
});
test("late capture from superseded selection or unmount is stopped", async () => {
  const f = fixture();
  await f.controller.open();
  let resolve!: (s: MediaStream) => void;
  const capture = f.media.getUserMedia;
  f.media.getUserMedia = () =>
    new Promise((r) => {
      resolve = r;
    });
  const pending = f.controller.select("video", "camera-b");
  f.media.getUserMedia = capture;
  await f.controller.select("video", "camera-c");
  const late = track("video", "camera-b");
  resolve(stream([late]));
  await pending;
  assert.equal(late.readyState, "ended");
  assert.equal(f.value.camera, "camera-c");
  f.media.getUserMedia = () =>
    new Promise((r) => {
      resolve = r;
    });
  const final = f.controller.select("audio", "mic-b");
  f.controller.dispose();
  const abandoned = track("audio", "mic-b");
  resolve(stream([abandoned]));
  await final;
  assert.equal(abandoned.readyState, "ended");
});
test("stale saved device falls back on enable without substituting explicit selections", async () => {
  const f = fixture();
  await f.controller.select("video", "missing");
  assert.equal(await f.controller.open(), true);
  assert.equal(f.value.camera, "camera-a");
  await f.controller.select("video", "missing");
  assert.equal(f.value.cameraState, "camera unavailable");
  f.controller.dispose();
});

test("unchanged enumeration and capture completion preserve stream identity", async () => {
  const f = fixture();
  await f.controller.open();
  const original = f.value.stream;
  await f.controller.refresh();
  await f.controller.refresh();
  assert.equal(f.value.stream, original);
  f.controller.toggle("audio");
  assert.equal(f.value.stream, original);
  f.controller.dispose();
});
