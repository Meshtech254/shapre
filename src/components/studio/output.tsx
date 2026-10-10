"use client";
import { useEffect, useRef, useState } from "react";
import { StreamVideo } from "./video";
import { api } from "@/lib/client-api";
import { connectRealtime } from "@/lib/streaming/webrtc";
import type { InferenceSession } from "@/lib/inference/client";
export function Output({ id, token }: { id: string; token: string }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState("Connecting…");
  const [mock, setMock] = useState(false);
  const [watermark, setWatermark] = useState(false);
  const peer = useRef<RTCPeerConnection | null>(null);
  useEffect(() => {
    let disposed = false;
    let channel: BroadcastChannel | undefined;
    let retry: ReturnType<typeof setInterval> | undefined;
    let polling = false;
    let ended = false;
    const candidates: RTCIceCandidateInit[] = [];
    async function connect() {
      try {
        const result = await api<{
          mock: boolean;
          output?: InferenceSession["output"];
          status: string;
          watermark: boolean;
        }>(`/api/v1/output/${id}?token=${encodeURIComponent(token)}`);
        if (disposed) return;
        setMock(result.mock);
        setWatermark(result.watermark);
        if (result.mock) {
          channel = new BroadcastChannel(`shapre-output-${id}`);
          channel.onmessage = async (event) => {
            try {
              if (event.data.type === "offer") {
                peer.current?.close();
                const receiver = new RTCPeerConnection();
                peer.current = receiver;
                receiver.ontrack = (e) => {
                  if (!disposed) setStream(e.streams[0]);
                };
                receiver.onicecandidate = (e) => {
                  if (e.candidate)
                    channel?.postMessage({
                      type: "candidate-output",
                      candidate: e.candidate.toJSON(),
                    });
                };
                await receiver.setRemoteDescription(event.data.offer);
                for (const candidate of candidates.splice(0))
                  await receiver.addIceCandidate(candidate);
                await receiver.setLocalDescription(
                  await receiver.createAnswer(),
                );
                channel?.postMessage({
                  type: "answer",
                  answer: receiver.localDescription?.toJSON(),
                });
                if (retry) clearInterval(retry);
              } else if (event.data.type === "candidate-studio") {
                if (peer.current?.remoteDescription)
                  await peer.current.addIceCandidate(event.data.candidate);
                else if (candidates.length < 32)
                  candidates.push(event.data.candidate);
              } else if (event.data.type === "stopped") {
                setStream(null);
                setStatus("Session stopped.");
                peer.current?.close();
              }
            } catch {
              setStatus("Local preview disconnected. Reload to reconnect.");
            }
          };
          channel.postMessage({ type: "ready" });
          retry = setInterval(
            () => channel?.postMessage({ type: "ready" }),
            3000,
          );
          setStatus(
            "Waiting for the local studio · mock preview requires the same browser.",
          );
        } else if (result.output) {
          peer.current = await connectRealtime(result.output, null, (s) => {
            if (!disposed) setStream(s);
          });
          peer.current.onconnectionstatechange = () => {
            if (
              ["failed", "disconnected", "closed"].includes(
                peer.current?.connectionState ?? "",
              )
            ) {
              setStream(null);
              setStatus("Output disconnected. Reload to reconnect.");
            }
          };
        } else
          setStatus("The inference service has not provided an output stream.");
      } catch (e) {
        if (!disposed)
          setStatus(e instanceof Error ? e.message : "Unable to connect.");
      }
    }
    void connect();
    const poll = setInterval(async () => {
      if (polling || ended || disposed) return;
      polling = true;
      try {
        const result = await api<{ status: string }>(
          `/api/v1/output/${id}?token=${encodeURIComponent(token)}`,
        );
        if (["failed", "stopped"].includes(result.status))
          throw new Error("Session ended.");
      } catch (e) {
        ended = true;
        clearInterval(poll);
        if (!disposed) {
          setStream(null);
          setStatus(e instanceof Error ? e.message : "Output disconnected.");
          peer.current?.close();
        }
      } finally {
        polling = false;
      }
    }, 10000);
    return () => {
      disposed = true;
      clearInterval(poll);
      if (retry) clearInterval(retry);
      channel?.close();
      peer.current?.close();
    };
  }, [id, token]);
  return (
    <div className="output">
      {stream ? (
        <StreamVideo stream={stream} muted={false} />
      ) : (
        <span className="output-state">{status}</span>
      )}
      {watermark && stream && (
        <span className="preview-watermark">shapre.</span>
      )}
      {mock && (
        <span
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            color: "#c5f47b",
            fontSize: 12,
          }}
        >
          DEVELOPMENT MOCK · ORIGINAL CAMERA
        </span>
      )}
    </div>
  );
}
