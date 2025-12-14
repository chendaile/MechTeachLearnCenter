import React, { useState, useEffect, useRef } from 'react';
import { FeedbackItem, GradingResponse } from '../types';
import { ArrowBackIcon, CheckCircleIcon, ErrorIcon, LightbulbIcon, CheckIcon, PriorityHighIcon, ReplyIcon } from './Icon';
import LatexRenderer from './LatexRenderer';

interface DetailViewProps {
  images: string[];
  gradingResponse: GradingResponse;
  onClose: () => void;
  onQuote: (text: string) => void;
}

const DetailView: React.FC<DetailViewProps> = ({ images, gradingResponse, onClose, onQuote }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const boxRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Scroll to selected item in sidebar when selectedId changes
  useEffect(() => {
    if (selectedId && scrollRefs.current[selectedId]) {
      scrollRefs.current[selectedId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Also scroll the image view to the selected box
    if (selectedId && boxRefs.current[selectedId]) {
        boxRefs.current[selectedId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedId]);

  const getStyleForBox = (box: number[]) => {
    const [ymin, xmin, ymax, xmax] = box;
    // Convert 0-1000 scale to percentages
    return {
      top: `${ymin / 10}%`,
      left: `${xmin / 10}%`,
      height: `${(ymax - ymin) / 10}%`,
      width: `${(xmax - xmin) / 10}%`,
    };
  };

  const getColorClasses = (type: string) => {
    switch (type) {
      case 'error': return { border: 'border-red-500', bg: 'bg-red-500/20', text: 'text-red-600 dark:text-red-400', cardBorder: 'border-red-200 dark:border-red-900', bgSelected: 'bg-red-50 dark:bg-red-900/10' };
      case 'praise': return { border: 'border-green-500', bg: 'bg-green-500/20', text: 'text-green-600 dark:text-green-400', cardBorder: 'border-green-200 dark:border-green-900', bgSelected: 'bg-green-50 dark:bg-green-900/10' };
      case 'suggestion': return { border: 'border-yellow-500', bg: 'bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400', cardBorder: 'border-yellow-200 dark:border-yellow-900', bgSelected: 'bg-yellow-50 dark:bg-yellow-900/10' };
      default: return { border: 'border-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', cardBorder: 'border-blue-200 dark:border-blue-900', bgSelected: 'bg-blue-50 dark:bg-blue-900/10' };
    }
  };

  const renderIcon = (type: string, className: string) => {
      switch (type) {
          case 'error': return <ErrorIcon className={className} />;
          case 'praise': return <CheckCircleIcon className={className} />;
          case 'suggestion': return <LightbulbIcon className={className} />;
          default: return <LightbulbIcon className={className} />;
      }
  };

  const renderOverlayIcon = (type: string, className: string) => {
      switch (type) {
          case 'error': return <PriorityHighIcon className={className} />; // Use exclamation for overlay dot
          case 'praise': return <CheckIcon className={className} />;
          case 'suggestion': return <LightbulbIcon className={className} />;
          default: return <LightbulbIcon className={className} />;
      }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-main)] flex flex-col animate-scale-in">
      {/* Header */}
      <div className="h-16 border-b border-[var(--border-main)] flex items-center justify-between px-6 bg-[var(--bg-main)] shrink-0 z-20 relative shadow-sm">
        <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 -ml-2 hover:bg-[var(--bg-sub)] rounded-full transition-colors text-[var(--text-sub)]">
                <ArrowBackIcon />
            </button>
            <h2 className="text-lg font-medium text-[var(--text-main)]">批改详情</h2>
        </div>
        <div className="flex gap-2">
             <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {gradingResponse.annotations.filter(a => a.type === 'error').length} 处错误
             </span>
             <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                {gradingResponse.annotations.filter(a => a.type === 'praise').length} 处优秀
             </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Image Stage (Scrollable) */}
        <div className="flex-1 bg-[var(--bg-sub)] p-8 overflow-y-auto relative flex flex-col items-center gap-8" onClick={() => setSelectedId(null)}>
             
             {images.map((imgSrc, imgIndex) => (
                 <div key={imgIndex} className="relative w-full max-w-4xl shadow-lg rounded-lg overflow-hidden bg-white dark:bg-[#2d2e30] select-none shrink-0 border border-[var(--border-main)]">
                    <img 
                        src={imgSrc} 
                        alt={`Page ${imgIndex + 1}`} 
                        className="w-full h-auto block" 
                    />
                    
                    {/* Page Number Indicator */}
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                        Page {imgIndex + 1}
                    </div>

                    {gradingResponse.annotations
                        .filter(item => item.imageIndex === imgIndex)
                        .map((item) => {
                            const colors = getColorClasses(item.type);
                            const isSelected = selectedId === item.id;
                            
                            return (
                                <div
                                    key={item.id}
                                    ref={(el) => { boxRefs.current[item.id] = el; }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedId(item.id);
                                    }}
                                    className={`absolute cursor-pointer transition-all duration-200 border-2
                                        ${colors.border} 
                                        ${isSelected 
                                            ? 'bg-transparent ring-4 ring-white/70 dark:ring-black/50 shadow-lg z-20' 
                                            : `${colors.bg} opacity-60 hover:opacity-100 z-10`
                                        }
                                    `}
                                    style={getStyleForBox(item.box_2d)}
                                >
                                    {isSelected && (
                                        <div className={`absolute -top-3 -right-3 w-6 h-6 rounded-full ${colors.bg.replace('/20', '')} border-2 border-white dark:border-gray-800 flex items-center justify-center shadow-sm`}>
                                            {renderOverlayIcon(item.type, `w-3.5 h-3.5 ${colors.text} font-bold`)}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    }
                 </div>
             ))}
        </div>

        {/* Right: Sidebar List */}
        <div className="w-[400px] border-l border-[var(--border-main)] bg-[var(--bg-main)] flex flex-col shrink-0 shadow-xl z-20">
             <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-3">总评</h3>
                    <div className="p-4 bg-[var(--bg-sub)] rounded-xl text-[var(--text-main)] text-sm leading-relaxed border border-[var(--border-main)]">
                        <LatexRenderer>{gradingResponse.summary}</LatexRenderer>
                    </div>
                </div>
                
                <h3 className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-4 flex items-center justify-between">
                    详细批注
                    <span className="text-[10px] bg-[var(--bg-sub)] px-2 py-0.5 rounded-full text-[var(--text-sub)]">{gradingResponse.annotations.length}</span>
                </h3>
                
                <div className="flex flex-col gap-3 pb-10">
                    {gradingResponse.annotations.map((item) => {
                        const colors = getColorClasses(item.type);
                        const isSelected = selectedId === item.id;
                        return (
                            <div
                                key={item.id}
                                ref={(el) => { scrollRefs.current[item.id] = el; }}
                                onClick={() => setSelectedId(item.id)}
                                className={`group p-4 rounded-xl border transition-all duration-200 cursor-pointer relative
                                    ${isSelected 
                                        ? `${colors.cardBorder} ${colors.bgSelected} shadow-md ring-1 ring-offset-0 ${colors.border.replace('border-', 'ring-').replace('-500', '-200')} dark:ring-offset-[#131314]` 
                                        : 'border-[var(--border-main)] hover:border-[#c7c7c7] dark:hover:border-gray-600 hover:bg-[var(--bg-sub)]'
                                    }
                                `}
                            >
                                {isSelected && <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${colors.bg.replace('/20', '')}`} />}
                                
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className={colors.text}>
                                        {renderIcon(item.type, "w-[18px] h-[18px]")}
                                    </div>
                                    <span className={`text-xs font-bold uppercase tracking-wide ${colors.text}`}>{item.type}</span>
                                    <div className="ml-auto flex items-center gap-1">
                                      <button 
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              onQuote(item.details);
                                              onClose();
                                          }}
                                          className="p-1.5 rounded-full text-gray-400 hover:bg-gray-200/70 hover:text-black dark:hover:bg-gray-700 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                          title="引用此条"
                                      >
                                          <ReplyIcon className="w-4 h-4" />
                                      </button>
                                      <span className="text-[10px] text-gray-400 border border-gray-200 dark:border-gray-700 px-1 rounded">P.{item.imageIndex + 1}</span>
                                    </div>
                                </div>
                                <div className={`font-medium text-[15px] mb-1 ${isSelected ? 'text-[var(--text-main)]' : 'text-[var(--text-main)]'}`}>
                                    {item.label}
                                </div>
                                <div className={`text-sm leading-relaxed ${isSelected ? 'text-[var(--text-main)]' : 'text-[var(--text-sub)]'}`}>
                                    <LatexRenderer>{item.details}</LatexRenderer>
                                </div>
                            </div>
                        )
                    })}
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};

export default DetailView;