import { useEffect, useRef, useState } from 'react';

function QrAttendanceScanner({ onScan }) {
  const readerId = 'qr-reader';
  const qrRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let instance = null;

    // Dynamic import to avoid SSR and initial render issues
    const init = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        instance = new Html5Qrcode(readerId);
        qrRef.current = instance;
      } catch (e) {
        // Library may not be available; scanner is optional
        setError('QR scanner library failed to load');
      }
    };

    init();

    return () => {
      const cleanup = async () => {
        try {
          if (instance && instance.isScanning) {
            await instance.stop();
          }
        } catch {
          // ignore
        }
        try {
          if (instance) {
            instance.clear();
          }
        } catch {
          // ignore
        }
      };
      cleanup();
    };
  }, []);

  const startScanner = async () => {
    setError('');
    if (!qrRef.current) {
      setError('Scanner not initialized');
      return;
    }

    try {
      await qrRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          onScan(decodedText, 'camera');
        },
        () => { }
      );
      setRunning(true);
    } catch (e) {
      setError(e.message || 'Unable to start scanner');
    }
  };

  const stopScanner = async () => {
    if (!qrRef.current || !qrRef.current.isScanning) return;
    try {
      await qrRef.current.stop();
      setRunning(false);
    } catch {
      // ignore
    }
  };

  const scanFromFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !qrRef.current) return;

    try {
      const decodedText = await qrRef.current.scanFile(file, true);
      onScan(decodedText, 'file');
      setError('');
    } catch (e) {
      setError('Failed to decode QR from selected file');
    }
  };

  return (
    <section className="card">
      <h3>QR Scanner</h3>
      <div id={readerId} className="qr-reader" />
      <div className="row-gap">
        {!running ? (
          <button type="button" className="btn" onClick={startScanner}>
            Start Camera Scan
          </button>
        ) : (
          <button type="button" className="btn danger" onClick={stopScanner}>
            Stop Camera
          </button>
        )}
        <label className="btn ghost" htmlFor="qr-file-upload">
          Scan from File
        </label>
        <input id="qr-file-upload" type="file" accept="image/*" onChange={scanFromFile} hidden />
      </div>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

export default QrAttendanceScanner;
