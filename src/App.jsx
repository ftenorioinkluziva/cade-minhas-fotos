import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Image as ImageIcon, CheckCircle, XCircle, Loader2, Upload, 
  Target, Trash2, ShieldCheck, Info, HelpCircle, X, AlertTriangle, Sparkles, Filter 
} from 'lucide-react';

/**
 * VERSÃO 7.0 - AJUSTE DINÂMICO & CORREÇÕES
 * - Slider de Acurácia agora funciona em tempo real nos resultados (Pós-processamento).
 * - Botão "Limpar Resultados" separado do "Reset Total".
 * - Otimização na captura de candidatos (captura ampla, filtragem visual).
 */

// --- KOKONUT-INSPIRED COMPONENTS ---

const KCard = ({ children, className = "", active = false, disabled = false }) => (
  <div className={`
    relative overflow-hidden rounded-2xl border transition-all duration-500
    ${disabled ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}
    ${active 
      ? 'bg-zinc-900/80 border-indigo-500/50 shadow-[0_0_30px_-10px_rgba(99,102,241,0.3)]' 
      : 'bg-zinc-900/40 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900/60'
    }
    backdrop-blur-xl ${className}
  `}>
    {active && (
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
    )}
    {children}
  </div>
);

const KButton = ({ children, onClick, disabled, variant = "primary", className = "" }) => {
  const baseStyle = "relative px-6 py-4 rounded-xl font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98]";
  
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/20",
    secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20",
    outline: "bg-transparent border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

const KBadge = ({ children, icon: Icon, color = "indigo" }) => {
  const colors = {
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    zinc: "bg-zinc-800/50 text-zinc-400 border-zinc-700/50"
  };
  
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${colors[color] || colors.zinc}`}>
      {Icon && <Icon size={12} />}
      {children}
    </div>
  );
};

// --- APP MAIN ---

const App = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  
  const [targetPhoto, setTargetPhoto] = useState(null);
  const [targetDescriptor, setTargetDescriptor] = useState(null);
  
  const [searchQueue, setSearchQueue] = useState([]);
  const [allMatches, setAllMatches] = useState([]); // Armazena TODOS os candidatos (mesmo os duvidosos)
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("");
  const [stats, setStats] = useState({ scanned: 0, found: 0 });
  
  // Threshold Visual (controlado pelo slider)
  const [displayThreshold, setDisplayThreshold] = useState(0.45);

  const faceApiRef = useRef(null);

  // Filtra os resultados visíveis baseado no slider
  const visibleMatches = useMemo(() => {
    return allMatches.filter(m => m.distance < displayThreshold);
  }, [allMatches, displayThreshold]);

  useEffect(() => {
    const loadFaceApi = async () => {
      try {
        if (!window.faceapi) {
          const script = document.createElement('script');
          script.src = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
          script.async = true;
          document.body.appendChild(script);
          await new Promise(resolve => script.onload = resolve);
        }
        
        faceApiRef.current = window.faceapi;
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

        if (!faceApiRef.current.nets.ssdMobilenetv1.params) {
            await Promise.all([
                faceApiRef.current.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceApiRef.current.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceApiRef.current.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
        }
        setIsModelLoaded(true);
      } catch (e) {
        console.error("Erro ao carregar IA", e);
        setCurrentStatus("Erro crítico ao carregar IA.");
      }
    };
    loadFaceApi();
  }, []);

  const handleTargetUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const imgUrl = URL.createObjectURL(file);
    setTargetPhoto(imgUrl);
    setTargetDescriptor(null);
    setCurrentStatus("Mapeando biometria facial...");

    try {
        const imgEl = await createImageElement(imgUrl);
        const detection = await faceApiRef.current
            .detectSingleFace(imgEl)
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        if (detection) {
            setTargetDescriptor(detection.descriptor);
            setCurrentStatus("");
        } else {
            alert("Rosto não detectado. Tente uma foto com melhor iluminação.");
            setTargetPhoto(null);
            URL.revokeObjectURL(imgUrl);
            setCurrentStatus("");
        }
    } catch (error) {
        console.error(error);
        setCurrentStatus("Erro ao processar.");
    }
  };

  const handleBatchUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    const queue = files.map(file => ({
        file,
        url: URL.createObjectURL(file),
        id: Math.random().toString(36).substr(2, 9)
    }));
    
    setSearchQueue(prev => [...prev, ...queue]);
  };

  const createImageElement = (src) => {
      return new Promise((resolve, reject) => {
          const img = document.createElement('img');
          img.src = src;
          img.onload = () => resolve(img);
          img.onerror = reject;
      });
  };

  const runFilter = async () => {
      if (!targetDescriptor || searchQueue.length === 0) return;

      setIsProcessing(true);
      let foundCount = 0;
      let scannedCount = 0;

      const faceapi = faceApiRef.current;
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
      
      // CAPTURA AMPLA: Usamos um limite interno alto (0.6) para capturar
      // até mesmo correspondências duvidosas. O usuário filtra depois com o slider.
      const HARD_CAPTURE_LIMIT = 0.7; 

      for (const item of searchQueue) {
          setCurrentStatus(`Examinando item ${scannedCount + 1}/${searchQueue.length}...`);
          
          try {
              const imgEl = await createImageElement(item.url);
              const detections = await faceapi.detectAllFaces(imgEl, options)
                .withFaceLandmarks()
                .withFaceDescriptors();

              let bestMatchDistance = 1.0;
              let isMatch = false;

              for (const detection of detections) {
                  const distance = faceapi.euclideanDistance(detection.descriptor, targetDescriptor);
                  if (distance < bestMatchDistance) {
                      bestMatchDistance = distance;
                  }
                  if (distance < HARD_CAPTURE_LIMIT) {
                      isMatch = true;
                  }
              }

              if (isMatch) {
                  // Guardamos o item E a distância para filtragem posterior
                  setAllMatches(prev => [...prev, { ...item, distance: bestMatchDistance }]);
                  foundCount++;
              } else {
                  URL.revokeObjectURL(item.url);
              }

              scannedCount++;
              setStats({ scanned: scannedCount, found: foundCount });
              if (scannedCount % 5 === 0) await new Promise(r => setTimeout(r, 0));

          } catch (err) {
              console.error("Erro:", item.id);
          }
      }

      setCurrentStatus("");
      setIsProcessing(false);
      setSearchQueue([]);
  };

  // Limpa apenas os resultados da busca atual
  const clearResults = () => {
      setAllMatches([]);
      setStats({ scanned: 0, found: 0 });
  };

  // Reseta o app inteiro (Alvo + Resultados)
  const fullReset = () => {
      if (window.confirm("Isso apagará o Alvo e os Resultados. Deseja continuar?")) {
          setAllMatches([]);
          setSearchQueue([]);
          setTargetPhoto(null);
          setTargetDescriptor(null);
          setStats({ scanned: 0, found: 0 });
      }
  };

  const TutorialModal = () => {
      if (!showTutorial) return null;
      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-8 shadow-2xl shadow-black/50 relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
                  
                  <div className="text-center mb-8">
                      <div className="bg-zinc-800 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-zinc-700">
                          <Sparkles className="text-indigo-400" size={32} />
                      </div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">Cadê minhas fotos?</h2>
                      <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
                          Sua ferramenta pessoal de forense digital. Encontre rostos específicos em grandes volumes de dados, localmente.
                      </p>
                  </div>

                  <div className="space-y-4 mb-8">
                      {[
                        { num: 1, title: "Defina o Alvo", desc: "Upload de uma foto de rosto clara." },
                        { num: 2, title: "Selecione a Fonte", desc: "Escolha pastas com milhares de fotos." },
                        { num: 3, title: "Privacidade Total", desc: "Processamento 100% offline no navegador." }
                      ].map((step) => (
                        <div key={step.num} className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold text-sm border border-indigo-500/20">
                              {step.num}
                            </span>
                            <div>
                                <h3 className="text-zinc-200 font-medium text-sm">{step.title}</h3>
                                <p className="text-zinc-500 text-xs">{step.desc}</p>
                            </div>
                        </div>
                      ))}
                  </div>

                  <KButton onClick={() => setShowTutorial(false)} className="w-full">
                      Entendi, iniciar busca
                  </KButton>
              </div>
          </div>
      )
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      <TutorialModal />

      {/* NAVBAR */}
      <header className="border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
                      <Search size={18} className="text-white" />
                  </div>
                  <span className="font-semibold text-white tracking-tight hidden sm:block">Cadê minhas fotos?</span>
              </div>
              
              <div className="flex items-center gap-4">
                 <KBadge icon={ShieldCheck} color="emerald">100% Offline</KBadge>
                 <button onClick={() => setShowTutorial(true)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                     <HelpCircle size={20} />
                 </button>
              </div>
          </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-12">
        
        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* CARD 1: ALVO */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl opacity-20 blur transition duration-500 group-hover:opacity-40"></div>
              <KCard className="h-full p-6 flex flex-col" active={!!targetDescriptor}>
                  <div className="flex items-center justify-between mb-4">
                    <KBadge icon={Target}>Passo 1</KBadge>
                    {isModelLoaded ? <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/> : <Loader2 className="animate-spin text-zinc-600" size={14}/>}
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">Quem procuramos?</h3>
                  <p className="text-sm text-zinc-500 mb-6">A referência biométrica para a busca.</p>

                  <div className="flex-1">
                    {!targetPhoto ? (
                        <label className="relative flex flex-col items-center justify-center w-full h-48 border border-zinc-800 border-dashed rounded-xl bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all cursor-pointer group/upload">
                            <input type="file" accept="image/*" onChange={handleTargetUpload} disabled={!isModelLoaded} className="hidden" />
                            <div className="p-4 bg-zinc-800 rounded-full mb-3 group-hover/upload:scale-110 transition-transform">
                              <Target className="text-zinc-400" size={24} />
                            </div>
                            <span className="text-sm font-medium text-zinc-400">Carregar Foto</span>
                        </label>
                    ) : (
                        <div className="relative w-full h-48 rounded-xl overflow-hidden border border-zinc-700 group/img">
                            <img src={targetPhoto} className="w-full h-full object-cover" alt="Alvo" />
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                 <KButton variant="outline" onClick={() => { setTargetPhoto(null); setTargetDescriptor(null); }}>
                                    Trocar
                                 </KButton>
                            </div>
                            <div className="absolute bottom-2 right-2">
                              <KBadge icon={CheckCircle} color="emerald">Pronto</KBadge>
                            </div>
                        </div>
                    )}
                  </div>
              </KCard>
            </div>

            {/* CARD 2: ORIGEM */}
            <div className={`transition-all duration-500 ${!targetDescriptor ? 'opacity-40 blur-sm pointer-events-none' : ''}`}>
              <KCard className="h-full p-6 flex flex-col" active={searchQueue.length > 0}>
                  <div className="flex items-center justify-between mb-4">
                    <KBadge icon={Upload} color="zinc">Passo 2</KBadge>
                    <span className="text-xs text-zinc-600 font-mono">MULTI-FILES</span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">Onde procurar?</h3>
                  <p className="text-sm text-zinc-500 mb-6">Selecione o "palheiro" para achar a agulha.</p>

                  <label className="relative flex flex-col items-center justify-center w-full h-48 border border-zinc-800 border-dashed rounded-xl bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all cursor-pointer group/upload">
                      <input type="file" multiple accept="image/*" onChange={handleBatchUpload} className="hidden" />
                      <div className="p-4 bg-zinc-800 rounded-full mb-3 group-hover/upload:scale-110 transition-transform">
                        <Upload className="text-zinc-400" size={24} />
                      </div>
                      <span className="text-sm font-medium text-zinc-400">Adicionar Fotos</span>
                      <span className="text-xs text-zinc-600 mt-1">Arrastar & Soltar suportado</span>
                  </label>
                  
                  {searchQueue.length > 0 && (
                      <div className="mt-4 flex items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
                          <span className="text-sm text-zinc-300 font-mono">{searchQueue.length} arquivos</span>
                          <button onClick={() => setSearchQueue([])} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                      </div>
                  )}
              </KCard>
            </div>

            {/* CARD 3: AÇÃO */}
            <div className={`transition-all duration-500 ${searchQueue.length === 0 ? 'opacity-40 blur-sm pointer-events-none' : ''}`}>
              <KCard className="h-full p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <KBadge icon={Search} color="indigo">Passo 3</KBadge>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Executar</h3>
                    <p className="text-sm text-zinc-500 mb-8">A IA comparará vetores faciais localmente.</p>
                  </div>

                  <div className="space-y-6">
                    {/* Botão Principal */}
                    <KButton 
                        onClick={runFilter} 
                        disabled={isProcessing} 
                        className="w-full h-14 text-base shadow-indigo-500/25"
                    >
                        {isProcessing ? <Loader2 className="animate-spin"/> : <Sparkles size={18} />}
                        {isProcessing ? 'Processando...' : 'Iniciar Varredura'}
                    </KButton>
                    
                    <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 text-xs text-zinc-500 text-center">
                        Dica: Você poderá ajustar a sensibilidade após a busca.
                    </div>
                  </div>
              </KCard>
            </div>
        </div>

        {/* BARRA DE STATUS */}
        {(currentStatus || stats.scanned > 0) && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-md animate-in slide-in-from-bottom-5">
                 <div className="flex items-center gap-4">
                     <div className={`p-3 rounded-full ${isProcessing ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle size={20}/>}
                     </div>
                     <div>
                         <p className="text-zinc-200 font-medium">{currentStatus || "Processo finalizado"}</p>
                         <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                           Scanned: {stats.scanned} / Captured: <span className="text-indigo-400">{allMatches.length}</span>
                         </p>
                     </div>
                 </div>
                 {isProcessing && (
                     <div className="w-full md:w-64 h-1 bg-zinc-800 rounded-full overflow-hidden">
                         <div className="h-full bg-indigo-500 animate-[progress_1s_ease-in-out_infinite] w-1/3 rounded-full"></div>
                     </div>
                 )}
            </div>
        )}

        {/* GALERIA DE RESULTADOS */}
        {allMatches.length > 0 && (
            <div className="space-y-6 animate-in fade-in duration-700">
                <div className="flex flex-col md:flex-row items-end justify-between border-b border-zinc-800 pb-4 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            Encontrados
                            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-sm px-2.5 py-0.5 rounded-full font-mono">
                            {visibleMatches.length}
                            </span>
                        </h2>
                        <p className="text-sm text-zinc-500 mt-1">
                            Mostrando fotos com similaridade acima de <span className="text-indigo-400 font-bold">{((1 - displayThreshold) * 100).toFixed(2)}%</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {/* CONTROLES DE FILTRO */}
                        <div className="flex-1 md:w-64 px-4 py-2 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col gap-1">
                            <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                                <span>Rigoroso</span>
                                <span>Flexível</span>
                            </div>
                              <input 
                                  type="range" min="0.3" max="0.8" step="0.0001" // <--- Mudou aqui
                                  value={displayThreshold} onChange={(e) => setDisplayThreshold(parseFloat(e.target.value))}
                                  className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                              />
                        </div>

                        <KButton variant="secondary" onClick={clearResults} className="!py-3 !px-4 !text-xs whitespace-nowrap">
                            <Trash2 size={14}/> Limpar Resultados
                        </KButton>
                        <KButton variant="danger" onClick={fullReset} className="!py-3 !px-4 !text-xs whitespace-nowrap">
                            <XCircle size={14}/> Resetar App
                        </KButton>
                    </div>
                </div>
                
                {visibleMatches.length === 0 ? (
                    <div className="py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                        <Filter className="mx-auto mb-3 opacity-50" size={32} />
                        <p>Nenhuma foto com este nível de precisão.</p>
                        <p className="text-sm mt-1">Tente mover o slider para "Flexível".</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {visibleMatches.map((item, idx) => (
                            <div key={item.id} className="group relative aspect-square bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-indigo-500/50 transition-all duration-300">
                                <img src={item.url} alt="Encontrado" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4 translate-y-2 group-hover:translate-y-0">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[70%]">{item.file.name}</span>
                                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                            {((1 - item.distance) * 100).toFixed(2)}%
                                        </span>
                                    </div>
                                    <a 
                                        href={item.url} 
                                        download={`match_${idx}_${item.file.name}`}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-2 rounded-lg text-center shadow-lg shadow-indigo-900/50"
                                    >
                                        Salvar
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </main>

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

export default App;