import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  GoogleDotsIcon,
  SendIcon, 
  HistoryIcon, 
  PlusIcon, 
  MenuIcon, 
  SettingsIcon,
  DeleteIcon,
  MicIcon,
  StopIcon,
  CloseIcon,
  ChevronDownIcon,
  ReplyIcon,
  HomeIcon,
  LoginIcon,
  LogoutIcon,
  ErrorIcon
} from './components/Icon';
import AnnotationViewer from './components/AnnotationViewer';
import DetailView from './components/DetailView';
import { gradeHomeworkImage, getChatResponse } from './services/geminiService';
import { ChatMessage, GradingResponse, ChatSession } from './types';
import LatexRenderer from './components/LatexRenderer';
// @ts-ignore
import CryptoJS from 'crypto-js';

const MODELS = [
    "qwen3-vl-235b-a22b-thinking",
    "qwen3-vl-235b-a22b-instruct",
    "qwen3-vl-32b-thinking",
    "qwen3-vl-32b-instruct",
    "qwen3-vl-30b-a3b-thinking",
    "qwen3-vl-30b-a3b-instruct",
    "qwen3-vl-8b-thinking",
    "qwen3-vl-8b-instruct"
];

// --- Authentication Types & Logic ---
interface User {
    id: string;
    name: string;
    isAuthenticated: boolean;
}

const CAS_LOGIN_URL = "https://ca.csu.edu.cn/authserver/login";
// Using the service URL provided in your example code that is known to work with CAS
const CAS_SERVICE_URL = "http://csujwc.its.csu.edu.cn/sso.jsp";

// Ported from your Node.js example code to Browser JS using CryptoJS
const encryptPassword = (password: string, salt: string) => {
    const aesCharSet = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
    const randomString = (length: number) => {
        let out = "";
        for (let i = 0; i < length; i++) {
             out += aesCharSet[Math.floor(Math.random() * aesCharSet.length)];
        }
        return out;
    };

    const prefix = randomString(64);
    const ivStr = randomString(16);
    
    // Convert strings to WordArrays for CryptoJS
    const key = CryptoJS.enc.Utf8.parse(salt);
    const iv = CryptoJS.enc.Utf8.parse(ivStr);
    
    // Logic: prefix(64 chars) + password
    // Then PKCS7 padded (handled by CryptoJS default)
    const src = CryptoJS.enc.Utf8.parse(prefix + password);
    
    const encrypted = CryptoJS.AES.encrypt(src, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    
    // Return Base64 of the ciphertext
    return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
};

const LoginModal = ({ isOpen, onClose, onLoginSuccess }: { isOpen: boolean, onClose: () => void, onLoginSuccess: (user: User) => void }) => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Fetch the login page to get execution token and salt
            const loginPageUrl = `${CAS_LOGIN_URL}?service=${encodeURIComponent(CAS_SERVICE_URL)}`;
            
            // NOTE: This request will fail if the browser enforces CORS and the server doesn't allow it.
            // This code assumes the user is running in an environment that permits this (e.g. proxy, extension, or same-origin).
            const response = await fetch(loginPageUrl);
            const html = await response.text();
            
            // 2. Parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            const lt = (doc.querySelector("input[name=lt]") as HTMLInputElement)?.value;
            const execution = (doc.querySelector("input[name=execution]") as HTMLInputElement)?.value;
            const eventId = (doc.querySelector("input[name=_eventId]") as HTMLInputElement)?.value || "submit";
            const salt = (doc.querySelector("#pwdEncryptSalt") as HTMLInputElement)?.value;

            if (!salt || !execution || !lt) {
                throw new Error("无法解析登录页面，请检查网络连接。");
            }

            // 3. Encrypt Password
            const encryptedPwd = encryptPassword(password, salt);

            // 4. Submit Form
            const formData = new URLSearchParams();
            formData.append("username", username);
            formData.append("password", encryptedPwd);
            formData.append("lt", lt);
            formData.append("execution", execution);
            formData.append("_eventId", eventId);
            formData.append("cllt", "userNameLogin");
            formData.append("dllt", "generalLogin");
            formData.append("captchaResponse", ""); // Sometimes needed

            const postResponse = await fetch(loginPageUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData,
                redirect: 'follow' 
            });

            // 5. Check Result
            // A successful login usually redirects to the service URL (csujwc)
            // Even if we can't fully load the JWC page due to CORS, the URL change indicates success in a redirect flow.
            // However, since we are fetching in background, we check the final URL.
            
            if (postResponse.url.includes("csujwc.its.csu.edu.cn") || postResponse.ok) {
                 // Login Success Simulation
                 onLoginSuccess({
                     id: username,
                     name: `CSU同学 ${username}`,
                     isAuthenticated: true
                 });
                 onClose();
            } else {
                 throw new Error("登录失败，请检查账号密码。");
            }

        } catch (err: any) {
            console.error("Login error:", err);
            let msg = "登录请求失败。";
            if (err.message && err.message.includes("Failed to fetch")) {
                msg = "网络请求被浏览器拦截 (CORS)。这是一个纯前端应用，无法直接访问 CSU 服务器。请尝试使用浏览器插件解决跨域问题，或使用本地代理。";
            } else if (err.message) {
                msg = err.message;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl animate-scale-in">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full text-gray-500">
                    <CloseIcon className="w-5 h-5" />
                </button>
                
                <div className="flex flex-col items-center mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3">
                        <LoginIcon className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#1f1f1f]">统一身份认证</h2>
                    <p className="text-sm text-gray-500 mt-1">请使用 CSU 门户账号登录</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-sm text-red-600">
                        <ErrorIcon className="w-5 h-5 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5 ml-1">学号 / 工号</label>
                        <input 
                            type="text" 
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-medium"
                            placeholder="请输入账号"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5 ml-1">密码</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-medium"
                            placeholder="请输入密码"
                            required
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="mt-4 w-full py-3 bg-[#0052CC] hover:bg-[#0047B3] text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <GoogleDotsIcon className="w-5 h-5 animate-spin-slow" />
                                正在登录...
                            </>
                        ) : "登录"}
                    </button>
                </form>
                
                <p className="text-xs text-center text-gray-400 mt-6">
                    本登录仅用于获取会话信息，密码已在本地加密，不会明文传输。
                </p>
            </div>
        </div>
    );
};

