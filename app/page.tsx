'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Globe, FileText, Clock, Trash2, Play, Pause, Save, Download } from 'lucide-react';

interface HistoryItem {
  id: number;
  title: string;
  date: string;
  duration: string;
  text: string;
  audioUrl: string | null;
  audioBlob: Blob | null; // Kita simpan Blob aslinya di sini untuk fitur download fisik
}

export default function Home() {
  const [lang, setLang] = useState<'id' | 'en'>('id');
  const [isRecording, setIsRecording] = useState(false);
  const [textResult, setTextResult] = useState('');
  const [seconds, setSeconds] = useState(0);
  
  // Audio Playback State for History
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Speech & Audio Recording Refs
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Default History Data
  const [history, setHistory] = useState<HistoryItem[]>([
    { 
      id: 1, 
      title: "Rapat Proyek Smart App", 
      date: "Selasa, 16 Juni 2026", 
      duration: "00:05:24", 
      text: "Cek cek halo halo ini adalah contoh rekaman rapat proyek aplikasi pintar.",
      audioUrl: null,
      audioBlob: null
    },
    { 
      id: 2, 
      title: "Sesi Kelas Online", 
      date: "Senin, 15 Juni 2026", 
      duration: "01:45:10", 
      text: "Materi hari ini membahas mengenai implementasi sistem kecerdasan buatan dalam memproses suara.",
      audioUrl: null,
      audioBlob: null
    }
  ]);

  // Kamus Bahasa (Localization Dictionary)
  const t = {
    id: {
      title: "Smart Voice Note",
      historyHeader: "RIWAYAT CATATAN",
      systemReady: "Sistem Siap",
      recordingLive: "Merekam Langsung",
      placeholder: "Suara Anda akan otomatis diketik di sini secara real-time...",
      langLabel: "Bahasa",
      saveBtn: "Simpan Catatan & Suara",
      noAudio: "Tanpa Rekaman Audio",
      defaultNoteTitle: "Catatan Suara Baru",
      dlText: "Unduh Teks",
      dlAudio: "Unduh Audio"
    },
    en: {
      title: "Smart Voice Note",
      historyHeader: "NOTE HISTORY",
      systemReady: "System Ready",
      recordingLive: "Recording Live",
      placeholder: "Your voice will be automatically typed here in real-time...",
      langLabel: "Language",
      saveBtn: "Save Note & Audio",
      noAudio: "No Audio Recording",
      defaultNoteTitle: "New Voice Note",
      dlText: "Download TXT",
      dlAudio: "Download Audio"
    }
  }[lang];

  // Web Speech API Integration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang === 'id' ? 'id-ID' : 'en-US';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              currentTranscript += event.results[i][0].transcript + ' ';
            }
          }
          if (currentTranscript) {
            setTextResult((prev) => prev + currentTranscript);
          }
        };

        recognition.onend = () => {
          if (isRecording && recognitionRef.current) {
            try { recognitionRef.current.start(); } catch (e) {}
          }
        };

        recognitionRef.current = recognition;
      }
    }
  }, [isRecording, lang]);

  // Toggle Language Handler
  const toggleLanguage = () => {
    setLang((prev) => (prev === 'id' ? 'en' : 'id'));
  };

  // Start & Stop Recording Control
  const handleToggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsRecording(true);
        setSeconds(0);
        setTextResult('');
        audioChunksRef.current = [];

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();

        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch (e) {}
        }

        timerRef.current = setInterval(() => {
          setSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        alert("Gagal mengakses mikrofon. Pastikan izin mikrofon diijinkan di browser Anda.");
      }
    }
  };

  // Save to History (Text + Audio File blob URL)
  const handleSaveToHistory = () => {
    if (!textResult.trim() && audioChunksRef.current.length === 0) return;

    let audioUrl: string | null = null;
    let finalBlob: Blob | null = null;
    
    if (audioChunksRef.current.length > 0) {
      finalBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioUrl = URL.createObjectURL(finalBlob);
    }

    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateString = today.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', options);

    const newItem: HistoryItem = {
      id: Date.now(),
      title: `${t.defaultNoteTitle} #${history.length + 1}`,
      date: dateString,
      duration: formatTime(seconds),
      text: textResult || "(Catatan Kosong)",
      audioUrl: audioUrl,
      audioBlob: finalBlob
    };

    setHistory([newItem, ...history]);
    setTextResult('');
    setSeconds(0);
    audioChunksRef.current = [];
  };

  // Delete History Item
  const handleDeleteHistory = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingId === id) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      setPlayingId(null);
    }
    setHistory(history.filter(item => item.id !== id));
  };

  // Play / Pause Audio Record in History
  const handlePlayAudio = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.audioUrl) return;

    if (playingId === item.id) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      setPlayingId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = item.audioUrl;
        audioPlayerRef.current.play();
        setPlayingId(item.id);
        audioPlayerRef.current.onended = () => setPlayingId(null);
      }
    }
  };

  // FITUR DOWNLOAD TEKS (.txt)
  const downloadTextFile = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const element = document.createElement("a");
    const file = new Blob([item.text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${item.title}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // FITUR DOWNLOAD AUDIO ASLI (.webm)
  const downloadAudioFile = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.audioBlob) return;
    const element = document.createElement("a");
    element.href = URL.createObjectURL(item.audioBlob);
    element.download = `${item.title}.webm`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0B0F19', color: '#F1F5F9', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      <audio ref={audioPlayerRef} style={{ display: 'none' }} />

      {/* SIDEBAR */}
      <aside style={{ width: '350px', backgroundColor: '#111827', borderRight: '1px solid #1E293B', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '85%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{ padding: '10px', background: 'linear-gradient(to top right, #7C3AED, #06B6D4)', borderRadius: '12px', display: 'flex', alignItems: 'center' }}>
              <Mic style={{ width: '24px', height: '24px', color: '#FFF' }} />
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{t.title}</h1>
          </div>
          
          <h2 style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '16px', letterSpacing: '1.5px' }}>{t.historyHeader}</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
            {history.map((item) => (
              <div 
                key={item.id} 
                onClick={() => setTextResult(item.text)}
                style={{ padding: '16px', backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}
              >
                {/* Delete Button */}
                <button 
                  onClick={(e) => handleDeleteHistory(item.id, e)}
                  style={{ position: 'absolute', top: '14px', right: '14px', backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                >
                  <Trash2 style={{ width: '16px', height: '16px' }} />
                </button>

                <h3 style={{ fontSize: '14px', fontWeight: '500', margin: 0, color: '#E2E8F0', paddingRight: '20px' }}>{item.title}</h3>
                <p style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', marginBottom: '10px' }}>{item.date}</p>
                
                {/* Info & Player Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94A3B8', backgroundColor: '#0F172A', padding: '4px 8px', borderRadius: '6px' }}>
                    <Clock style={{ width: '12px', height: '12px', color: '#06B6D4' }} />
                    {item.duration}
                  </div>

                  {item.audioUrl && (
                    <button
                      onClick={(e) => handlePlayAudio(item, e)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#FFF', backgroundColor: playingId === item.id ? '#EF4444' : '#059669', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      {playingId === item.id ? <Pause style={{ width: '12px', height: '12px' }} /> : <Play style={{ width: '12px', height: '12px' }} />}
                      {playingId === item.id ? "Pause" : "Play Audio"}
                    </button>
                  )}
                </div>

                {/* ACTION DOWNLOAD BUTTONS */}
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #2D3748', paddingTop: '10px' }}>
                  <button
                    onClick={(e) => downloadTextFile(item, e)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#38BDF8', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', flex: 1, justifyContent: 'center' }}
                  >
                    <Download style={{ width: '12px', height: '12px' }} />
                    {t.dlText}
                  </button>

                  {item.audioBlob ? (
                    <button
                      onClick={(e) => downloadAudioFile(item, e)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#A78BFA', backgroundColor: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.2)', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', flex: 1, justifyContent: 'center' }}
                    >
                      <Download style={{ width: '12px', height: '12px' }} />
                      {t.dlAudio}
                    </button>
                  ) : (
                    <span style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic', alignSelf: 'center', flex: 1, textAlign: 'center' }}>{t.noAudio}</span>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Language Selection Switch Toggle */}
        {/* @ts-ignore */}
        <button
  onClick={toggleLanguage}
  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: 'none', border: 'none', cursor: 'pointer' }}
>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <Globe style={{ width: 16, height: 16, color: '#06B6D4' }} />
    <span>{t.langLabel}</span>
  </div>
  <span style={{ fontSize: 12 }}>
    {lang.toUpperCase()}
  </span>
</button>
      </aside>

      {/* MAIN WORKSPACE */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px', position: 'relative' }}>
        
        {/* HEADER */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ height: '10px', width: '10px', borderRadius: '50%', backgroundColor: isRecording ? '#EF4444' : '#10B981' }} />
            <span style={{ fontSize: '14px', color: '#94A3B8' }}>
              {isRecording ? t.recordingLive : t.systemReady}
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Save Button */}
            {!isRecording && textResult && (
              <button
                onClick={handleSaveToHistory}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#059669', color: '#FFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
              >
                <Save style={{ width: '16px', height: '16px' }} />
                {t.saveBtn}
              </button>
            )}
            <div style={{ fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold', color: '#CBD5E1', backgroundColor: '#0F172A', padding: '6px 16px', borderRadius: '12px', border: '1px solid #1E293B' }}>
              {formatTime(seconds)}
            </div>
          </div>
        </header>

        {/* WORKSPACE MAIN TEXT BOX */}
        <div style={{ margin: '24px 0', flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.5)', border: '1px solid #1E293B', borderRadius: '16px', padding: '24px', position: 'relative', overflowY: 'auto' }}>
          {textResult ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '18px', lineHeight: '1.6', color: '#E2E8F0', margin: 0, whiteSpace: 'pre-wrap' }}>{textResult}</p>
              
              {!isRecording && (
                <button 
                  onClick={() => { setTextResult(''); setSeconds(0); audioChunksRef.current = []; }}
                  style={{ alignSelf: 'flex-end', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#EF4444', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                >
                  <Trash2 style={{ width: '14px', height: '14px' }} />
                  Clear Workspace
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', textAlign: 'center' }}>
              <FileText style={{ width: '48px', height: '48px', marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', margin: 0 }}>{t.placeholder}</p>
            </div>
          )}
        </div>

        {/* FOOTER MIC BUTTON & ANIMATION */}
        <footer style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          
          {/* EQUALIZER SIMULATION */}
          <div style={{ height: '48px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AnimatePresence>
              {isRecording && (
                [...Array(11)].map((_, i) => (
                  <motion.div
                    key={i}
                    style={{ width: '6px', background: 'linear-gradient(to top, #06B6D4, #7C3AED)', borderRadius: '9999px' }}
                    animate={{ height: [12, i % 2 === 0 ? 45 : 28, 12] }}
                    transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                  />
                ))
              )}
            </AnimatePresence>
          </div>

          {/* RECORD TRIGGER MIC TRIGGER */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleRecording}
            style={{
              padding: '20px',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              backgroundColor: isRecording ? '#EF4444' : '#7C3AED',
              color: '#FFF'
            }}
          >
            {isRecording ? <Square style={{ width: '28px', height: '28px', fill: '#FFF' }} /> : <Mic style={{ width: '28px', height: '28px' }} />}
          </motion.button>
        </footer>
      </main>
    </div>
  );
}