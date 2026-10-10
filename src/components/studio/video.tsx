"use client";
import { memo, useEffect, useRef } from "react";
export const StreamVideo = memo(function StreamVideo({
  stream,
  muted = true,
}: {
  stream: MediaStream | null;
  muted?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (video) {
      if (video.srcObject !== stream) video.srcObject = stream;
      void video.play().catch(() => {});
    }
    return () => {
      if (video) video.srcObject = null;
    };
  }, [stream]);
  return <video ref={ref} autoPlay muted={muted} playsInline />;
});
