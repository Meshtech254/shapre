"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { initialMedia, MediaController } from "@/lib/media/controller";

export function useMedia(
  defaults: { camera?: string; microphone?: string } = {},
) {
  const [value, setValue] = useState(initialMedia);
  const [ready, setReady] = useState(false);
  const controller = useRef<MediaController | null>(null);
  const lifecycle = useRef({ generation: 0 });
  const configuredDefaults = useRef<string | undefined>(undefined);
  useEffect(() => {
    const lifetime = lifecycle.current;
    const currentGeneration = ++lifetime.generation;
    if (!navigator.mediaDevices?.getUserMedia) {
      setValue({
        ...initialMedia,
        error:
          "Camera access requires HTTPS or localhost and a compatible browser.",
      });
      return;
    }
    let preferences = {
      camera: defaults.camera,
      microphone: defaults.microphone,
    };
    try {
      preferences = {
        camera: localStorage.getItem("shapre-camera") ?? defaults.camera,
        microphone:
          localStorage.getItem("shapre-microphone") ?? defaults.microphone,
      };
    } catch {
      /* Storage may be blocked in private contexts. */
    }
    const defaultsKey = JSON.stringify([defaults.camera, defaults.microphone]);
    if (controller.current && configuredDefaults.current !== defaultsKey) {
      controller.current.dispose();
      controller.current = null;
    }
    const media =
      controller.current ??
      new MediaController(
        navigator.mediaDevices,
        setValue,
        undefined,
        (kind, id) => {
          try {
            localStorage.setItem(
              kind === "video" ? "shapre-camera" : "shapre-microphone",
              id,
            );
          } catch {
            /* Optional persistence. */
          }
        },
        preferences,
      );
    controller.current = media;
    configuredDefaults.current = defaultsKey;
    setReady(true);
    const refresh = () => {
      void media.refresh();
    };
    refresh();
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", refresh);
      window.removeEventListener("focus", refresh);
      queueMicrotask(() => {
        if (lifetime.generation !== currentGeneration) return;
        controller.current = null;
        media.dispose();
      });
    };
  }, [defaults.camera, defaults.microphone]);
  const setCamera = useCallback((id: string) => {
    void controller.current?.select("video", id);
  }, []);
  const setMicrophone = useCallback((id: string) => {
    void controller.current?.select("audio", id);
  }, []);
  const open = useCallback(
    () => controller.current?.open() ?? Promise.resolve(false),
    [],
  );
  const toggleCamera = useCallback(
    () => controller.current?.toggle("video"),
    [],
  );
  const toggleMic = useCallback(() => controller.current?.toggle("audio"), []);
  return {
    ...value,
    ready,
    setCamera,
    setMicrophone,
    open,
    toggleCamera,
    toggleMic,
  };
}
