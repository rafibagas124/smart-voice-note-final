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
  audioBlob: Blob | null;
}

export default function Home() {
  const [lang, setLang] = useState<'id' | 'en'>('id');
  const [isRecording, setIsRecording] = useState(false);
  const [textResult, setTextResult] = useState('');
  const [seconds, setSeconds] = useState(0);
  
  // Mobile Sidebar Toggle
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

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'id' ? 'en' : 'id'));
  };

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
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Protokol tidak aman.");
        }

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
        alert("Gagal mengakses mikrofon.\n\n1. Pastikan link diawali dengan https:// (BUKAN http://)\n2. Berikan izin perekaman mic pada pengaturan browser HP Anda.");
      }
    }
  };

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
    setIsSidebarOpen(false); // Tutup drawer riwayat di HP setelah simpan
  };

  const handleDeleteHistory = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingId === id) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      setPlayingId(null);
    }
    setHistory(history.filter(item => item.id !== id));
  };

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
    <div className="flex flex-col md:flex-row h-screen bg-[#0B0F19] text-[#F1F5F9] font-sans overflow-hidden relative">
      
      <audio ref={audioPlayerRef} className="hidden" />

      {/* HEADER NAV BAR UNTUK MOBILE/HP ONLY */}
      <div className="flex md:hidden items-center justify-between p-4 bg-[#111827] border-b border-[#1E293B] z-40">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-tr from-[#7C3AED] to-[#06B6D4] rounded-lg flex items-center">
            <Mic className="w-[18px] h-[18px] text-white" />
          </div>
          <h1 className="text-base font-bold m-0">{t.title}</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="bg-transparent border-none text-white cursor-pointer p-1"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* SIDEBAR RIWAYAT (Desktop: Normal, Mobile: Slide-in/Toggle Drawer) */}
      <aside className={`
        ${isSidebarOpen ? 'flex' : 'hidden'} 
        md:flex flex-col justify-between
        w-full md:w-[350px] 
        h-[calc(100vh-61px)] md:h-screen 
        bg-[#111827] border-r border-[#1E293B] p-6 
        absolute md:relative top-[61px] md:top-0 left-0 
        z-30 box-border
      `}>
        <div className="flex flex-col h-[90%]">
          {/* Logo Sidebar Desktop Only */}
          <div className="hidden md:flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-gradient-to-tr from-[#7C3AED] to-[#06B6D4] rounded-xl flex items-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold m-0">{t.title}</h1>
          </div>
          
          <h2 className="text-[11px] font-bold text-[#64748B] mb-4 tracking-wider">{t.historyHeader}</h2>
          
          {/* List Item Riwayat */}
          <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
            {history.map((item) => (
              <div 
                key={item.id} 
                onClick={() => { setTextResult(item.text); setIsSidebarOpen(false); }}
                className="p-4 bg-[#1F2937] border border-[#374151] rounded-xl relative cursor-pointer hover:border-[#4B5563] transition-colors"
              >
                <button 
                  onClick={(e) => handleDeleteHistory(item.id, e)}
                  className="absolute top-3.5 right-3.5 bg-transparent border-none text-[#94A3B8] hover:text-[#EF4444] cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <h3 className="text-sm font-medium m-0 text-[#E2E8F0] pr-5 truncate">{item.title}</h3>
                <p className="text-[11px] text-[#64748B] mt-1 mb-2.5">{item.date}</p>
                
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="flex items-center gap-1 text-[11px] text-[#94A3B8] bg-[#0F172A] px-2 py-1 rounded-md">
                    <Clock className="w-3 h-3 text-[#06B6D4]" />
                    {item.duration}
                  </div>

                  {item.audioUrl && (
                    <button
                      onClick={(e) => handlePlayAudio(item, e)}
                      className={`flex items-center gap-1 text-[11px] text-white border-none px-2 py-1 rounded-md cursor-pointer ${playingId === item.id ? 'bg-[#EF4444]' : 'bg-[#059669]'}`}
                    >
                      {playingId === item.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      {playingId === item.id ? "Pause" : "Play Audio"}
                    </button>
                  )}
                </div>

                <div className="flex gap-2 border-t border-[#2D3748] pt-2.5">
                  <button
                    onClick={(e) => downloadTextFile(item, e)}
                    className="flex items-center gap-1 text-[11px] text-[#38BDF8] bg-[rgba(56,189,248,0.1)] border border-[rgba(56,189,248,0.2)] px-2 py-1 rounded-md cursor-pointer flex-1 justify-center hover:bg-[rgba(56,189,248,0.2)] transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    {t.dlText}
                  </button>

                  {item.audioBlob ? (
                    <button
                      onClick={(e) => downloadAudioFile(item, e)}
                      className="flex items-center gap-1 text-[11px] text-[#A78BFA] bg-[rgba(167,139,250,0.1)] border border-[rgba(167,139,250,0.2)] px-2 py-1 rounded-md cursor-pointer flex-1 justify-center hover:bg-[rgba(167,139,250,0.2)] transition-colors"
                  >
                      <Download className="w-3 h-3" />
                      {t.dlAudio}
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#475569] italic self-center flex-1 text-center">{t.noAudio}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tombol Ganti Bahasa di Bawah Sidebar */}
        <button
          onClick={toggleLanguage}
          className="flex items-center justify-between gap-2 bg-transparent border-none cursor-pointer w-full py-2.5 text-[#F1F5F9]"
        >
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-[#06B6D4]" />
            <span className="text-sm font-medium">{t.langLabel}</span>
          </div>
          <span className="text-xs font-semibold bg-[#1F2937] px-2 py-0.5 rounded border border-[#374151]">
            {lang.toUpperCase()}
          </span>
        </button>
      </aside>

      {/* MAIN WORKSPACE (Area Utama Workspace Catatan) */}
      <main className={`flex-1 flex flex-col justify-between p-4 md:p-8 overflow-hidden ${isSidebarOpen ? 'hidden md:flex' : 'flex'}`}>
        
        {/* WORKSPACE HEADER */}
        <header className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-[#EF4444] animate-pulse' : 'bg-[#10B981]'}`} />
            <span className="text-sm text-[#94A3B8]">
              {isRecording ? t.recordingLive : t.systemReady}
            </span>
          </div>
          
          <div className="flex items-center gap-3 ml-auto">
            {!isRecording && textResult && (
              <button
                onClick={handleSaveToHistory}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#059669] hover:bg-[#047857] text-white border-none rounded-lg cursor-pointer text-xs md:text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {t.saveBtn}
              </button>
            )}
            <div className="text-lg md:text-2xl font-mono font-bold text-[#CBD5E1] bg-[#0F172A] px-3 py-1.5 md:px-4 rounded-xl border border-[#1E293B]">
              {formatTime(seconds)}
            </div>
          </div>
        </header>

        {/* AREA LEMBAR CATATAN TEXT BOX */}
        <div className="my-4 flex-1 bg-[rgba(17,24,39,0.5)] border border-[#1E293B] rounded-2xl p-6 relative overflow-y-auto">
          {textResult ? (
            <div className="w-full h-full flex flex-col justify-between">
              <p className="text-base md:text-lg leading-relaxed text-[#E2E8F0] m-0 whiteSpace-pre-wrap">{textResult}</p>
              
              {!isRecording && (
                <button 
                  onClick={() => { setTextResult(''); setSeconds(0); audioChunksRef.current = []; }}
                  className="align-self-end mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.2)] rounded-md cursor-pointer text-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Workspace
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#475569] text-center">
              <FileText className="w-12 h-12 mb-3" />
              <p className="text-sm m-0 max-w-xs">{t.placeholder}</p>
            </div>
          )}
        </div>

        {/* FOOTER MIC BUTTON & ANIMATION */}
        <footer className="flex flex-col items-center gap-4">
          
          {/* EQUALIZER REKAMAN */}
          <div className="h-12 flex items-center gap-1.5">
            <AnimatePresence>
              {isRecording && (
                [...Array(7)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-[#06B6D4] to-[#7C3AED] rounded-full"
                    animate={{ height: [12, i % 2 === 0 ? 45 : 28, 12] }}
                    transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                  />
                ))
              )}
            </AnimatePresence>
          </div>

          {/* TOMBOL UTAMA MIC REKAM */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleRecording}
            className={`p-4 md:p-5 rounded-full border-none cursor-pointer flex items-center justify-center shadow-xl text-white ${isRecording ? 'bg-[#EF4444]' : 'bg-[#7C3AED]'}`}
          >
            {isRecording ? <Square className="w-6 h-6 md:w-7 md:h-7 fill-white" /> : <Mic className="w-6 h-6 md:w-7 md:h-7" />}
          </motion.button>
        </footer>
      </main>
    </div>
  );
}