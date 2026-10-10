import type { InferenceSession } from "@/lib/inference/protocol";
export async function connectRealtime(
  connection: NonNullable<InferenceSession["realtime"]>,
  input: MediaStream | null,
  onStream: (stream: MediaStream) => void,
) {
  const peer = new RTCPeerConnection({ iceServers: connection.iceServers });
  const output = new MediaStream();
  peer.ontrack = (e) => {
    output.addTrack(e.track);
    // New stream identities notify React when video arrives after audio.
    onStream(new MediaStream(output.getTracks()));
    e.track.onended = () => {
      output.removeTrack(e.track);
      onStream(new MediaStream(output.getTracks()));
    };
  };
  if (input) {
    // Reserve both senders so a missing microphone can be enabled mid-session.
    for (const kind of ["video", "audio"] as const) {
      const track = input.getTracks().find((t) => t.kind === kind);
      if (track)
        peer.addTransceiver(track, { direction: "sendrecv", streams: [input] });
      else peer.addTransceiver(kind, { direction: "sendrecv" });
    }
  } else {
    peer.addTransceiver("video", { direction: "recvonly" });
    peer.addTransceiver("audio", { direction: "recvonly" });
  }
  try {
    await peer.setLocalDescription(await peer.createOffer());
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("ICE negotiation timed out.")),
        10000,
      );
      const done = () => {
        if (peer.iceGatheringState === "complete") {
          clearTimeout(timeout);
          peer.removeEventListener("icegatheringstatechange", done);
          resolve();
        }
      };
      peer.addEventListener("icegatheringstatechange", done);
      done();
    });
    const response = await fetch(connection.signalingUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connection.token}`,
      },
      body: JSON.stringify(peer.localDescription),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error("Could not connect to the inference media service.");
    const answer: RTCSessionDescriptionInit = await response.json();
    if (answer.type !== "answer" || typeof answer.sdp !== "string")
      throw new Error("Invalid media service answer.");
    await peer.setRemoteDescription(answer);
    return peer;
  } catch (error) {
    peer.close();
    throw error;
  }
}

/** Replace capture tracks without rebuilding the session or disturbing audio. */
export async function replaceInput(
  peer: RTCPeerConnection,
  input: MediaStream | null,
) {
  for (const transceiver of peer.getTransceivers()) {
    const kind = transceiver.receiver.track.kind;
    const next =
      input
        ?.getTracks()
        .find((t) => t.kind === kind && t.readyState === "live") ?? null;
    if (transceiver.sender.track !== next)
      await transceiver.sender.replaceTrack(next);
  }
}
