import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionBudget } from "../src/lib/streaming/budget";
import { plans } from "../src/config/plans";
import { replaceInput } from "../src/lib/streaming/webrtc";

test("Free allowance, used minute credits, exhaustion and duration caps", () => {
  assert.equal(sessionBudget(plans.free.minutes, 0), 1800);
  assert.equal(sessionBudget(plans.free.minutes, 29.5), 30);
  assert.throws(() => sessionBudget(plans.free.minutes, 30), /limit reached/);
  assert.throws(
    () => sessionBudget(plans.free.minutes, 29.999),
    /limit reached/,
  );
  assert.equal(sessionBudget(plans.pro.minutes, 0), 28800);
});
test("WebRTC track replacement preserves audio and restores video after removal", async () => {
  const camera = { kind: "video", readyState: "live" } as MediaStreamTrack;
  const next = { kind: "video", readyState: "live" } as MediaStreamTrack;
  const mic = { kind: "audio", readyState: "live" } as MediaStreamTrack;
  const changes: string[] = [];
  function transceiver(kind: string, track: MediaStreamTrack) {
    return {
      receiver: { track: { kind } },
      sender: {
        track,
        async replaceTrack(t: MediaStreamTrack | null) {
          this.track = t as MediaStreamTrack;
          changes.push(kind);
        },
      },
    };
  }
  const video = transceiver("video", camera),
    audio = transceiver("audio", mic);
  const peer = {
    getTransceivers: () => [video, audio],
  } as unknown as RTCPeerConnection;
  await replaceInput(peer, { getTracks: () => [next, mic] } as MediaStream);
  assert.deepEqual(changes, ["video"]);
  assert.equal(audio.sender.track, mic);
  await replaceInput(peer, { getTracks: () => [mic] } as MediaStream);
  assert.equal(video.sender.track, null);
  await replaceInput(peer, { getTracks: () => [next, mic] } as MediaStream);
  assert.equal(video.sender.track, next);
  assert.equal(audio.sender.track, mic);
});
