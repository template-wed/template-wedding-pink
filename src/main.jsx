import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Heart, 
  Calendar, 
  MapPin, 
  Clock, 
  Camera, 
  MessageSquare, 
  Send, 
  Volume2, 
  VolumeX,
  ChevronDown,
  Quote,
  AlertCircle,
  Gift,
  CreditCard,
  Copy,
  MailOpen
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken 
} from 'firebase/auth';

// --- Variabel Konfigurasi Pernikahan ---
const WEDDING_CONFIG = {
  dateIso: '2026-12-30T08:00:00', // Tanggal Wedding: 30 Desember 2026
  groomName: 'Aditya Pratama, S.T.',
  groomParents: 'Putra dari Bpk. Budi & Ibu Susi',
  brideName: 'Clarissa Anindya, M.Ds.',
  brideParents: 'Putri dari Bpk. Joko & Ibu Ani',
  locationAkad: 'Masjid Agung Royal, Jakarta',
  timeAkad: '08.00 - 10.00 WIB',
  mapsAkad: 'https://maps.app.goo.gl/z8v1vY9vJ2R2',
  locationResepsi: 'Grand Ballroom Flora, Jakarta',
  timeResepsi: '11.00 - Selesai',
  mapsResepsi: 'https://maps.app.goo.gl/z8v1vY9vJ2R2',
  // Array Galeri Foto: Mudah diganti atau ditambah
  gallery: [
    { id: 1, title: 'Prewedding 1', url: null },
    { id: 2, title: 'Prewedding 2', url: null },
    { id: 3, title: 'Prewedding 3', url: null },
    { id: 4, title: 'Prewedding 4', url: null },
    { id: 5, title: 'Prewedding 5', url: null },
    { id: 6, title: 'Prewedding 6', url: null },
    { id: 7, title: 'Prewedding 7', url: null },
    { id: 8, title: 'Prewedding 8', url: null },
  ]
};

// --- Konfigurasi Firebase ---
// Perbaikan: Menggunakan pengecekan yang lebih aman terhadap environment variables
// Jika lingkungan tidak mendukung import.meta.env, kita gunakan nilai default/fallback
const getEnv = (key) => {
  try {
    // Mencoba akses via import.meta.env (Vite)
    return import.meta.env[key];
  } catch (e) {
    // Fallback jika kompilasi gagal mengakses import.meta
    return null;
  }
};

const envConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Mengutamakan config dari sistem (Canvas) atau dari .env lokal
const firebaseConfig = (typeof __firebase_config !== 'undefined' && __firebase_config)
  ? JSON.parse(__firebase_config) 
  : envConfig;

const isConfigMissing = !firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY";

