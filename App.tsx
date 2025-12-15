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
  ErrorIcon,
  CheckCircleIcon,
  ExtensionIcon,
  LightbulbIcon,
  SparkleIcon,
  LightModeIcon,
  DarkModeIcon
} from './components/Icon';
import AnnotationViewer from './components/AnnotationViewer';
import DetailView from './components/DetailView';
import { gradeHomeworkImage, getChatResponse } from './services/geminiService';
import { ChatMessage, GradingResponse, ChatSession, McpConnectionStatus, McpTool } from './types';
import LatexRenderer from './components/LatexRenderer';
// @ts-ignore
import CryptoJS from 'crypto-js';
import { mcpClient } from './services/mcpService';

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

// --- Functional Modules Configuration ---
const FEATURE_MODULES = [
    {
      id: 'grader',
      name: '作业批改',
      description: '智能标注与纠错',
      icon: <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-500" />,
      prompt: "@grader 请帮我批改这张作业，指出错误并给出正确解法。"
    },
    {
      id: 'explainer',
      name: '题目讲解',
      description: '详细解析解题思路',
      icon: <LightbulbIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />,
      prompt: "请详细讲解这道题的解题思路、涉及的知识点以及具体的解题步骤。"
    },
    {
      id: 'formula',
      name: '公式转写',
      description: '识别公式转为 LaTeX',
      icon: <div className="w-5 h-5 flex items-center justify-center font-serif font-bold text-blue-600 dark:text-blue-500 italic text-lg">Σ</div>,
      prompt: "请识别图片中的数学公式，并将其精确转写为 LaTeX 格式。"
    },
    {
      id: 'general',
      name: '自由对话',
      description: '多模态 AI 助手',
      icon: <SparkleIcon className="w-5 h-5" />,
      prompt: "" // Clear input for general chat
    }
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

// --- Encryption Helpers matching encrypt.js ---
const aesCharSet = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";

const randomString = (length: number) => {
    let out = "";
    for (let i = 0; i < length; i++) {
            out += aesCharSet[Math.floor(Math.random() * aesCharSet.length)];
    }
    return out;
};

const getAesString = (data: string, key: string, iv: string) => {
    // Trim key whitespace as per js implementation
    const keyTrimmed = key.replace(/(^\s+)|(\s+$)/g, "");
    const keyParsed = CryptoJS.enc.Utf8.parse(keyTrimmed);
    const ivParsed = CryptoJS.enc.Utf8.parse(iv);
    
    const encrypted = CryptoJS.AES.encrypt(data, keyParsed, {
        iv: ivParsed,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.toString();
};

const encryptPassword = (password: string, salt: string) => {
    return getAesString(randomString(64) + password, salt, randomString(16));
};


// --- Modals ---

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
            // Browser automatically follows redirects, so this gets us the final login page content
            const loginPageInitialUrl = `${CAS_LOGIN_URL}?service=${encodeURIComponent(CAS_SERVICE_URL)}`;
            
            console.log("Fetching login page:", loginPageInitialUrl);
            const response = await fetch(loginPageInitialUrl, {
                redirect: 'follow'
            });
            
            // Capture the actual URL after redirects (needed for POST action usually)
            const finalLoginUrl = response.url;
            console.log("Final login page URL:", finalLoginUrl);

            const html = await response.text();
            
            // 2. Parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            const ltInput = doc.querySelector("input[name=lt]") as HTMLInputElement;
            const executionInput = doc.querySelector("input[name=execution]") as HTMLInputElement;
            const eventIdInput = doc.querySelector("input[name=_eventId]") as HTMLInputElement;
            const saltInput = doc.querySelector("#pwdEncryptSalt") as HTMLInputElement;

            const lt = ltInput?.value || "";
            const execution = executionInput?.value || "";
            const eventId = eventIdInput?.value || "submit";
            const salt = saltInput?.value || "";

            console.log("Login Parameters Found:", {
                lt: lt,
                execution: execution,
                eventId: eventId,
                salt: salt,
                saltElementFound: !!saltInput
            });

            // Relaxed check: LT is optional as per user feedback
            if (!salt || !execution) {
                // If critical parameters are missing, log the error details
                throw new Error(`无法解析登录页面参数。已获取: Salt=${!!salt}, Execution=${!!execution}, LT=${!!lt}。请检查控制台日志详情。`);
            }

            // 3. Encrypt Password
            const encryptedPwd = encryptPassword(password, salt);
            console.log("Password encrypted successfully.");

            // 4. Submit Form
            const formData = new URLSearchParams();
            formData.append("username", username);
            formData.append("password", encryptedPwd);
            // Append lt if it exists, CAS usually expects it if present in form
            if (lt) formData.append("lt", lt);
            formData.append("execution", execution);
            formData.append("_eventId", eventId);
            formData.append("cllt", "userNameLogin");
            formData.append("dllt", "generalLogin");
            formData.append("captchaResponse", ""); 

            console.log("Posting login data to:", finalLoginUrl);

            // Post to the same URL we landed on (finalLoginUrl)
            const postResponse = await fetch(finalLoginUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData,
                redirect: 'follow' 
            });

            console.log("Login POST Response:", postResponse.status, postResponse.url);

            // 5. Check Result
            // If redirect matches successful pattern (contains ticket or lands on service URL)
            const successUrlPattern = "ticket=";
            const serviceDomain = "csujwc.its.csu.edu.cn";
            
            if (postResponse.url.includes(successUrlPattern) || postResponse.url.includes(serviceDomain)) {
                 console.log("Login success detected via URL match.");
                 
                 // Extract Student Name from the final page content
                 let displayName = `CSU同学 ${username}`;
                 try {
                     const responseHtml = await postResponse.text();
                     
                     // Use specific Regex logic provided by user
                     const re = /<div\s+class=["']dataHeader["'][^>]*>[\s\S]*?<font[^>]*size=["']?4["']?[^>]*>([^<]+)<\/font>/i;
                     const match = re.exec(responseHtml);
                     
                     if (match && match[1]) {
                         displayName = match[1].trim();
                         console.log("Successfully extracted student name using regex:", displayName);
                     } else {
                         console.warn("Regex did not find name, attempting DOM fallback...");
                         // Fallback DOM extraction
                         const parser = new DOMParser();
                         const doc = parser.parseFromString(responseHtml, "text/html");
                         const nameElement = doc.querySelector('font[size="4"]');
                         if (nameElement && nameElement.textContent) {
                            displayName = nameElement.textContent.trim();
                            console.log("Successfully extracted student name using DOM:", displayName);
                         }
                     }
                 } catch (e) {
                     console.warn("Failed to parse student name from response:", e);
                 }

                 onLoginSuccess({
                     id: username,
                     name: displayName,
                     isAuthenticated: true
                 });
                 onClose();
            } else {
                 console.warn("Login failed. URL remained:", postResponse.url);
                 // Check if it's still the login page (likely authentication failure)
                 if (postResponse.url.includes("authserver/login")) {
                     throw new Error("登录失败，账号或密码错误。");
                 }
                 throw new Error("登录失败，未检测到 ticket 跳转。请检查网络或账号状态。");
            }

        } catch (err: any) {
            console.error("Login error detected:", err);
            let msg = "登录请求失败。";
            if (err.message && err.message.includes("Failed to fetch")) {
                msg = "网络请求失败 (CORS)。这是一个纯前端应用，无法直接访问 CSU 服务器。请尝试使用浏览器插件解决跨域问题。";
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
            <div className="relative bg-[var(--bg-main)] dark:bg-[var(--bg-selected)] rounded-2xl w-full max-w-md p-8 shadow-2xl animate-scale-in">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-[var(--bg-sub)] rounded-full text-[var(--text-sub)]">
                    <CloseIcon className="w-5 h-5" />
                </button>
                
                <div className="flex flex-col items-center mb-6">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-200 mb-3">
                        <LoginIcon className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--text-main)]">统一身份认证</h2>
                    <p className="text-sm text-[var(--text-sub)] mt-1">请使用 CSU 门户账号登录</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                        <ErrorIcon className="w-5 h-5 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-bold text-[var(--text-sub)] uppercase mb-1.5 ml-1">学号 / 工号</label>
                        <input 
                            type="text" 
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="w-full px-4 py-3 bg-[var(--bg-sub)] border border-[var(--border-main)] rounded-xl focus:bg-[var(--bg-main)] focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-medium text-[var(--text-main)] dark:focus:bg-[var(--bg-selected)] dark:focus:ring-blue-800"
                            placeholder="请输入账号"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-[var(--text-sub)] uppercase mb-1.5 ml-1">密码</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-[var(--bg-sub)] border border-[var(--border-main)] rounded-xl focus:bg-[var(--bg-main)] focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-medium text-[var(--text-main)] dark:focus:bg-[var(--bg-selected)] dark:focus:ring-blue-800"
                            placeholder="请输入密码"
                            required
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="mt-4 w-full py-3 bg-[#0052CC] hover:bg-[#0047B3] text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        className="flex items-center gap-2 text-sm text-[var(--text-sub)] bg-[var(--bg-sub)] px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors select-none"
      >
        <GoogleDotsIcon className="w-4 h-4" />
        <span className="font-medium text-xs">思考过程</span>
        <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
             <ChevronDownIcon className="w-4 h-4" />
        </div>
      </button>
      {isOpen && (
        <div className="mt-2 pl-3 ml-1 border-l-2 border-[var(--border-main)] text-[var(--text-sub)] text-sm leading-relaxed whitespace-pre-wrap animate-slide-up-fade">
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

const EntryPage = ({ onStart, onLogin, darkMode, toggleTheme }: { onStart: () => void, onLogin: () => void, darkMode: boolean, toggleTheme: () => void }) => {
  return (
    <div className="entry-page-bg">
      <button 
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-3 rounded-full bg-[var(--bg-sub)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-all z-50 shadow-sm animate-scale-in"
          title={darkMode ? "切换亮色模式" : "切换暗色模式"}
      >
          {darkMode ? <LightModeIcon className="w-6 h-6" /> : <DarkModeIcon className="w-6 h-6" />}
      </button>

      <InteractiveParticles />
      <div className="relative z-10 p-8 flex flex-col items-center">
        <h1 className="entry-title">MechHub</h1>
        <p className="entry-tagline">
          释放 AI 的力量，开启知识之门。您的个性化 AI 学习伙伴。
        </p>
        <div className="flex flex-col gap-4 mt-12 items-center">
            <button onClick={onLogin} className="entry-button flex items-center gap-3 bg-[#0052CC] text-white border-transparent hover:bg-[#0047B3] hover:shadow-lg transform hover:-translate-y-0.5">
               <LoginIcon className="w-5 h-5" />
               CSU 统一身份认证登录
            </button>
            <button onClick={onStart} className="text-[var(--text-sub)] hover:text-[var(--text-main)] font-medium text-sm transition-colors py-2 px-4 rounded-full hover:bg-[var(--bg-sub)] flex items-center gap-2">
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
  const [darkMode, setDarkMode] = useState(false);

  // --- MCP State ---
  const [mcpStatus, setMcpStatus] = useState<McpConnectionStatus>('disconnected');
  const [mcpTools, setMcpTools] = useState<McpTool[]>([]);
  const [isMcpSidebarOpen, setIsMcpSidebarOpen] = useState(false); // New state for sidebar
  const [mcpUrl, setMcpUrl] = useState("http://localhost:3000/sse");

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
  
  // New state for collapsible sidebar sections
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(true);
  const [isRecentOpen, setIsRecentOpen] = useState(true);
  
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

  // --- Auth & Session & Theme Management ---

  useEffect(() => {
    const storedUser = localStorage.getItem('csu_user');
    if (storedUser) {
        setUser(JSON.parse(storedUser));
        setAppStarted(true); 
    }
    
    // Theme Init
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        setDarkMode(true);
        document.documentElement.classList.add('dark');
    } else {
        setDarkMode(false);
        document.documentElement.classList.remove('dark');
    }
  }, []);
  
  const toggleTheme = () => {
      const newMode = !darkMode;
      setDarkMode(newMode);
      if (newMode) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
      } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
      }
  };

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

  // --- MCP Connection Logic ---
  const handleConnectMcp = async (url: string) => {
      if (!url) {
          // Disconnect signal
          mcpClient.disconnect();
          setMcpStatus('disconnected');
          setMcpTools([]);
          return;
      }

      setMcpStatus('connecting');
      try {
          await mcpClient.connect(url);
          setMcpStatus('connected');
          const tools = await mcpClient.refreshTools();
          setMcpTools(tools);
      } catch (error) {
          console.error("MCP Connection Failed", error);
          setMcpStatus('error');
      }
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

  // --- Feature Module Handler ---
  const handleFeatureSelect = (prompt: string) => {
    setInputValue(prompt);
    // Focus input after selecting feature
    setTimeout(() => inputRef.current?.focus(), 50);
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
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
        
        // Pass the complete history to the chat function, including MCP tools
        const stream = getChatResponse(historyForApi, selectedModel, controller.signal, mcpTools);

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

  // Helper to render MCP Tool Cards
  const renderMcpToolCard = (tool: McpTool) => {
     // Extract keys from schema properties for display
     const props = tool.inputSchema?.properties || {};
     const required = tool.inputSchema?.required || [];
     const propKeys = Object.keys(props);
     
     return (
        <div key={tool.name} className="bg-[var(--bg-main)] border border-[var(--border-main)] rounded-xl p-3 hover:border-blue-200 hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-200 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <ExtensionIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-[var(--text-main)] truncate">{tool.name}</h4>
                    {tool.description && <p className="text-[10px] text-[var(--text-sub)] truncate">{tool.description}</p>}
                </div>
            </div>
            
            {/* Schema Visualizer */}
            {propKeys.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {propKeys.slice(0, 4).map(key => (
                        <span key={key} className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${required.includes(key) ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' : 'bg-[var(--bg-sub)] text-[var(--text-sub)] border-[var(--border-main)]'}`}>
                            {key}{required.includes(key) ? '*' : ''}
                        </span>
                    ))}
                    {propKeys.length > 4 && <span className="text-[9px] text-[var(--text-sub)] self-center">+{propKeys.length - 4}</span>}
                </div>
            )}
        </div>
     );
  };

  // Helper to render input area to avoid duplication
  const renderInputPanel = () => (
      <div className="relative bg-[var(--bg-sub)] rounded-[28px] transition-all duration-300 hover:shadow-md focus-within:shadow-lg focus-within:bg-[var(--bg-main)] border border-transparent focus-within:border-[var(--border-main)]">
             
             {quotedMessage && (
                <div className="px-6 pt-3 animate-slide-up-fade">
                    <div className="bg-[#e8eaed] dark:bg-[#333537] rounded-lg px-4 py-2 flex items-center gap-3">
                        <ReplyIcon className="w-5 h-5 text-[var(--text-sub)] shrink-0" />
                        <p className="text-sm text-[var(--text-main)] truncate flex-1 italic">
                            {quotedMessage.text}
                        </p>
                        <button 
                            onClick={() => setQuotedMessage(null)} 
                            className="p-1.5 text-[var(--text-sub)] hover:bg-[var(--bg-hover)] rounded-full transition-colors"
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
                            <img src={img} alt={`Selected ${index}`} className="h-14 w-14 object-cover rounded-lg border border-[var(--border-main)]" />
                            <button 
                                onClick={() => removeSelectedImage(index)}
                                className="absolute -top-2 -right-2 bg-[#1f1f1f] text-white rounded-full p-1 hover:bg-black shadow-md transition-transform hover:scale-110 dark:bg-[#e3e3e3] dark:text-black"
                            >
                                <CloseIcon className="w-[10px] h-[10px] text-white dark:text-black" />
                            </button>
                        </div>
                    ))}
                </div>
             )}

            {/* --- Formula Preview --- */}
            {inputValue.includes('$') && (
              <div className="px-6 pt-3 border-t border-[var(--border-main)] animate-slide-up-fade">
                  <div className="bg-[var(--bg-main)] p-3 rounded-lg shadow-inner-sm">
                      <label className="text-xs font-bold text-[var(--text-sub)] block mb-1 opacity-70">公式预览</label>
                      <LatexRenderer>{inputValue || "..."}</LatexRenderer>
                  </div>
              </div>
            )}

             <div className="flex items-center px-2 py-2 gap-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="ml-2 w-9 h-9 flex items-center justify-center rounded-full bg-[#1f1f1f] hover:bg-black transition-all shadow-sm shrink-0 dark:bg-[#e3e3e3] dark:hover:bg-white"
                  title="Upload image"
                >
                  <PlusIcon className="text-white w-5 h-5 dark:text-black" />
                </button>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleImageUpload}
                />
                
                {/* MCP Toggle Button - Now Toggles Sidebar */}
                <button 
                    onClick={() => setIsMcpSidebarOpen(true)}
                    className={`ml-1 w-9 h-9 flex items-center justify-center rounded-full transition-all shadow-sm shrink-0 relative ${isMcpSidebarOpen || mcpStatus === 'connected' ? 'bg-[#e3f2fd] text-[#0b57d0] dark:bg-blue-900/30 dark:text-blue-300' : 'bg-[var(--bg-sub)] hover:bg-[var(--bg-hover)] text-[var(--text-sub)]'}`}
                    title="MCP Extension Tools"
                >
                   <ExtensionIcon className="w-5 h-5" />
                   {mcpStatus === 'connected' && (
                       <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#1e1f20] rounded-full"></span>
                   )}
                </button>
                
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入 @grader 批改作业，或直接开始对话..."
                  className="flex-1 bg-transparent border-none outline-none text-[var(--text-main)] placeholder-[var(--input-placeholder)] text-[16px] ml-2 h-12"
                  disabled={isProcessing}
                />
                
                <div className="flex items-center gap-1 pr-2">
                    {(isProcessing || isStreaming) ? (
                        <button 
                            onClick={handleStop}
                            className="p-3 text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded-full transition-colors animate-scale-in"
                            title="Stop generation"
                        >
                           <StopIcon className="w-6 h-6" />
                        </button>
                    ) : inputValue || selectedImages.length > 0 ? (
                        <button 
                          onClick={handleSendMessage}
                          className="p-3 text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded-full transition-all animate-scale-in"
                        >
                          <SendIcon className="w-6 h-6" />
                        </button>
                    ) : (
                        <button className="p-3 text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded-full transition-colors">
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
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)] font-sans transition-colors duration-300 relative">
      
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
            darkMode={darkMode}
            toggleTheme={toggleTheme}
        />
      )}
      
      {/* Main Content (Hidden if entry page is active, but rendered to keep state) */}
      <div className={`flex flex-1 h-full w-full ${!appStarted ? 'hidden' : 'flex'}`}>
      
          <aside 
            ref={sidebarRef}
            style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties} 
            className={`
                fixed md:relative z-40
                flex flex-col h-full 
                bg-[var(--bg-sub)] 
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
                  <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-sub)] transition-colors">
                    <MenuIcon className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="px-4 py-4">
                  <button 
                    onClick={createNewChat}
                    className="flex items-center gap-3 w-full px-4 py-3 bg-[var(--bg-selected)] hover:bg-[var(--bg-hover)] hover:shadow-sm text-[var(--text-main)] rounded-[16px] transition-all duration-200 group"
                  >
                    <PlusIcon className="w-5 h-5 text-[var(--text-sub)] group-hover:text-[var(--text-main)]" />
                    <span className="text-sm font-medium">新对话</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-2">
                  
                  {/* Functional Modules Section (Collapsible) */}
                  <div className="mb-4">
                    <button 
                        onClick={() => setIsFeaturesOpen(!isFeaturesOpen)}
                        className="w-full flex items-center justify-between mb-2 px-4 group py-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <span className="text-[11px] font-medium text-[var(--text-sub)] opacity-80 uppercase tracking-wider">功能助手</span>
                        <ChevronDownIcon className={`w-3 h-3 text-[var(--text-sub)] opacity-60 transition-transform duration-300 ${isFeaturesOpen ? '' : '-rotate-90'}`} />
                    </button>
                    
                    <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isFeaturesOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                        <div className="overflow-hidden">
                            <div className="flex flex-col gap-1 pb-1">
                                {FEATURE_MODULES.map(feature => (
                                    <button 
                                        key={feature.id}
                                        onClick={() => handleFeatureSelect(feature.prompt)}
                                        className="group flex items-center gap-3 px-4 py-2.5 rounded-full text-sm text-left hover:bg-[var(--bg-selected)] transition-all w-full relative overflow-hidden"
                                    >
                                        <div className="shrink-0 transition-transform group-hover:scale-110">
                                            {feature.icon}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[var(--text-main)] font-medium truncate">{feature.name}</span>
                                            <span className="text-[10px] text-[var(--text-sub)] opacity-70 truncate">{feature.description}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                  </div>

                  {/* Recent Sessions Section (Collapsible) */}
                  <div>
                    <button 
                        onClick={() => setIsRecentOpen(!isRecentOpen)}
                        className="w-full flex items-center justify-between mb-2 px-4 group py-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <span className="text-[11px] font-medium text-[var(--text-sub)] opacity-80 uppercase tracking-wider">最近对话</span>
                        <ChevronDownIcon className={`w-3 h-3 text-[var(--text-sub)] opacity-60 transition-transform duration-300 ${isRecentOpen ? '' : '-rotate-90'}`} />
                    </button>

                    <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isRecentOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                        <div className="overflow-hidden">
                            <div className="flex flex-col gap-1 pb-1">
                                {sessions.sort((a, b) => b.createdAt - a.createdAt).map(session => (
                                <button 
                                    key={session.id} 
                                    onClick={() => loadSession(session.id)}
                                    className={`group flex items-center justify-between gap-3 px-4 py-2.5 rounded-full text-sm text-left truncate transition-colors w-full ${currentSessionId === session.id ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-selected)] text-[var(--text-main)]'}`}
                                >
                                    <div className="flex items-center gap-3 truncate">
                                    <HistoryIcon className="text-[var(--text-sub)] w-[18px] h-[18px]" />
                                    <span className="truncate">{session.title}</span>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => deleteSession(session.id, e)} className="p-1 rounded-full hover:bg-red-200 text-red-600 dark:hover:bg-red-900/30 dark:text-red-400">
                                            <DeleteIcon className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </button>
                                ))}
                            </div>
                        </div>
                    </div>
                  </div>
                </div>

                <div className="p-2 mt-auto pb-6 pl-4">
                   <button 
                      onClick={() => setAppStarted(false)}
                      className="flex items-center gap-3 w-full px-2 py-2.5 hover:bg-[var(--bg-selected)] rounded-full text-[var(--text-main)] text-sm transition-colors mb-1"
                   >
                     <HomeIcon className="w-5 h-5 text-[var(--text-sub)]" />
                     返回首页
                   </button>
                   
                   <div className="flex items-center gap-1 mb-1">
                        <button 
                                className="flex-1 flex items-center gap-3 px-2 py-2.5 hover:bg-[var(--bg-selected)] rounded-full text-[var(--text-main)] text-sm transition-colors cursor-default opacity-60"
                        >
                            <SettingsIcon className="w-5 h-5 text-[var(--text-sub)]" />
                            设置
                        </button>
                        <button 
                            onClick={toggleTheme}
                            className="p-2.5 hover:bg-[var(--bg-selected)] rounded-full text-[var(--text-sub)] transition-all transform active:scale-95"
                            title={darkMode ? "切换亮色模式" : "切换暗色模式"}
                        >
                            {darkMode ? <LightModeIcon className="w-5 h-5" /> : <DarkModeIcon className="w-5 h-5" />}
                        </button>
                   </div>
                  
                  <div className="px-2 py-2 text-[11px] text-[var(--text-sub)] flex flex-col gap-2 border-t border-[var(--border-main)] pt-3 mt-1">
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
                            <button onClick={() => setShowLoginModal(true)} title="登录" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto">
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

          <main className="flex-1 flex flex-col relative h-full min-w-0 bg-[var(--bg-main)] overflow-hidden">
            
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-[1px] animate-[fadeIn_0.3s_ease-out]"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <header className="flex items-center justify-between p-5 text-[var(--text-sub)] relative z-40">
              <div className="flex items-center gap-3">
                {!isSidebarOpen && (
                  <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-[var(--bg-sub)] rounded-full transition-colors">
                    <MenuIcon className="w-6 h-6" />
                  </button>
                )}
                <span className="text-xl font-normal text-[var(--text-sub)] tracking-tight">
                    MechHub
                </span>
                <div className="relative" ref={modelSelectorRef}>
                  <button 
                    onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                    className="flex items-center text-xs font-normal bg-[var(--bg-sub)] px-3 py-1.5 rounded-full hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-sub)]"
                  >
                    <span>{selectedModel}</span>
                    <ChevronDownIcon className="w-4 h-4 ml-1 opacity-60" />
                  </button>
                  {isModelSelectorOpen && (
                    <div className="absolute top-full mt-2 w-72 bg-white/90 dark:bg-[#1e1f20]/90 backdrop-blur-md rounded-2xl shadow-lg border border-[var(--border-main)] p-2 z-30 animate-scale-in origin-top-left">
                      {MODELS.map(model => (
                        <button 
                          key={model} 
                          onClick={() => { setSelectedModel(model); setIsModelSelectorOpen(false); }} 
                          className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${selectedModel === model ? 'bg-[var(--bg-selected)] text-[var(--text-main)] font-medium' : 'text-[var(--text-main)] hover:bg-[var(--bg-sub)]'}`}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-9 h-9 rounded-full bg-[var(--bg-sub)] overflow-hidden ring-2 ring-transparent hover:ring-[var(--border-main)] transition-all cursor-pointer flex items-center justify-center text-[#0b57d0] dark:text-blue-300 font-medium text-sm" title={user ? user.name : "Guest"}>
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
                                  <div key={imgIdx} className="rounded-3xl overflow-hidden border border-[var(--border-main)] shadow-sm animate-scale-in">
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
                                 ? 'whitespace-pre-wrap bg-[var(--bg-sub)] px-6 py-4 rounded-[24px] rounded-tr-sm text-[var(--text-main)] max-w-[85%]' 
                                 : 'text-[var(--text-main)] w-full font-normal'
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
                             <div className="h-1.5 w-full bg-gradient-to-r from-[var(--border-main)] via-[var(--bg-hover)] to-[var(--border-main)] rounded-full animate-[shimmer_1.5s_infinite] max-w-[140px]" style={{backgroundSize: '200% 100%'}} />
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
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)] to-transparent pt-10 pb-8 px-4 md:px-[15%] lg:px-[18%] z-30">
                 {renderInputPanel()}
                 <p className="text-center text-[12px] text-[var(--text-sub)] mt-4 opacity-70">
                    AI 可能会犯错，请务必核实。
                 </p>
              </div>
            )}
          </main>
      </div>

      {/* MCP Sidebar Overlay */}
      {isMcpSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-[60]"
            onClick={() => setIsMcpSidebarOpen(false)}
        />
      )}

      {/* MCP Right Sidebar Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-[400px] bg-[var(--bg-main)]/95 backdrop-blur-xl border-l border-[var(--border-main)] shadow-2xl z-[70] transform transition-transform duration-300 ease-out flex flex-col ${
            isMcpSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-main)] shrink-0">
             <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
                    <ExtensionIcon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-[var(--text-main)] tracking-tight">MCP 扩展中心</h3>
                    <p className="text-[10px] text-[var(--text-sub)]">Model Context Protocol</p>
                </div>
             </div>
             <button onClick={() => setIsMcpSidebarOpen(false)} className="p-2 hover:bg-[var(--bg-sub)] rounded-full text-[var(--text-sub)] transition-colors">
                <CloseIcon className="w-5 h-5" />
             </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
            {/* Status Section */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider">连接状态</span>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1.5 transition-colors duration-300 ${
                             mcpStatus === 'connected' ? 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' : 
                             mcpStatus === 'error' ? 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800' :
                             mcpStatus === 'connecting' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800' :
                             'bg-[var(--bg-sub)] text-[var(--text-sub)] border border-[var(--border-main)]'
                         }`}>
                         <div className={`w-1.5 h-1.5 rounded-full ${
                             mcpStatus === 'connecting' ? 'animate-ping bg-yellow-500' : 
                             mcpStatus === 'connected' ? 'bg-green-500' : 
                             mcpStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
                         }`} />
                         {mcpStatus === 'connecting' ? '连接中...' : 
                          mcpStatus === 'connected' ? '已连接' : 
                          mcpStatus === 'error' ? '连接失败' : '未连接'}
                    </div>
                </div>

                <div className="bg-[var(--bg-sub)] p-4 rounded-xl border border-[var(--border-main)]">
                     <label className="text-[10px] text-[var(--text-sub)] mb-1 block">SSE Endpoint URL</label>
                     <div className="flex gap-2">
                         <input 
                            className="flex-1 bg-[var(--bg-main)] border border-[var(--border-main)] text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-[var(--text-main)] font-mono transition-all placeholder-gray-400"
                            value={mcpUrl}
                            onChange={(e) => setMcpUrl(e.target.value)}
                            placeholder="e.g. localhost:3000/sse"
                            disabled={mcpStatus === 'connected' || mcpStatus === 'connecting'}
                         />
                     </div>
                     <button 
                         onClick={() => handleConnectMcp(mcpStatus === 'connected' ? '' : mcpUrl)}
                         disabled={mcpStatus === 'connecting'}
                         className={`mt-3 w-full py-2 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95 ${
                             mcpStatus === 'connected' 
                             ? 'bg-white text-red-500 border border-red-200 hover:bg-red-50 dark:bg-[#2d2e30] dark:border-red-800 dark:text-red-400' 
                             : 'bg-[#0052CC] text-white hover:bg-[#0047B3] shadow-blue-200 dark:shadow-blue-900/20'
                         }`}
                     >
                         {mcpStatus === 'connected' ? '断开连接' : '立即连接'}
                     </button>
                     
                     {mcpStatus !== 'connected' && (
                         <p className="text-[10px] text-[var(--text-sub)] mt-3 leading-relaxed opacity-80">
                            连接到支持 <strong>MCP (Model Context Protocol)</strong> 的本地或远程服务器，赋予 AI 实时文件读写、数据库查询等扩展能力。
                         </p>
                     )}
                </div>
            </div>

            {/* Tools Section */}
            <div>
                 <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider">可用工具 ({mcpTools.length})</span>
                 </div>
                 
                 <div className="flex flex-col gap-3">
                     {mcpStatus === 'connected' ? (
                         mcpTools.length > 0 ? (
                             mcpTools.map(tool => renderMcpToolCard(tool))
                         ) : (
                             <div className="flex flex-col items-center justify-center py-10 text-[var(--text-sub)] bg-[var(--bg-sub)] rounded-xl border border-dashed border-[var(--border-main)]">
                                <ExtensionIcon className="w-8 h-8 mb-2 opacity-20" />
                                <p className="text-xs">未发现可用工具</p>
                             </div>
                         )
                     ) : (
                        <div className="text-center py-12 opacity-40">
                            <ExtensionIcon className="w-12 h-12 mx-auto mb-3 text-[var(--text-sub)]" />
                            <p className="text-xs text-[var(--text-sub)]">请先连接服务器</p>
                        </div>
                     )}
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;