const ThinkingBlock = ({ thinking }: { thinking: string }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-4 animate-slide-up-fade">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center gap-2 text-sm text-[#444746] bg-[#f0f4f9] px-3 py-2 rounded-lg hover:bg-[#e1e5ea] transition-colors select-none"
      >
        <GoogleDotsIcon className="w-4 h-4" />
        <span className="font-medium text-xs">思考过程</span>
        <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
             <ChevronDownIcon className="w-4 h-4" />
        </div>
      </button>
      {isOpen && (
        <div className="mt-2 pl-3 ml-1 border-l-2 border-[#e3e3e3] text-[#444746] text-sm leading-relaxed whitespace-pre-wrap animate-slide-up-fade">
           <LatexRenderer>{thinking}</LatexRenderer>
        </div>
      )}
    </div>
  );
};

const InteractiveParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: any[] = [];
    const colors = ['#EA4335', '#4285F4', '#34A853', '#FBBC05', '#FF9900'];

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { 
        x: e.clientX, 
        y: e.clientY 
      };
    };
    
    const handleMouseLeave = () => {
       mouseRef.current = { x: -9999, y: -9999 };
    };

    class Particle {
      x: number;
      y: number;
      dx: number;
      dy: number;
      size: number;
      originalSize: number;
      color: string;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.dx = (Math.random() - 0.5) * 1;
        this.dy = (Math.random() - 0.5) * 1;
        this.size = Math.random() * 6 + 4; 
        this.originalSize = this.size;
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.8;
        ctx.fill();
      }

      update() {
        if (this.x + this.size > canvas!.width || this.x - this.size < 0) this.dx = -this.dx;
        if (this.y + this.size > canvas!.height || this.y - this.size < 0) this.dy = -this.dy;

        const mouse = mouseRef.current;
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const interactionRadius = 150;

        if (distance < interactionRadius) {
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            const force = (interactionRadius - distance) / interactionRadius;
            
            const directionX = forceDirectionX * force * 3;
            const directionY = forceDirectionY * force * 3;
            
            this.x -= directionX;
            this.y -= directionY;
            
            if (this.size < this.originalSize * 1.5) this.size += 0.3;
        } else {
             if (this.size > this.originalSize) this.size -= 0.1;
        }

        this.x += this.dx;
        this.y += this.dy;

        this.draw();
      }
    }

    const initParticles = () => {
        particles = [];
        const numberOfParticles = Math.floor((canvas.width * canvas.height) / 15000); 
        for (let i = 0; i < numberOfParticles; i++) {
            particles.push(new Particle());
        }
    };

    const animate = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
        }
        animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseLeave);

    handleResize();
    animate();

    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseout', handleMouseLeave);
        cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none opacity-50" />;
};

