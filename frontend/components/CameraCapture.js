'use client';

import { useEffect, useRef, useState } from 'react';

export default function CameraCapture({ onCapture, label = 'Capture face' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function startCamera() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsStreaming(true);
    } catch (e) {
      setError('Camera permission is required. Use localhost or HTTPS and allow camera access.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setIsStreaming(false);
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isStreaming) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreview(dataUrl);
    onCapture?.(dataUrl);
  }

  function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
      onCapture?.(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl bg-slate-950">
        <video ref={videoRef} autoPlay playsInline muted className="h-72 w-full object-cover" />
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {preview && (
        <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">
          Face image captured. You can continue or recapture.
        </div>
      )}
      {error && <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={startCamera} className="btn-soft">
          Start camera
        </button>
        <button type="button" onClick={capture} disabled={!isStreaming} className="btn-primary">
          {label}
        </button>
        <button type="button" onClick={stopCamera} disabled={!isStreaming} className="btn-soft">
          Stop camera
        </button>
      </div>
    </div>
  );
}
