import React, { useState, useRef } from "react";

const API = "http://localhost:5000/api";

export default function App() {
  const [screen, setScreen] = useState("setup");
  const [alarmTime, setAlarmTime] = useState("");
  const [alarmLabel, setAlarmLabel] = useState("Wake Up!");
  const [task, setTask] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [detected, setDetected] = useState([]);
  const [mode, setMode] = useState("upload");
  const audioRef = useRef(null);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // ── helpers ──────────────────────────────────────────────────────────────────
  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.play().catch(() => {});
    }
  };
  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  };
  const stopStream = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };
  const fetchTask = async () => {
    try {
      const r = await fetch(`${API}/get-task`);
      const d = await r.json();
      setTask(d.task);
    } catch { setTask("bottle"); }
  };

  // ── alarm check ──────────────────────────────────────────────────────────────
  const startAlarmCheck = (time) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const now = new Date();
      const [h, m] = time.split(":").map(Number);
      if (now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 5) {
        clearInterval(timerRef.current);
        fireAlarm();
      }
    }, 1000);
  };

  const fireAlarm = async () => {
    await fetchTask();
    playAudio();
    setScreen("ringing");
  };

  // ── handlers ─────────────────────────────────────────────────────────────────
  const handleSetAlarm = () => {
    if (!alarmTime) { alert("Pick a time first!"); return; }
    startAlarmCheck(alarmTime);
    setScreen("setup");
    alert(`Alarm set for ${alarmTime} `);
  };

  const handleTestAlarm = async () => {
    await fetchTask();
    playAudio();
    setScreen("ringing");
  };

  const handleCaptureObject = () => {
    setScreen("verify");
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setPreview(ev.target.result); setImage(ev.target.result); setStatus("idle"); };
    reader.readAsDataURL(file);
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setMode("webcam");
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 150);
    } catch { alert("Camera access denied."); }
  };

  const captureWebcam = () => {
  const v = videoRef.current;

  if (!v || v.videoWidth === 0) {
    alert("Camera not ready yet! Wait 1 sec...");
    return;
  }

  const c = document.createElement("canvas");
  c.width = v.videoWidth;
  c.height = v.videoHeight;

  const ctx = c.getContext("2d");
  ctx.drawImage(v, 0, 0);

  const url = c.toDataURL("image/jpeg", 0.85);

  setPreview(url);
  setImage(url);
  setStatus("idle");

  stopStream();
  setMode("upload");
};  

  const handleVerify = async () => {
    if (!image) { alert("Upload or capture an image first!"); return; }
    setStatus("loading");
    try {
      const r = await fetch(`${API}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, task }),
      });
      const d = await r.json();
      setMessage(d.message);
      setDetected(d.detected_objects || []);
      setStatus(d.success ? "success" : "fail");
      if (d.success) { stopAudio(); setTimeout(() => setScreen("done"), 1800); }
    } catch { setMessage("Backend not reachable. Is Flask running?"); setStatus("fail"); }
  };

  const handleNewTask = async () => {
    await fetchTask();
    setImage(null); setPreview(null); setStatus("idle"); setMessage("");
  };

  const handleReset = () => {
    stopAudio(); stopStream();
    setScreen("setup"); setTask(""); setImage(null); setPreview(null);
    setStatus("idle"); setMessage(""); setMode("upload");
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <audio ref={audioRef} style={{ display: "none" }}>
        <source src="/alarm.mp4" type="video/mp4" />
        <source src="/alarm.mp3" type="audio/mpeg" />
      </audio>

      {/* ── SETUP ── */}
      {screen === "setup" && (
        <div className="card">
          <div className="icon"> </div>
          <h1>Smart Alarm</h1>
          <p className="subtitle">AI-powered wake-up enforcer</p>
          <div className="field">
            <label>Alarm Time</label>
            <input type="time" value={alarmTime} onChange={e => setAlarmTime(e.target.value)} />
          </div>
          <div className="field">
            <label>Label</label>
            <input type="text" placeholder="Wake Up!" value={alarmLabel} onChange={e => setAlarmLabel(e.target.value)} />
          </div>
          <button className="btn primary" onClick={handleSetAlarm}>Set Alarm</button>
          <button className="btn ghost dev-btn" onClick={handleTestAlarm}>⚡ Test Alarm Now</button>
        </div>
      )}

      {/* ── RINGING ── */}
      {screen === "ringing" && (
        <div className="card ringing">
          <div className="pulse-ring" />
          <div className="icon ring-icon"> </div>
          <h1>WAKE UP!</h1>
          <p className="alarm-label">{alarmLabel}</p>
          <div className="task-box">
            <p className="task-hint">To dismiss the alarm, find and photograph:</p>
            <div className="task-object">{task || "Loading..."}</div>
          </div>
          <button className="btn primary" onClick={handleCaptureObject}>
            Capture Object
          </button>
        </div>
      )}

      {/* ── VERIFY ── */}
      {screen === "verify" && (
        <div className="card">
          <div className="icon"> </div>
          <h2>Find the Object</h2>
          <div className="task-box">
            <p className="task-hint">Locate and photograph:</p>
            <div className="task-object">{task}</div>
          </div>

          <div className="btn-row" style={{ marginBottom: 0 }}>
            <button className={`btn ${mode === "upload" ? "primary" : "secondary"}`} style={{ marginTop: 0 }}
              onClick={() => { stopStream(); setMode("upload"); }}> Upload</button>
            <button className={`btn ${mode === "webcam" ? "primary" : "secondary"}`} style={{ marginTop: 0 }}
              onClick={startWebcam}>📷 Webcam</button>
          </div>

          {mode === "webcam" && (
            <div style={{ margin: "14px 0" }}>
             <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={() => {
                        console.log("Video ready");
                    }}
                    style={{ width: "100%", borderRadius: 14, background: "#000" }}
                />
              <button className="btn primary" style={{ marginTop: 10 }} onClick={captureWebcam}>
                 Capture Photo
              </button>
            </div>
          )}

          {mode === "upload" && (
            <div className="upload-area" onClick={() => fileRef.current.click()}>
              {preview
                ? <img src={preview} alt="preview" className="preview-img" />
                : <span> Click to upload an image</span>}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />

          {status === "loading" && <p className="status loading"> Analyzing with AI…</p>}
          {status === "success" && <p className="status success"> {message}</p>}
          {status === "fail" && (
            <>
              <p className="status fail"> {message}</p>
              {detected.length > 0 && <p className="detected">Detected: {detected.join(", ")}</p>}
            </>
          )}

          <div className="btn-row">
            <button className="btn secondary" onClick={handleNewTask}>↩ New Task</button>
            <button className="btn primary" onClick={handleVerify} disabled={!image || status === "loading"}>
              
               Verify
            </button>
          </div>
        </div>
      )}


      {screen === "done" && (
        <div className="card done">
          <div className="icon"></div>
          <h1>Good Morning!</h1>
          <p>Alarm dismissed. Have a productive day!</p>
          <button className="btn primary" onClick={handleReset}>Set New Alarm</button>
        </div>
      )}
    </div>
  );
}