const EntryPage = ({ onStart, onLogin }: { onStart: () => void, onLogin: () => void }) => {
  return (
    <div className="entry-page-bg">
      <InteractiveParticles />
      <div className="relative z-10 p-8 flex flex-col items-center">
        <h1 className="entry-title">MechTeachLearnCenter</h1>
        <p className="entry-tagline">
          释放 AI 的力量，开启知识之门。您的个性化 AI 学习伙伴。
        </p>
        <div className="flex flex-col gap-4 mt-12 items-center">
            <button onClick={onLogin} className="entry-button flex items-center gap-3 bg-[#0052CC] text-white border-transparent hover:bg-[#0047B3] hover:shadow-lg transform hover:-translate-y-0.5">
               <LoginIcon className="w-5 h-5" />
               CSU 统一身份认证登录
            </button>
            <button onClick={onStart} className="text-[#444746] hover:text-black font-medium text-sm transition-colors py-2 px-4 rounded-full hover:bg-black/5 flex items-center gap-2">
              游客试用
            </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [appStarted, setAppStarted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [inputValue, setInputValue] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  
  const [detailViewData, setDetailViewData] = useState<{ images: string[], result: GradingResponse } | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0]);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  
  const [quotedMessage, setQuotedMessage] = useState<{ text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Auth & Session Management ---

  useEffect(() => {
    // Check if user is already logged in via localStorage
    const storedUser = localStorage.getItem('csu_user');
    if (storedUser) {
        setUser(JSON.parse(storedUser));
        setAppStarted(true); // Auto enter if logged in
    }
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
      setUser(loggedInUser);
      setAppStarted(true);
      localStorage.setItem('csu_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
      setUser(null);
      localStorage.removeItem('csu_user');
      setAppStarted(false);
  };

  // Load sessions from localStorage on initial render
  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem('chatSessions');
      const savedWidth = localStorage.getItem('sidebarWidth');
      if (savedSessions) {
        const parsedSessions: ChatSession[] = JSON.parse(savedSessions);
        setSessions(parsedSessions);
        if (parsedSessions.length > 0) {
          loadSession(parsedSessions[0].id, parsedSessions);
        }
      }
      if (savedWidth) {
        setSidebarWidth(parseInt(savedWidth, 10));
      }
    } catch (error) {
      console.error("Failed to load sessions from localStorage:", error);
    }
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('chatSessions', JSON.stringify(sessions));
    } else {
      localStorage.removeItem('chatSessions'); // Clean up if no sessions
    }
  }, [sessions]);

  const saveSession = useCallback(() => {
    if (messages.length === 0) return; // Don't save empty chats

    let updatedSessions = [...sessions];

    if (currentSessionId) {
      const sessionIndex = sessions.findIndex(s => s.id === currentSessionId);
      if (sessionIndex !== -1) {
        updatedSessions[sessionIndex] = { ...sessions[sessionIndex], messages: messages };
      }
    } else {
      // Create new session
      const newId = Date.now().toString();
      const firstUserMessage = messages.find(m => m.role === 'user');
      const title = firstUserMessage?.text?.substring(0, 30) || `对话 ${sessions.length + 1}`;
      
      const newSession: ChatSession = {
        id: newId,
        title,
        messages: messages,
        createdAt: Date.now()
      };
      
      updatedSessions = [newSession, ...sessions];
      setCurrentSessionId(newId);
    }
    
    setSessions(updatedSessions);

  }, [messages, sessions, currentSessionId]);
  
  // Save current session when processing finishes
  useEffect(() => {
      if (!isProcessing) {
          saveSession();
      }
  }, [isProcessing, saveSession]);


  const createNewChat = () => {
    saveSession(); // Save the current chat before starting a new one
    setCurrentSessionId(null);
    setMessages([]);
    setSelectedImages([]);
    setInputValue("");
    setQuotedMessage(null);
  };

  const loadSession = (sessionId: string, allSessions = sessions) => {
    const sessionToLoad = allSessions.find(s => s.id === sessionId);
    if (sessionToLoad) {
      setCurrentSessionId(sessionId);
      setMessages(sessionToLoad.messages);
      setQuotedMessage(null);
    }
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent loadSession from firing
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      createNewChat();
    }
  };


  // --- Sidebar Resizing Logic ---
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    localStorage.setItem('sidebarWidth', sidebarWidth.toString());
  }, [sidebarWidth]);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth > 240 && newWidth < 500) { // Min/Max width
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);


  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }
  }, [messages, isProcessing, isStreaming]);

  // Close model selector on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setIsModelSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const handleQuoteMessage = useCallback((text: string) => {
    // Sanitize and shorten text for display
    const cleanText = text.replace(/(\$\$|:)/g, ' ').replace(/\s+/g, ' ').trim();
    const shortenedText = cleanText.length > 100 ? `${cleanText.substring(0, 100)}...` : cleanText;
    setQuotedMessage({ text: shortenedText });
    inputRef.current?.focus();
  }, []);


  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const readers: Promise<string>[] = [];
      Array.from(files).forEach(file => {
          readers.push(new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(file as Blob);
          }));
      });
      
      Promise.all(readers).then(imgs => {
          setSelectedImages(prev => [...prev, ...imgs]);
      });
      
      if (fileInputRef.current) {
          fileInputRef.current.value = "";
      }
    }
  };

  const removeSelectedImage = (index: number) => {
      setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }
  };

  const parseMessageContent = (text: string) => {
    // Basic parser for <think> tags from Qwen/DeepSeek models
    const thinkRegex = /<think>(.*?)<\/think>/s;
    const match = thinkRegex.exec(text);
    
    if (match) {
        return {
            thinking: match[1],
            content: text.replace(match[0], '').trim()
        };
    }
    
    // Handle streaming case where end tag might not be present yet
    if (text.startsWith('<think>')) {
        return {
            thinking: text.substring(7), // Remove <think>
            content: '' // No content yet
        };
    }

    return { thinking: null, content: text };
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && selectedImages.length === 0) || isProcessing) return;
    
    if (abortControllerRef.current) {
         abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isGraderMode = inputValue.includes('@grader');
    
    let textToSend = inputValue;
    if (quotedMessage) {
        textToSend = `关于： "${quotedMessage.text}"\n\n${inputValue}`;
    }

    const currentUserMessage: ChatMessage = {
      role: 'user',
      text: textToSend,
      images: selectedImages.length > 0 ? [...selectedImages] : undefined
    };
    
    // This is the full history including the new message for the API call
    const historyForApi = [...messages, currentUserMessage];

    // Update UI immediately with user's message
    setMessages(historyForApi); 
    setInputValue("");
    setSelectedImages([]);
    setQuotedMessage(null); // Clear quote after sending
    setIsProcessing(true);

    try {
      if (isGraderMode) {
        if (!currentUserMessage.images || currentUserMessage.images.length === 0) {
          setMessages([...historyForApi, { role: 'model', text: "请上传作业图片以使用 @grader 功能。" }]);
          setIsProcessing(false);
          return;
        }

        // Add loading state message
        setMessages(prev => [...prev, { role: 'model', isLoading: true }]);
        
        // Pass the complete history to the grading function
        const result = await gradeHomeworkImage(historyForApi, selectedModel, controller.signal);

        setMessages(prev => {
          // Replace the isLoading message with the final result
          const updated = prev.filter(m => !m.isLoading);
          return [...updated, { role: 'model', text: result.summary, images: currentUserMessage.images, gradingResult: result }];
        });
      } else {
        // General chat mode
        setIsStreaming(true);
        // Add an empty model message to stream into
        setMessages(prev => [...prev, { role: 'model', text: '' }]);
        
        // Pass the complete history to the chat function
        const stream = getChatResponse(historyForApi, selectedModel, controller.signal);

        for await (const chunk of stream) {
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.role === 'model') {
              // Create a new object for the last message to ensure React re-renders
              const newLastMsg = { ...lastMsg, text: (lastMsg.text || '') + chunk };
              return [...prev.slice(0, -1), newLastMsg];
            }
            return prev;
          });
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
          return;
      }

      console.error(error);
      const errorMessage = error instanceof Error && error.message.includes("Connection error")
        ? "连接错误，请检查您的网络并重试。"
        : "抱歉，处理您的请求时遇到错误。请重试。";
        
      setMessages(prev => {
          // Remove any loading or empty streaming messages before adding the error
          const withoutPlaceholders = prev.filter(m => !(m.isLoading || (m.role === 'model' && m.text === '')));
          return [...withoutPlaceholders, { role: 'model', text: errorMessage }];
      });

    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to render input area to avoid duplication
  const renderInputPanel = () => (
      <div className="relative bg-[#f0f4f9] rounded-[28px] transition-all duration-300 hover:shadow-md focus-within:shadow-lg focus-within:bg-white border border-transparent focus-within:border-[#e3e3e3]">
             
             {quotedMessage && (
                <div className="px-6 pt-3 animate-slide-up-fade">
                    <div className="bg-[#e8eaed] rounded-lg px-4 py-2 flex items-center gap-3">
                        <ReplyIcon className="w-5 h-5 text-[#444746] shrink-0" />
                        <p className="text-sm text-[#3c4043] truncate flex-1 italic">
                            {quotedMessage.text}
                        </p>
                        <button 
                            onClick={() => setQuotedMessage(null)} 
                            className="p-1.5 text-[#5f6368] hover:bg-gray-300/70 rounded-full transition-colors"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
             )}
             
             {selectedImages.length > 0 && (
                <div className="px-6 pt-4 animate-slide-up-fade flex gap-3 overflow-x-auto">
                    {selectedImages.map((img, index) => (
                        <div key={index} className="relative inline-block shrink-0">
                            <img src={img} alt={`Selected ${index}`} className="h-14 w-14 object-cover rounded-lg border border-[#e3e3e3]" />
                            <button 
                                onClick={() => removeSelectedImage(index)}
                                className="absolute -top-2 -right-2 bg-[#1f1f1f] text-white rounded-full p-1 hover:bg-black shadow-md transition-transform hover:scale-110"
                            >
                                <CloseIcon className="w-[10px] h-[10px] text-white" />
                            </button>
                        </div>
                    ))}
                </div>
             )}

            {/* --- Formula Preview --- */}
            {inputValue.includes('$') && (
              <div className="px-6 pt-3 border-t border-[#e3e3e3] animate-slide-up-fade">
                  <div className="bg-white p-3 rounded-lg shadow-inner-sm">
                      <label className="text-xs font-bold text-[#444746] block mb-1 opacity-70">公式预览</label>
                      <LatexRenderer>{inputValue || "..."}</LatexRenderer>
                  </div>
              </div>
            )}

             <div className="flex items-center px-2 py-2 gap-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="ml-2 w-9 h-9 flex items-center justify-center rounded-full bg-[#1f1f1f] hover:bg-black transition-all shadow-sm shrink-0"
                  title="Upload image"
                >
                  <PlusIcon className="text-white w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleImageUpload}
                />
                
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入 @grader 批改作业，或直接开始对话..."
                  className="flex-1 bg-transparent border-none outline-none text-[#1f1f1f] placeholder-[#747775] text-[16px] ml-2 h-12"
                  disabled={isProcessing}
                />
                
                <div className="flex items-center gap-1 pr-2">
                    {(isProcessing || isStreaming) ? (
                        <button 
                            onClick={handleStop}
                            className="p-3 text-[#1f1f1f] hover:bg-[#dfe3e7] rounded-full transition-colors animate-scale-in"
                            title="Stop generation"
                        >
                           <StopIcon className="w-6 h-6" />
                        </button>
                    ) : inputValue || selectedImages.length > 0 ? (
                        <button 
                          onClick={handleSendMessage}
                          className="p-3 text-[#1f1f1f] hover:bg-[#dfe3e7] rounded-full transition-all animate-scale-in"
                        >
                          <SendIcon className="w-6 h-6" />
                        </button>
                    ) : (
                        <button className="p-3 text-[#1f1f1f] hover:bg-[#dfe3e7] rounded-full transition-colors">
                           <MicIcon className="w-6 h-6" />
                        </button>
                    )}
                </div>
             </div>
          </div>
  );

  // --- Render ---

  if (detailViewData) {
    return <DetailView 
              images={detailViewData.images} 
              gradingResponse={detailViewData.result} 
              onClose={() => setDetailViewData(null)} 
              onQuote={handleQuoteMessage}
           />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-[#1f1f1f] font-sans">
      
      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
      
      {/* Entry Page */}
      {!appStarted && (
        <EntryPage 
            onStart={() => setAppStarted(true)} 
            onLogin={() => setShowLoginModal(true)} 
        />
      )}
      
      {/* Main Content (Hidden if entry page is active, but rendered to keep state) */}
      <div className={`flex flex-1 h-full w-full ${!appStarted ? 'hidden' : 'flex'}`}>
      
          <aside 
            ref={sidebarRef}
            style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties} 
            className={`
                fixed md:relative z-50
                flex flex-col h-full 
                bg-[#f0f4f9] 
                transition-all duration-300 ease-in-out
                overflow-hidden
                ${isSidebarOpen 
                    ? 'translate-x-0 w-[var(--sidebar-width)] min-w-[240px]' 
                    : '-translate-x-full w-[var(--sidebar-width)] min-w-[240px] md:translate-x-0 md:w-0 md:min-w-0'
                }
            `}
          >
            {/* Inner container with fixed width to prevent content reflow during width transition */}
            <div className="w-[var(--sidebar-width)] min-w-[240px] flex flex-col h-full">
                <div className="p-4 pt-6 flex items-center justify-between">
                  <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-[#dfe3e7] rounded-full text-[#444746] transition-colors">
                    <MenuIcon className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="px-4 py-4">
                  <button 
                    onClick={createNewChat}
                    className="flex items-center gap-3 w-full px-4 py-3 bg-[#e3e3e3] hover:bg-[#d1d5db] hover:shadow-sm text-[#1f1f1f] rounded-[16px] transition-all duration-200 group"
                  >
                    <PlusIcon className="w-5 h-5 text-[#444746] group-hover:text-black" />
                    <span className="text-sm font-medium">新对话</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-2">
                  <div className="mb-2 text-[11px] font-medium text-[#444746] px-4 opacity-80">最近</div>
                  <div className="flex flex-col gap-1">
                    {sessions.sort((a, b) => b.createdAt - a.createdAt).map(session => (
                      <button 
                        key={session.id} 
                        onClick={() => loadSession(session.id)}
                        className={`group flex items-center justify-between gap-3 px-4 py-2.5 rounded-full text-sm text-left truncate transition-colors w-full ${currentSessionId === session.id ? 'bg-[#dfe3e7]' : 'hover:bg-[#e1e5ea] text-[#1f1f1f]'}`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <HistoryIcon className="text-[#444746] w-[18px] h-[18px]" />
                          <span className="truncate">{session.title}</span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => deleteSession(session.id, e)} className="p-1 rounded-full hover:bg-red-200 text-red-600">
                                <DeleteIcon className="w-4 h-4"/>
                            </button>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2 mt-auto pb-6 pl-4">
                   <button 
                      onClick={() => setAppStarted(false)}
                      className="flex items-center gap-3 w-full px-2 py-2.5 hover:bg-[#e1e5ea] rounded-full text-[#1f1f1f] text-sm transition-colors mb-1"
                   >
                     <HomeIcon className="w-5 h-5 text-[#444746]" />
                     返回首页
                   </button>

                   <button className="flex items-center gap-3 w-full px-2 py-2.5 hover:bg-[#e1e5ea] rounded-full text-[#1f1f1f] text-sm transition-colors mb-1">
                    <SettingsIcon className="w-5 h-5 text-[#444746]" />
                    设置
                  </button>
                  
                  <div className="px-2 py-2 text-[11px] text-[#444746] flex flex-col gap-2 border-t border-gray-200 pt-3 mt-1">
                    {user ? (
                        <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-[#0052CC] text-white flex items-center justify-center text-[10px] font-bold">
                                    C
                                </div>
                                <span>{user.name}</span>
                            </div>
                            <button onClick={handleLogout} title="退出登录" className="hover:text-red-500 transition-colors">
                                <LogoutIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-gray-500 italic">
                            <span>访客模式</span>
                            <button onClick={() => setShowLoginModal(true)} title="登录" className="hover:text-blue-600 transition-colors ml-auto">
                                <LoginIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        {selectedModel}
                    </div>
                  </div>
                </div>
            </div>
          </aside>
          
          <div 
              onMouseDown={startResizing} 
              className={`w-1.5 cursor-col-resize hover:bg-blue-200 transition-colors shrink-0 ${!isSidebarOpen && 'hidden'}`} 
          />

          <main className="flex-1 flex flex-col relative h-full min-w-0 bg-white overflow-hidden">
            
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-[1px] animate-[fadeIn_0.3s_ease-out]"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <header className="flex items-center justify-between p-5 text-[#444746] relative z-40">
              <div className="flex items-center gap-3">
                {!isSidebarOpen && (
                  <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-[#f0f4f9] rounded-full transition-colors">
                    <MenuIcon className="w-6 h-6" />
                  </button>
                )}
                <span className="text-xl font-normal text-[#444746] tracking-tight">
                    MechTeachLearnCenter
                </span>
                <div className="relative" ref={modelSelectorRef}>
                  <button 
                    onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                    className="flex items-center text-xs font-normal bg-[#f0f4f9] px-3 py-1.5 rounded-full hover:bg-[#dfe3e7] transition-colors text-[#444746]"
                  >
                    <span>{selectedModel}</span>
                    <ChevronDownIcon className="w-4 h-4 ml-1 opacity-60" />
                  </button>
                  {isModelSelectorOpen && (
                    <div className="absolute top-full mt-2 w-72 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/50 p-2 z-30 animate-scale-in origin-top-left">
                      {MODELS.map(model => (
                        <button 
                          key={model} 
                          onClick={() => { setSelectedModel(model); setIsModelSelectorOpen(false); }} 
                          className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${selectedModel === model ? 'bg-[#e3e8ef] text-black font-medium' : 'hover:bg-[#f0f4f9]'}`}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-9 h-9 rounded-full bg-[#f0f4f9] overflow-hidden ring-2 ring-transparent hover:ring-[#e3e3e3] transition-all cursor-pointer flex items-center justify-center text-[#0b57d0] font-medium text-sm" title={user ? user.name : "Guest"}>
                 {user ? "C" : "S"}
              </div>
            </header>

            <div 
              ref={scrollRef} 
              className="flex-1 overflow-y-auto px-4 md:px-[15%] lg:px-[18%] pb-8 scroll-smooth relative z-0"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full animate-slide-up-fade -mt-20">
                   <div className="mb-10 flex flex-col items-center gap-2">
                     <GoogleDotsIcon className="w-14 h-14 opacity-90" />
                     <h2 className="text-6xl font-bold bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#FBBC04] bg-clip-text text-transparent tracking-tight leading-tight pb-2">
                       {user ? `你好, ${user.name}` : "你好"}
                     </h2>
                   </div>
                   
                   {/* Centered Input Box when empty */}
                   <div className="w-full max-w-3xl animate-slide-up-fade" style={{ animationDelay: '0.1s' }}>
                      {renderInputPanel()}
                   </div>
                </div>
              ) : (
                <div className="pb-40">
                  {messages.map((msg, idx) => {
                    const isLastMessage = idx === messages.length - 1;
                    const { thinking, content } = msg.role === 'model' && msg.text ? parseMessageContent(msg.text) : { thinking: null, content: msg.text };

                    return (
                      <div key={idx} className="flex gap-6 mb-12 animate-slide-up-fade">
                        {msg.role === 'model' ? (
                          <div className="mt-1 shrink-0">
                             {(msg.isLoading || (isLastMessage && isStreaming)) ? (
                                <GoogleDotsIcon className="w-8 h-8 animate-spin-slow" />
                             ) : (
                                <GoogleDotsIcon className="w-8 h-8" />
                             )}
                          </div>
                        ) : (
                          <div className="w-8 shrink-0" />
                        )}
                        
                        <div className={`flex flex-col max-w-full gap-4 ${msg.role === 'user' ? 'items-end w-full' : 'items-start w-full'}`}>
                          {msg.images && msg.images.length > 0 && !msg.gradingResult && (
                            <div className={`grid gap-2 max-w-md ${msg.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                              {msg.images.map((img, imgIdx) => (
                                  <div key={imgIdx} className="rounded-3xl overflow-hidden border border-[#e3e3e3] shadow-sm animate-scale-in">
                                      <img src={img} alt={`Upload ${imgIdx}`} className="w-full h-auto" />
                                  </div>
                              ))}
                            </div>
                          )}

                          {/* Thinking Block Display */}
                          {thinking && <ThinkingBlock thinking={thinking} />}

                          {content && (
                             <div className={`text-[17px] leading-relaxed tracking-wide animate-slide-up-fade ${
                               msg.role === 'user' 
                                 ? 'whitespace-pre-wrap bg-[#f0f4f9] px-6 py-4 rounded-[24px] rounded-tr-sm text-[#1f1f1f] max-w-[85%]' 
                                 : 'text-[#1f1f1f] w-full font-normal'
                             }`}>
                               {msg.role === 'model' ? <LatexRenderer>{content}</LatexRenderer> : content}
                             </div>
                          )}

                          {msg.images && msg.gradingResult && (
                            <div className="w-full mt-2 animate-slide-up-fade">
                              <AnnotationViewer 
                                images={msg.images} 
                                annotations={msg.gradingResult.annotations} 
                                onOpenDetail={() => setDetailViewData({ images: msg.images!, result: msg.gradingResult! })}
                                onQuote={handleQuoteMessage}
                              />
                            </div>
                          )}

                          {msg.isLoading && (
                             <div className="h-1.5 w-full bg-gradient-to-r from-[#e3e3e3] via-[#c7c7c7] to-[#e3e3e3] rounded-full animate-[shimmer_1.5s_infinite] max-w-[140px]" style={{backgroundSize: '200% 100%'}} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Input Box when there are messages */}
            {messages.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-10 pb-8 px-4 md:px-[15%] lg:px-[18%] z-30">
                 {renderInputPanel()}
                 <p className="text-center text-[12px] text-[#444746] mt-4 opacity-70">
                    AI 可能会犯错，请务必核实。
                 </p>
              </div>
            )}
          </main>
      </div>
    </div>
  );
};

export default App;