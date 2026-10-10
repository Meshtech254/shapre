"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client-api";
import { connectRealtime, replaceInput } from "@/lib/streaming/webrtc";
import type { InferenceSession } from "@/lib/inference/protocol";
import type { StudioSettings } from "@/lib/validation";
import { studioMetrics } from "@/lib/streaming/diagnostics";
interface SessionResponse {
  sessionId: string;
  inference: InferenceSession;
  outputUrl: string;
  watermark: boolean;
  trial?: boolean;
  expiresAt?: string;
}
export function useStudioSession(
  personaId: string,
  settings: StudioSettings,
  stream: MediaStream | null,
  demoSlug?: string,
) {
  const [session, setSession] = useState<SessionResponse>();
  const [output, setOutput] = useState<MediaStream | null>(null);
  const [state, setState] = useState("waiting for camera");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const peer = useRef<RTCPeerConnection | null>(null);
  const bridge = useRef<RTCPeerConnection | null>(null);
  const outputChannel = useRef<BroadcastChannel | null>(null);
  const sessionRef = useRef<SessionResponse | undefined>(undefined);
  const inputRef = useRef(stream);
  inputRef.current = stream;
  const replacements = useRef(Promise.resolve());
  const mounted = useRef(true);
  const operationLock = useRef(false);
  const recovering = useRef(true);
  useEffect(() => {
    if (!session) return;
    if (session.inference.mock) setOutput(stream);
    // Serialize replacements so rapid selection changes cannot restore old tracks.
    replacements.current = replacements.current
      .then(async () => {
        for (const publisher of [peer.current, bridge.current]) {
          if (publisher && publisher.signalingState !== "closed")
            await replaceInput(publisher, inputRef.current);
        }
      })
      .catch(() => {
        setOutput(null);
        setState("disconnected");
        setError(
          "The worker could not switch media tracks. Raw preview is available; stop and restart AI to reconnect.",
        );
      });
  }, [stream, session]);
  useEffect(() => {
    if (sessionRef.current) {
      recovering.current = false;
      setBusy(false);
      return;
    }
    let cancelled = false;
    api<SessionResponse | null>("/api/v1/sessions")
      .then((value) => {
        if (!cancelled && value) {
          setSession(value);
          sessionRef.current = value;
          setState("disconnected");
          setError(
            "An earlier session is active. Stop it before starting another.",
          );
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Could not recover your session.",
          );
      })
      .finally(() => {
        recovering.current = false;
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Strict Mode can disconnect/reconnect effects in the same commit.
      // Release resources only if setup has not resumed before this microtask.
      queueMicrotask(() => {
        if (mounted.current) return;
        peer.current?.close();
        bridge.current?.close();
        outputChannel.current?.close();
        peer.current = null;
        bridge.current = null;
        outputChannel.current = null;
        if (sessionRef.current)
          navigator.sendBeacon(
            `/api/v1/sessions/${sessionRef.current.sessionId}/stop`,
          );
      });
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    let running = true;
    let fetching = false;
    const timer = setInterval(async () => {
      if (!running || fetching) return;
      fetching = true;
      try {
        const status = await api<{ status: string; latency_ms?: number }>(
          `/api/v1/sessions/${session.sessionId}`,
        );
        if (!running) return;
        studioMetrics.latencyMs = status.latency_ms;
        if (["failed", "stopped"].includes(status.status)) {
          setState(status.status);
          setError(
            "The session has ended. Stop the session to clear it and reconnect.",
          );
          peer.current?.close();
          bridge.current?.close();
          outputChannel.current?.postMessage({ type: "stopped" });
          clearInterval(timer);
          setOutput(null);
        }
      } catch (e) {
        if (running) {
          clearInterval(timer);
          peer.current?.close();
          bridge.current?.close();
          setState("disconnected");
          setOutput(null);
          setError(e instanceof Error ? e.message : "Session disconnected.");
        }
      } finally {
        fetching = false;
      }
    }, 5000);
    return () => {
      running = false;
      clearInterval(timer);
    };
  }, [session]);
  const mockBridge = useCallback((id: string, input: MediaStream) => {
    const channel = new BroadcastChannel(`shapre-output-${id}`);
    const candidates: RTCIceCandidateInit[] = [];
    outputChannel.current = channel;
    channel.onmessage = async (event) => {
      try {
        if (event.data.type === "ready") {
          if (
            bridge.current &&
            !["failed", "disconnected", "closed"].includes(
              bridge.current.connectionState,
            )
          )
            return;
          bridge.current?.close();
          const sender = new RTCPeerConnection();
          bridge.current = sender;
          const latest = inputRef.current ?? input;
          for (const kind of ["video", "audio"] as const) {
            const track = latest.getTracks().find((t) => t.kind === kind);
            if (track)
              sender.addTransceiver(track, {
                direction: "sendonly",
                streams: [latest],
              });
            else sender.addTransceiver(kind, { direction: "sendonly" });
          }
          sender.onicecandidate = (e) => {
            if (e.candidate)
              channel.postMessage({
                type: "candidate-studio",
                candidate: e.candidate.toJSON(),
              });
          };
          await sender.setLocalDescription(await sender.createOffer());
          channel.postMessage({
            type: "offer",
            offer: sender.localDescription?.toJSON(),
          });
        } else if (event.data.type === "answer") {
          await bridge.current?.setRemoteDescription(event.data.answer);
          for (const candidate of candidates.splice(0))
            await bridge.current?.addIceCandidate(candidate);
        } else if (event.data.type === "candidate-output") {
          if (bridge.current?.remoteDescription)
            await bridge.current.addIceCandidate(event.data.candidate);
          else if (candidates.length < 32)
            candidates.push(event.data.candidate);
        }
      } catch {
        toast.error("Local OBS preview could not connect.");
      }
    };
  }, []);
  useEffect(() => {
    if (
      session?.inference.mock &&
      stream?.getVideoTracks().some((t) => t.readyState === "live") &&
      !outputChannel.current
    ) {
      mockBridge(session.sessionId, stream);
      setOutput(stream);
      setState("mock connected");
      setError("");
    }
  }, [session, stream, mockBridge]);
  async function start() {
    if (
      operationLock.current ||
      recovering.current ||
      sessionRef.current ||
      (!personaId && !demoSlug) ||
      !stream?.getVideoTracks().some((t) => t.readyState === "live")
    )
      return;
    operationLock.current = true;
    setBusy(true);
    setError("");
    setState("connecting");
    let created: SessionResponse | undefined;
    const connectionStart = performance.now();
    try {
      created = await api<SessionResponse>("/api/v1/sessions", {
        method: "POST",
        body: JSON.stringify({
          ...(demoSlug ? { demoPersonaSlug: demoSlug } : { personaId }),
          settings,
        }),
      });
      if (!mounted.current) {
        void api(`/api/v1/sessions/${created.sessionId}/stop`, {
          method: "POST",
        }).catch(() => {});
        return;
      }
      sessionRef.current = created;
      setSession(created);
      if (created.inference.mock) {
        mockBridge(created.sessionId, stream);
        setOutput(stream);
        setState("mock connected");
      } else if (created.inference.realtime) {
        peer.current = await connectRealtime(
          created.inference.realtime,
          stream,
          setOutput,
        );
        if (!mounted.current) {
          peer.current.close();
          return;
        }
        peer.current.onconnectionstatechange = () => {
          const s = peer.current?.connectionState;
          if (s === "connected") setState("live");
          if (s === "failed" || s === "disconnected") {
            setState("disconnected");
            setOutput(null);
            setError("Media connection lost. Stop your session and reconnect.");
          }
        };
        setState("connected");
        // Capture may have changed while the worker was negotiating.
        await replaceInput(peer.current, inputRef.current);
      } else
        throw new Error(
          "No realtime connection was returned by the inference service.",
        );
      toast.success(
        created.inference.mock
          ? "Mock session connected — original camera only"
          : "Studio session connected",
      );
      studioMetrics.connectionMs = Math.round(
        performance.now() - connectionStart,
      );
    } catch (e) {
      peer.current?.close();
      setOutput(null);
      setError(e instanceof Error ? e.message : "Could not connect.");
      setState("error");
      if (created) {
        try {
          await api(`/api/v1/sessions/${created.sessionId}/stop`, {
            method: "POST",
          });
          setSession(undefined);
          sessionRef.current = undefined;
        } catch {
          /* Keep the session recoverable for an explicit stop. */
        }
      }
    } finally {
      operationLock.current = false;
      setBusy(false);
    }
  }
  async function stop() {
    if (operationLock.current || !sessionRef.current) return;
    operationLock.current = true;
    const currentSession = sessionRef.current;
    setBusy(true);
    peer.current?.close();
    bridge.current?.close();
    outputChannel.current?.postMessage({ type: "stopped" });
    setOutput(null);
    try {
      await api(`/api/v1/sessions/${currentSession.sessionId}/stop`, {
        method: "POST",
      });
      outputChannel.current?.postMessage({ type: "stopped" });
      outputChannel.current?.close();
      bridge.current?.close();
      peer.current?.close();
      outputChannel.current = null;
      bridge.current = null;
      peer.current = null;
      setOutput(null);
      setSession(undefined);
      sessionRef.current = undefined;
      setState("ready");
      setError("");
      toast.success("Session stopped");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not stop session.");
    } finally {
      operationLock.current = false;
      setBusy(false);
    }
  }
  return {
    session,
    output,
    state,
    setState,
    error,
    busy,
    start,
    stop,
  };
}
