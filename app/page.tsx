'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Globe, FileText, Clock, Trash2, Play, Pause, Save, Download, Menu, X } from 'lucide-react';

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
  const [micError, setMicError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  // Ref ini menyimpan status recording "real-time" supaya callback onend (yang dibuat
  // sekali oleh browser) selalu baca nilai terbaru, bukan nilai lama saat closure dibuat.
  const isRecordingRef = useRef(false);

  // Mobile sidebar (history panel) toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
      dlAudio: "Unduh Audio",
      micDenied: "Izin mikrofon ditolak. Buka pengaturan situs di browser Anda, lalu izinkan akses Mikrofon untuk halaman ini.",
      micNotFound: "Mikrofon tidak ditemukan di perangkat ini.",
      micNotSupported: "Browser ini tidak mendukung perekaman suara, atau halaman tidak diakses lewat koneksi aman (https).",
      micGeneric: "Gagal mengakses mikrofon. Pastikan izin mikrofon diizinkan di browser Anda.",
      speechNotSupported: "Browser ini tidak mendukung transkrip otomatis suara-ke-teks. Audio tetap direkam dan bisa diunduh, tapi teks tidak akan muncul otomatis. Coba gunakan Google Chrome versi terbaru.",
      speechError: "Transkrip suara terhenti karena gangguan koneksi atau browser. Audio tetap direkam.",
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
      dlAudio: "Download Audio",
      micDenied: "Microphone permission denied. Open the site settings in your browser and allow Microphone access for this page.",
      micNotFound: "No microphone was found on this device.",
      micNotSupported: "This browser doesn't support audio recording, or the page isn't loaded over a secure (https) connection.",
      micGeneric: "Failed to access the microphone. Please make sure microphone permission is allowed in your browser.",
      speechNotSupported: "This browser doesn't support automatic speech-to-text. Audio will still be recorded and can be downloaded, but text won't appear automatically. Try using the latest Google Chrome.",
      speechError: "Speech transcription stopped due to a connection or browser issue. Audio is still being recorded.",
    }
  }[lang];

  // Web Speech API Integration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        // Browser ini (misal beberapa versi Chrome Android, atau browser non-Chromium)
        // sama sekali tidak punya API ini. Beri tahu user secara eksplisit,
        // karena tanpa ini gejalanya cuma "diam saja tanpa teks" yang membingungkan.
        setSpeechSupported(false);
        return;
      }

      setSpeechSupported(true);
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

      // Chrome di Android sering menghentikan speech recognition secara otomatis
      // setelah jeda hening singkat, walau mic masih merekam normal lewat MediaRecorder.
      // onend akan dipanggil tiap kali itu terjadi, jadi kita restart otomatis
      // selama isRecordingRef.current masih true (dibaca dari ref, bukan state,
      // supaya tidak kena stale closure dari saat effect ini pertama dibuat).
      recognition.onend = () => {
        if (isRecordingRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // start() bisa throw kalau dipanggil saat instance masih dalam proses stop.
            // Coba sekali lagi sedikit setelahnya.
            setTimeout(() => {
              if (isRecordingRef.current && recognitionRef.current) {
                try { recognitionRef.current.start(); } catch (e2) {}
              }
            }, 300);
          }
        }
      };

      // Sebelumnya tidak ada handler ini sama sekali, jadi kalau speech recognition
      // gagal (network error, permission terpisah dari mic, dsb) tidak ada jejaknya
      // dan user cuma melihat kotak teks tetap kosong tanpa penjelasan.
      // SEMENTARA: tampilkan kode error apa adanya (termasuk no-speech/aborted)
      // supaya kita bisa diagnosis lewat layar HP tanpa perlu USB debugging.
      recognition.onerror = (event: any) => {
        setMicError(`[DEBUG] Speech error: ${event.error || 'unknown'}`);
      };

      recognition.onstart = () => {
        setMicError(`[DEBUG] Speech recognition STARTED`);
      };

      recognitionRef.current = recognition;

      return () => {
        try { recognition.stop(); } catch (e) {}
      };
    }
  }, [lang]);

  // Toggle Language Handler
  const toggleLanguage = () => {
    setLang((prev) => (prev === 'id' ? 'en' : 'id'));
  };

  // Start & Stop Recording Control
  const handleToggleRecording = async () => {
    if (isRecording) {
      isRecordingRef.current = false;
      setIsRecording(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } else {
      setMicError(null);

      // Cek dukungan API sebelum memanggil getUserMedia,
      // supaya pesan errornya jelas (bukan cuma "gagal mengakses mikrofon").
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicError(t.micNotSupported);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecordingRef.current = true;
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

        // Speech recognition tetap dicoba dijalankan kalau API-nya tersedia.
        // Kalau tidak tersedia sama sekali (speechSupported === false), kita beri tahu
        // user lewat banner, tapi rekaman audio tetap berjalan normal lewat MediaRecorder.
        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch (e) {}
        } else if (!speechSupported) {
          setMicError(t.speechNotSupported);
        }

        timerRef.current = setInterval(() => {
          setSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err: any) {
        // Pesan error spesifik berdasarkan jenis error dari browser,
        // supaya pengguna tahu langkah perbaikannya, bukan cuma "gagal".
        if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
          setMicError(t.micDenied);
        } else if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
          setMicError(t.micNotFound);
        } else {
          setMicError(t.micGeneric);
        }
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
    <div className="flex flex-col md:flex-row h-[100dvh] bg-[#0B0F19] text-slate-100 font-sans overflow-hidden">

      <audio ref={audioPlayerRef} className="hidden" />

      {/* MOBILE TOP BAR (hanya tampil di layar kecil) */}
      <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#111827] shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-tr from-violet-600 to-cyan-500 rounded-lg flex items-center">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-base font-bold">{t.title}</h1>
        </div>
        <button
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Buka riwayat catatan"
          className="p-2 rounded-lg bg-slate-800 text-slate-200"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* SIDEBAR (drawer di mobile, panel tetap di desktop) */}
      <AnimatePresence>
        {(isSidebarOpen) && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`
          fixed md:static top-0 left-0 z-50
          w-[85%] max-w-[320px] md:w-[350px]
          h-full md:h-auto
          bg-[#111827] border-r border-slate-800
          p-6 flex flex-col justify-between
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="flex flex-col h-[85%] overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-violet-600 to-cyan-500 rounded-xl flex items-center">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold hidden md:block">{t.title}</h1>
            </div>
            {/* Tombol tutup, hanya muncul di mobile drawer */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Tutup riwayat catatan"
              className="p-2 rounded-lg bg-slate-800 text-slate-200 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-[11px] font-bold text-slate-500 mb-4 tracking-widest">{t.historyHeader}</h2>

          <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => { setTextResult(item.text); setIsSidebarOpen(false); }}
                className="p-4 bg-slate-800 border border-slate-700 rounded-xl relative cursor-pointer"
              >
                {/* Delete Button */}
                <button
                  onClick={(e) => handleDeleteHistory(item.id, e)}
                  className="absolute top-3.5 right-3.5 bg-transparent border-none text-slate-400 hover:text-red-500 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <h3 className="text-sm font-medium m-0 text-slate-200 pr-5">{item.title}</h3>
                <p className="text-[11px] text-slate-500 mt-1 mb-2.5">{item.date}</p>

                {/* Info & Player Row */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-950 px-2 py-1 rounded-md">
                    <Clock className="w-3 h-3 text-cyan-500" />
                    {item.duration}
                  </div>

                  {item.audioUrl && (
                    <button
                      onClick={(e) => handlePlayAudio(item, e)}
                      className={`flex items-center gap-1 text-[11px] text-white border-none px-2 py-1 rounded-md cursor-pointer ${playingId === item.id ? 'bg-red-500' : 'bg-emerald-600'}`}
                    >
                      {playingId === item.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      {playingId === item.id ? "Pause" : "Play Audio"}
                    </button>
                  )}
                </div>

                {/* ACTION DOWNLOAD BUTTONS */}
                <div className="flex gap-2 border-t border-slate-700 pt-2.5">
                  <button
                    onClick={(e) => downloadTextFile(item, e)}
                    className="flex items-center justify-center gap-1 text-[11px] text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2 py-1 rounded-md cursor-pointer flex-1"
                  >
                    <Download className="w-3 h-3" />
                    {t.dlText}
                  </button>

                  {item.audioBlob ? (
                    <button
                      onClick={(e) => downloadAudioFile(item, e)}
                      className="flex items-center justify-center gap-1 text-[11px] text-violet-400 bg-violet-400/10 border border-violet-400/20 px-2 py-1 rounded-md cursor-pointer flex-1"
                    >
                      <Download className="w-3 h-3" />
                      {t.dlAudio}
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-600 italic self-center flex-1 text-center">{t.noAudio}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Language Selection Switch Toggle */}
        <button
          onClick={toggleLanguage}
          className="flex items-center justify-between gap-2 bg-transparent border-none cursor-pointer pt-4"
        >
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-cyan-500" />
            <span>{t.langLabel}</span>
          </div>
          <span className="text-xs">
            {lang.toUpperCase()}
          </span>
        </button>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col justify-between p-4 md:p-8 relative overflow-hidden">

        {/* HEADER (disembunyikan di mobile karena sudah ada top bar) */}
        <header className="hidden md:flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-sm text-slate-400">
              {isRecording ? t.recordingLive : t.systemReady}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {!isRecording && textResult && (
              <button
                onClick={handleSaveToHistory}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white border-none rounded-lg cursor-pointer text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                {t.saveBtn}
              </button>
            )}
            <div className="text-2xl font-mono font-bold text-slate-300 bg-slate-950 px-4 py-1.5 rounded-xl border border-slate-800">
              {formatTime(seconds)}
            </div>
          </div>
        </header>

        {/* STATUS ROW — versi ringkas untuk mobile */}
        <div className="flex md:hidden items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-xs text-slate-400">
              {isRecording ? t.recordingLive : t.systemReady}
            </span>
          </div>
          <div className="text-lg font-mono font-bold text-slate-300 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
            {formatTime(seconds)}
          </div>
        </div>

        {/* PESAN ERROR MIKROFON */}
        {micError && (
          <div className="mt-3 md:mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs md:text-sm flex items-start justify-between gap-3">
            <span>{micError}</span>
            <button onClick={() => setMicError(null)} className="shrink-0 text-red-400/70 hover:text-red-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PERINGATAN: browser tidak mendukung transkrip otomatis sama sekali */}
        {!speechSupported && !micError && (
          <div className="mt-3 md:mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs md:text-sm">
            {t.speechNotSupported}
          </div>
        )}

        {/* WORKSPACE MAIN TEXT BOX */}
        <div className="my-4 md:my-6 flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 md:p-6 relative overflow-y-auto min-h-0">
          {textResult ? (
            <div className="w-full h-full flex flex-col justify-between">
              <p className="text-base md:text-lg leading-relaxed text-slate-200 m-0 whitespace-pre-wrap">{textResult}</p>

              {!isRecording && (
                <button
                  onClick={() => { setTextResult(''); setSeconds(0); audioChunksRef.current = []; }}
                  className="self-end mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-md cursor-pointer text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Workspace
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 text-center px-4">
              <FileText className="w-10 h-10 md:w-12 md:h-12 mb-3" />
              <p className="text-sm m-0">{t.placeholder}</p>
            </div>
          )}

          {/* Tombol simpan untuk mobile, karena header desktop disembunyikan */}
          {!isRecording && textResult && (
            <button
              onClick={handleSaveToHistory}
              className="md:hidden mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white border-none rounded-lg cursor-pointer text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {t.saveBtn}
            </button>
          )}
        </div>

        {/* FOOTER MIC BUTTON & ANIMATION */}
        <footer className="flex flex-col items-center gap-4 md:gap-6 shrink-0 pb-2">

          {/* EQUALIZER SIMULATION */}
          <div className="h-12 flex items-center gap-1.5">
            <AnimatePresence>
              {isRecording && (
                [...Array(11)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 rounded-full bg-gradient-to-t from-cyan-500 to-violet-600"
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
            className={`p-5 rounded-full border-none cursor-pointer flex items-center justify-center shadow-xl ${isRecording ? 'bg-red-500' : 'bg-violet-600'} text-white`}
          >
            {isRecording ? <Square className="w-7 h-7 fill-white" /> : <Mic className="w-7 h-7" />}
          </motion.button>
        </footer>
      </main>
    </div>
  );
}