let db, auth;
try {
  if (!isConfigMissing) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  }
} catch (e) {
  console.error("Firebase Initialization Error:", e);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'wedding-aditya-clarissa-2025';
const COLLECTION_NAME = 'messages';

const App = () => {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [rsvpName, setRsvpName] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState('Hadir');
  const [guestMessage, setGuestMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hari: 0, jam: 0, menit: 0, detik: 0 });
  const [copyStatus, setCopyStatus] = useState({ bca: false, mandiri: false });
  const [authError, setAuthError] = useState(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [guestTo, setGuestTo] = useState('Tamu Undangan'); 
  
  const audioRef = useRef(null);
  const weddingDate = new Date(WEDDING_CONFIG.dateIso);

  // Formatting tanggal otomatis
  const formattedFullDate = weddingDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formattedShortDate = weddingDate.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, ' . ');

  // Mengambil nama tamu dari Query Param (?to=Nama)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('to');
    if (name) {
      const decodedName = decodeURIComponent(name);
      setGuestTo(decodedName);
      setRsvpName(decodedName);
    }
  }, []);

  // Autentikasi Firebase
  useEffect(() => {
    if (isConfigMissing || !auth) return;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
        if (error.code === 'auth/admin-restricted-operation') {
          setAuthError("Anonymous Auth belum diaktifkan di Firebase Console.");
        } else {
          setAuthError(error.message);
        }
      }
    };

    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  // Sinkronisasi Pesan Real-time
  useEffect(() => {
    if (!user || !db) return;

    setIsLoadingMessages(true);
    const messagesCollection = collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME);
    
    const unsubscribe = onSnapshot(messagesCollection, (snapshot) => {
      const msgData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      const sorted = msgData.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });
      
      setMessages(sorted);
      setIsLoadingMessages(false);
    }, (err) => {
      console.error("Firestore error:", err);
      setIsLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const difference = weddingDate.getTime() - now.getTime();
      if (difference > 0) {
        setTimeLeft({
          hari: Math.floor(difference / (1000 * 60 * 60 * 24)),
          jam: Math.floor((difference / (1000 * 60 * 60)) % 24),
          menit: Math.floor((difference / 1000 / 60) % 60),
          detik: Math.floor((difference / 1000) % 60)
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [weddingDate]);

  const handleOpenInvitation = () => {
    setIsOpen(true);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.play().catch(err => console.log("Autoplay diblokir browser:", err));
    }
  };

  const toggleMusic = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleCopy = (text, type) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    
    setCopyStatus({ ...copyStatus, [type]: true });
    setTimeout(() => {
      setCopyStatus({ ...copyStatus, [type]: false });
    }, 2000);
  };

  const handleSubmitMessage = async (e) => {
    e.preventDefault();
    if (!user || !db || !rsvpName.trim() || !guestMessage.trim()) return;

    try {
      const messagesCollection = collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME);
      await addDoc(messagesCollection, {
        name: String(rsvpName),
        status: String(rsvpStatus),
        message: String(guestMessage),
        timestamp: serverTimestamp(),
        userId: user.uid
      });
      setGuestMessage('');
      setRsvpName('');
    } catch (err) {
      console.error("Gagal mengirim ucapan:", err);
    }
  };

  const FloralDecoration = ({ className = "" }) => (
    <div className={`pointer-events-none select-none ${className}`}>
      <svg viewBox="0 0 200 200" className="w-48 h-48 opacity-30 fill-pink-300">
        <path d="M100,20 C120,50 180,50 180,100 C180,150 120,150 100,180 C80,150 20,150 20,100 C20,50 80,50 100,20" />
        <circle cx="100" cy="100" r="10" className="fill-pink-400" />
      </svg>
    </div>
  );

  return (
    <div className={`min-h-screen bg-stone-50 text-stone-800 font-serif selection:bg-pink-100 selection:text-pink-600 ${!isOpen ? 'overflow-hidden h-screen' : 'overflow-x-hidden'}`}>
      
      {/* Perbaikan Path Musik untuk Netlify */}
      <audio ref={audioRef} src="/music/play.mp3" loop />

      {/* --- Cover Section --- */}
      <div className={`fixed inset-0 z-[100] transition-all duration-1000 ease-in-out bg-white flex flex-col items-center justify-center text-center p-6 ${isOpen ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-pink-50 to-white opacity-50"></div>
        <FloralDecoration className="absolute -top-10 -left-10 rotate-45 scale-150 text-pink-200" />
        <FloralDecoration className="absolute -bottom-10 -right-10 -rotate-135 scale-150 text-pink-200" />

        <div className="relative z-10 space-y-8 animate-fade-in-up text-center">
          <div className="space-y-2 text-center">
            <p className="text-pink-400 uppercase tracking-[0.5em] text-xs font-sans font-bold">The Wedding of</p>
            <h1 className="text-5xl md:text-7xl font-light text-stone-700 italic">{WEDDING_CONFIG.groomName.split(',')[0]} & {WEDDING_CONFIG.brideName.split(',')[0]}</h1>
          </div>
          <div className="w-16 h-[1px] bg-pink-200 mx-auto"></div>
          <div className="space-y-4">
            <p className="text-stone-400 text-sm font-sans italic tracking-wide text-center">Kepada Yth. Bapak/Ibu/Saudara/i</p>
            <p className="text-stone-700 font-bold font-sans text-xl uppercase tracking-widest text-center">{guestTo}</p>
          </div>
          <button 
            onClick={handleOpenInvitation}
            className="group flex items-center space-x-3 mx-auto bg-pink-400 hover:bg-pink-500 text-white px-8 py-4 rounded-full shadow-xl shadow-pink-100 transition-all transform hover:scale-105 font-sans font-bold uppercase tracking-widest text-xs"
          >
            <MailOpen size={18} className="group-hover:rotate-12 transition-transform" />
            <span>Buka Undangan</span>
          </button>
        </div>
      </div>

      {authError && (
        <div className="bg-red-100 text-red-800 p-3 text-center text-xs font-sans flex items-center justify-center sticky top-0 z-[101]">
          <AlertCircle size={14} className="mr-2" />
          Error Firebase: {authError}
        </div>
      )}

      {isConfigMissing && !authError && (
        <div className="bg-amber-100 text-amber-800 p-3 text-center text-xs font-sans flex items-center justify-center sticky top-0 z-[100]">
          <AlertCircle size={14} className="mr-2" />
          Firebase Config belum terdeteksi. Silakan isi file .env atau config sistem.
        </div>
      )}

      <button 
        onClick={toggleMusic}
        className="fixed bottom-6 right-6 z-50 p-4 bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-pink-100 text-pink-500 hover:scale-110 transition-transform"
      >
        {isPlaying ? <Volume2 size={24} className="animate-pulse" /> : <VolumeX size={24} />}
      </button>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center text-center px-4 bg-gradient-to-b from-pink-50 to-stone-50">
        <FloralDecoration className="absolute -top-10 -left-10 rotate-45 scale-150" />
        <FloralDecoration className="absolute -bottom-10 -right-10 -rotate-135 scale-150" />
        <div className="z-10 space-y-6 text-center">
          <p className="text-pink-400 uppercase tracking-[0.4em] text-xs font-sans font-bold">The Wedding of</p>
          <h1 className="text-6xl md:text-8xl font-light text-stone-700 italic">{WEDDING_CONFIG.groomName.split(',')[0]} & {WEDDING_CONFIG.brideName.split(',')[0]}</h1>
          <div className="w-24 h-[1px] bg-pink-300 mx-auto"></div>
          <p className="text-xl text-stone-500 font-sans tracking-widest uppercase text-center">{formattedShortDate}</p>
          <div className="pt-10">
            <ChevronDown className="mx-auto text-pink-300 animate-bounce" size={32} />
          </div>
        </div>
      </section>

      {/* Quran Quote Section - Hanya Teks sesuai permintaan */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="space-y-8 animate-fade-in-up text-center">
            <Heart className="mx-auto text-pink-300 mb-2" size={28} fill="currentColor" opacity={0.3} />
            
            <p className="text-stone-600 italic leading-relaxed font-serif max-w-2xl mx-auto text-sm md:text-base px-4 text-center">
              "Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu isteri-isteri dari jenismu sendiri, supaya kamu cenderung dan merasa tenteram kepadanya, dan dijadikan-Nya diantaramu rasa kasih dan sayang. Sesungguhnya pada yang demikian itu benar-benar terdapat tanda-tanda bagi kaum yang berfikir."
            </p>
            
            <p className="font-sans font-bold text-pink-400 text-[10px] tracking-[0.3em] uppercase text-center">
              — QS. Ar-Rum: 21 —
            </p>
          </div>
        </div>
      </section>

      {/* Countdown Section */}
      <section className="py-20 bg-stone-50 border-y border-pink-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-sm font-bold tracking-[0.3em] text-stone-400 uppercase mb-12 font-sans text-center">Menuju Hari Bahagia</h2>
          <div className="grid grid-cols-4 gap-4 md:gap-8">
            {Object.entries(timeLeft).map(([unit, value]) => (
              <div key={unit} className="flex flex-col items-center">
                <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl border border-pink-100 flex items-center justify-center bg-pink-50/20 mb-3 shadow-inner">
                  <span className="text-2xl md:text-4xl font-light text-pink-500">{String(value)}</span>
                </div>
                <span className="text-[10px] md:text-xs uppercase tracking-widest text-stone-400 font-sans font-bold text-center">{unit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bride & Groom Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-20">
          <div className="text-center">
            <div className="relative mb-8 inline-block">
               <div className="absolute -inset-4 border border-pink-200 rounded-full rotate-6 opacity-30"></div>
               <div className="w-64 h-64 rounded-full bg-stone-200 border-4 border-white shadow-2xl mx-auto flex items-center justify-center italic text-stone-400 font-sans text-xs">Foto Pria</div>
            </div>
            <h3 className="text-3xl font-light text-stone-700 mb-2 italic text-center">{WEDDING_CONFIG.groomName}</h3>
            <p className="text-stone-400 text-sm font-sans mb-4 text-center">{WEDDING_CONFIG.groomParents}</p>
          </div>
          <div className="text-center">
            <div className="relative mb-8 inline-block">
               <div className="absolute -inset-4 border border-pink-200 rounded-full -rotate-6 opacity-30"></div>
               <div className="w-64 h-64 rounded-full bg-stone-200 border-4 border-white shadow-2xl mx-auto flex items-center justify-center italic text-stone-400 font-sans text-xs">Foto Wanita</div>
            </div>
            <h3 className="text-3xl font-light text-stone-700 mb-2 italic text-center">{WEDDING_CONFIG.brideName}</h3>
            <p className="text-stone-400 text-sm font-sans mb-4 text-center">{WEDDING_CONFIG.brideParents}</p>
          </div>
        </div>
      </section>

      {/* Event Details */}
      <section className="py-24 bg-stone-50 relative">
        <FloralDecoration className="absolute top-0 right-0 opacity-10" />
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="mb-16 text-center">
            <Heart className="mx-auto text-pink-300 mb-4" fill="currentColor" size={32} />
            <h2 className="text-4xl font-light text-stone-700 italic text-center">Jadwal Acara</h2>
            <p className="text-stone-400 text-xs font-sans tracking-[0.2em] uppercase mt-2">{formattedFullDate}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-10 border border-pink-100 rounded-3xl space-y-4 bg-white shadow-sm text-center">
              <h4 className="text-pink-400 font-sans font-bold tracking-widest uppercase text-sm text-center">Akad Nikah</h4>
              <p className="text-stone-600 font-sans text-center">{WEDDING_CONFIG.timeAkad}</p>
              <p className="text-stone-500 italic text-center">{WEDDING_CONFIG.locationAkad}</p>
              <button 
                onClick={() => window.open(WEDDING_CONFIG.mapsAkad, '_blank')}
                className="px-6 py-2 border border-pink-200 text-pink-500 rounded-full text-xs font-sans uppercase tracking-widest hover:bg-pink-50 transition-all mx-auto"
              >
                Lihat Peta
              </button>
            </div>
            <div className="p-10 border border-pink-100 rounded-3xl space-y-4 bg-white shadow-sm text-center">
              <h4 className="text-pink-400 font-sans font-bold tracking-widest uppercase text-sm text-center">Resepsi</h4>
              <p className="text-stone-600 font-sans text-center">{WEDDING_CONFIG.timeResepsi}</p>
              <p className="text-stone-500 italic text-center">{WEDDING_CONFIG.locationResepsi}</p>
              <button 
                onClick={() => window.open(WEDDING_CONFIG.mapsResepsi, '_blank')}
                className="px-6 py-2 bg-pink-400 text-white rounded-full text-xs font-sans uppercase tracking-widest shadow-lg shadow-pink-100 hover:bg-pink-500 transition-all mx-auto"
              >
                Lihat Peta
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Our Gallery Section - Berbasis Array Variable */}
      <section className="py-24 px-4 bg-white relative">
        <FloralDecoration className="absolute -bottom-10 -right-10 opacity-10 rotate-180" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Camera className="mx-auto text-pink-300 mb-4" size={32} />
            <h2 className="text-4xl font-light text-stone-700 italic text-center">Galeri Foto</h2>
            <p className="text-stone-400 text-sm font-sans mt-2 tracking-wide uppercase text-center">Momen-momen bahagia kami</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {WEDDING_CONFIG.gallery.map((item) => (
              <div key={item.id} className="group relative aspect-square overflow-hidden rounded-3xl bg-stone-100 shadow-sm hover:shadow-xl transition-all duration-500">
                {item.url ? (
                   <img src={item.url} alt={item.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-stone-400 italic text-[10px] font-sans p-4 text-center">
                    [{item.title}]
                  </div>
                )}
                <div className="absolute inset-0 bg-pink-400/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Heart className="text-white fill-current" size={24} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Love Gift Section */}
      <section className="py-24 bg-stone-100 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <div className="mb-16 text-center">
            <Gift className="mx-auto text-pink-300 mb-4" size={32} />
            <h2 className="text-4xl font-light text-stone-700 italic text-center">Tanda Kasih</h2>
            <p className="text-stone-400 text-sm font-sans mt-2 tracking-wide uppercase max-w-lg mx-auto leading-relaxed text-center">
              Doa restu Anda merupakan karunia terindah bagi kami. Namun jika ingin memberikan tanda kasih, Anda dapat mengirimkannya melalui:
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-pink-50 relative group overflow-hidden transition-all hover:shadow-xl text-center">
              <div className="absolute top-0 right-0 w-24 h-24 bg-pink-50 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>
              <div className="relative z-10">
                <CreditCard className="text-pink-300 mb-6 mx-auto" size={28} />
                <h4 className="text-stone-700 font-bold mb-4 font-sans uppercase text-sm tracking-widest text-center">Bank BCA</h4>
                <p className="text-3xl text-pink-500 font-sans font-bold mb-1 tracking-wider text-center">1234 5678 90</p>
                <p className="text-stone-500 text-xs font-sans mb-8 uppercase tracking-widest text-center">a.n Aditya Pratama</p>
                <button
                  onClick={() => handleCopy('1234567890', 'bca')}
                  className={`flex items-center justify-center space-x-2 mx-auto px-6 py-2 rounded-full border transition-all text-xs font-sans font-bold uppercase tracking-widest ${
                    copyStatus.bca ? 'bg-green-500 border-green-500 text-white' : 'border-pink-200 text-pink-400 hover:bg-pink-50'
                  }`}
                >
                  <Copy size={14} />
                  <span>{copyStatus.bca ? 'Tersalin' : 'Salin Nomor'}</span>
                </button>
              </div>
            </div>
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-pink-50 relative group overflow-hidden transition-all hover:shadow-xl text-center">
              <div className="absolute top-0 right-0 w-24 h-24 bg-pink-50 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>
              <div className="relative z-10 text-center">
                <CreditCard className="text-pink-300 mb-6 mx-auto" size={28} />
                <h4 className="text-stone-700 font-bold mb-4 font-sans uppercase text-sm tracking-widest text-center">Bank Mandiri</h4>
                <p className="text-3xl text-pink-500 font-sans font-bold mb-1 tracking-wider text-center">0987 6543 21</p>
                <p className="text-stone-500 text-xs font-sans mb-8 uppercase tracking-widest text-center">a.n Clarissa Anindya</p>
                <button
                  onClick={() => handleCopy('0987654321', 'mandiri')}
                  className={`flex items-center justify-center space-x-2 mx-auto px-6 py-2 rounded-full border transition-all text-xs font-sans font-bold uppercase tracking-widest ${
                    copyStatus.mandiri ? 'bg-green-500 border-green-500 text-white' : 'border-pink-200 text-pink-400 hover:bg-pink-50'
                  }`}
                >
                  <Copy size={14} />
                  <span>{copyStatus.mandiri ? 'Tersalin' : 'Salin Nomor'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ucapan & RSVP Section */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16 text-center">
            <MessageSquare className="mx-auto text-pink-300 mb-4" size={32} />
            <h2 className="text-4xl font-light text-stone-700 italic text-center">Ucapan & Doa Restu</h2>
          </div>
          <div className="grid lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2">
              <div className="bg-stone-50 p-8 rounded-3xl shadow-xl shadow-pink-100/30 border border-white sticky top-10">
                <form onSubmit={handleSubmitMessage} className="space-y-5">
                  <input 
                    type="text" 
                    value={rsvpName}
                    onChange={(e) => setRsvpName(e.target.value)}
                    className="w-full px-5 py-3 rounded-2xl bg-white border-none outline-none text-sm font-sans"
                    placeholder="Nama Anda"
                    required
                  />
                  <select 
                    value={rsvpStatus}
                    onChange={(e) => setRsvpStatus(e.target.value)}
                    className="w-full px-5 py-3 rounded-2xl bg-white border-none outline-none text-sm font-sans"
                  >
                    <option value="Hadir">Hadir</option>
                    <option value="Berhalangan">Berhalangan</option>
                  </select>
                  <textarea 
                    value={guestMessage}
                    onChange={(e) => setGuestMessage(e.target.value)}
                    rows="4"
                    className="w-full px-5 py-3 rounded-2xl bg-white border-none outline-none text-sm font-sans resize-none"
                    placeholder="Tulis ucapan..."
                    required
                  ></textarea>
                  <button 
                    type="submit"
                    className="w-full py-4 bg-pink-400 text-white rounded-2xl font-bold uppercase text-xs font-sans"
                  >
                    Kirim Pesan
                  </button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-3 flex flex-col space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {isLoadingMessages ? (
                <div className="text-center py-20 text-stone-400 italic font-sans">Memuat ucapan...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-20 text-stone-400 italic bg-stone-50 rounded-3xl border border-dashed border-pink-100 text-center font-sans">
                  Belum ada ucapan...
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="bg-stone-50 p-6 rounded-3xl shadow-sm border border-pink-50 relative animate-fade-in-up">
                    <Quote className="absolute right-4 top-4 text-pink-50" size={30} />
                    <h4 className="font-bold text-stone-700 text-sm font-sans">{String(msg.name || "Tamu")}</h4>
                    <p className="text-stone-600 text-sm italic mt-2">"{String(msg.message || "")}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-stone-800 text-white text-center">
        <h2 className="text-3xl font-light italic mb-4 text-center">{WEDDING_CONFIG.groomName.split(',')[0]} & {WEDDING_CONFIG.brideName.split(',')[0]}</h2>
        <p className="text-[10px] font-sans uppercase tracking-widest text-center">Powered by Wedding Canvas</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #fce7f3; border-radius: 10px; }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 1.5s ease-out; }
      `}} />
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}