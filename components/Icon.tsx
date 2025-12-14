import React from 'react';

const IconBase = ({ className = "w-6 h-6", d, style, children }: { className?: string, d?: string, style?: React.CSSProperties, children?: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" width="24" height="24">
    {d && <path d={d} />}
    {children}
  </svg>
);

// Updated to a vector path for better theming support
export const SparkleIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M12 2L9.15 8.55L2 12L9.15 15.45L12 22L14.85 15.45L22 12L14.85 8.55L12 2Z" />
);

// The static SVG icon for completed states
export const GoogleDotsIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="4" r="2.5" fill="#4285F4"/> {/* Top - Blue */}
    <circle cx="19" cy="8" r="2.5" fill="#EA4335"/> {/* Top Right - Red */}
    <circle cx="19" cy="16" r="2.5" fill="#FBBC04"/> {/* Bottom Right - Yellow */}
    <circle cx="12" cy="20" r="2.5" fill="#34A853"/> {/* Bottom - Green */}
    <circle cx="5" cy="16" r="2.5" fill="#34A853"/> {/* Bottom Left - Greenish */}
    <circle cx="5" cy="8" r="2.5" fill="#EA4335"/> {/* Top Left - Reddish */}
  </svg>
);


export const UploadIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/>
);

export const SendIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
);

export const HistoryIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
);

export const PlusIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
);

export const MenuIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
);

export const CloseIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 17.59 13.41 12z" />
);

export const HelpIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
);

export const SettingsIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59-.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.04.17 0 .4.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59.22l1.92-3.32c.04-.22 0-.45-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6-3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6 3.6z" />
);

export const DeleteIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
);

export const MicIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 2.34 9 5v6c0 1.66 1.34 3 3 3zM17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
);

export const StopIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
);

export const ChevronDownIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
);

export const ReplyIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
);

export const ArrowBackIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
);

export const CheckCircleIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
);

export const LightbulbIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z" />
);

export const ErrorIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
);

export const CheckIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
);

export const PriorityHighIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M10 3h4v12h-4zM10 19h4v4h-4z" />
);

export const FullscreenIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
);

export const HomeIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
);

export const LoginIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
);

export const LogoutIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c1.1 0 2-.9 2 2h8v-2H4V5z" />
);

export const ExtensionIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
);

// Updated Cleaner Sun Icon (Filled) for better visibility
export const LightModeIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z" />
);

// Updated Cleaner Moon Icon (Filled) for better visibility
export const DarkModeIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <IconBase className={className} d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
);