import React, { useState, useRef, useEffect } from 'react';
import { FeedbackItem } from '../types';
import LatexRenderer from './LatexRenderer';
import { FullscreenIcon, CheckCircleIcon, ErrorIcon, LightbulbIcon, ReplyIcon } from './Icon';

interface AnnotationViewerProps {
  images: string[];
  annotations: FeedbackItem[];
  onOpenDetail?: () => void;
  onQuote: (text: string) => void;
}

const AnnotationViewer: React.FC<AnnotationViewerProps> = ({ images, annotations, onOpenDetail, onQuote }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popup if clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSelectedId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      case 'error': return { border: 'border-red-500', bg: 'bg-red-500/10', dot: 'bg-red-500', text: 'text-red-600' };
      case 'praise': return { border: 'border-green-500', bg: 'bg-green-500/10', dot: 'bg-green-500', text: 'text-green-600' };
      case 'suggestion': return { border: 'border-yellow-500', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500', text: 'text-yellow-600' };
      default: return { border: 'border-blue-500', bg: 'bg-blue-500/10', dot: 'bg-blue-500', text: 'text-blue-600' };
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

  return (
    <div className="flex flex-col gap-8 w-full" ref={containerRef}>
      {/* Images Container */}
      <div className="relative w-full rounded-3xl overflow-hidden bg-[#f8f9fa] border border-[#eff1f4] shadow-sm animate-scale-in group flex flex-col gap-1">
        
        {/* Iterate over multiple images */}
        {images.map((imageSrc, imgIndex) => (
            <div key={imgIndex} className="relative w-full">
                <img 
                  src={imageSrc} 
                  alt={`Homework Page ${imgIndex + 1}`} 
                  className="w-full h-auto block select-none" 
                />
                
                {/* Annotations for this specific image */}
                {annotations
                    .filter(item => item.imageIndex === imgIndex)
                    .map((item, index) => {
                        const colors = getColorClasses(item.type);
                        const isSelected = selectedId === item.id;
                        
                        // Smart positioning logic for popup
                        const [ymin, , , ] = item.box_2d;
                        const isTopHalf = ymin < 500;
                        
                        return (
                            <div
                              key={item.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(isSelected ? null : item.id);
                              }}
                              className={`absolute cursor-pointer transition-all duration-300 rounded-lg border-2 animate-scale-in
                                ${colors.border} 
                                ${isSelected 
                                    ? 'z-30 bg-transparent ring-4 ring-white/60 shadow-[0_0_0_2px_rgba(0,0,0,0.1)]' 
                                    : `z-10 ${colors.bg} opacity-60 hover:opacity-100`
                                } 
                                `}
                              style={{
                                  ...getStyleForBox(item.box_2d),
                                  animationDelay: `${index * 100 + 300}ms`
                              }}
                            >
                              {isSelected && (
                                <div className={`absolute -top-2 -right-2 w-4 h-4 rounded-full ${colors.dot} shadow-md ring-2 ring-white animate-scale-in`} />
                              )}

                              {isSelected && (
                                <div 
                                  className="absolute z-50 w-80 bg-white/95 backdrop-blur-sm text-[#1f1f1f] p-5 rounded-2xl shadow-2xl border border-white/20 animate-slide-up-fade flex flex-col gap-2"
                                  style={{ 
                                    top: isTopHalf ? 'calc(100% + 12px)' : 'auto',
                                    bottom: isTopHalf ? 'auto' : 'calc(100% + 12px)',
                                    left: '50%', 
                                    transform: 'translateX(-50%)' 
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div 
                                    className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-white/20 rotate-45 shadow-[-2px_-2px_2px_rgba(0,0,0,0.02)]
                                        ${isTopHalf ? '-top-2 border-t border-l' : '-bottom-2 border-b border-r'}
                                    `} 
                                  />
                                  
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className={colors.text}>
                                        {renderIcon(item.type, "w-5 h-5")}
                                    </div>
                                    <h4 className="font-medium text-sm tracking-wide text-[#1f1f1f] capitalize">
                                      {item.label}
                                    </h4>
                                     <button 
                                        onClick={() => onQuote(item.details)}
                                        className="ml-auto p-1.5 rounded-full hover:bg-gray-200/70 text-gray-500 hover:text-black transition-colors"
                                        title="引用此条"
                                    >
                                        <ReplyIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="text-sm">
                                      <LatexRenderer>{item.details}</LatexRenderer>
                                  </div>
                                </div>
                              )}
                            </div>
                        );
                    })
                }
            </div>
        ))}
        
        {/* Overlay Button */}
        {onOpenDetail && (
            <div className="absolute top-4 right-4 z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                 <button 
                    onClick={(e) => { e.stopPropagation(); onOpenDetail(); }}
                    className="bg-white/90 backdrop-blur text-[#1f1f1f] px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-sm font-medium border border-white/50"
                 >
                    <FullscreenIcon className="w-[18px] h-[18px]" />
                    进入详情模式
                 </button>
            </div>
        )}
      </div>
      
      {/* Feedback List */}
      <div className="bg-[#f0f4f9] p-6 sm:p-8 rounded-[28px] animate-slide-up-fade relative" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-[#1f1f1f] text-xl font-normal tracking-tight">反馈摘要</h3>
            <div className="flex items-center gap-2">
                <span className="text-sm text-[#444746] bg-white px-3 py-1 rounded-full border border-[#e3e3e3]">{annotations.length} 项</span>
                {onOpenDetail && (
                    <button 
                        onClick={onOpenDetail}
                        className="text-sm text-[#0b57d0] bg-white px-3 py-1 rounded-full border border-[#e3e3e3] hover:bg-blue-50 transition-colors flex items-center gap-1"
                    >
                        <FullscreenIcon className="w-4 h-4" />
                        进入详情模式
                    </button>
                )}
            </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {annotations.map((item, index) => {
                const colors = getColorClasses(item.type);
                const isSelected = selectedId === item.id;
                return (
                  <div 
                      key={item.id} 
                      className={`group flex flex-col gap-2 p-5 rounded-2xl cursor-pointer transition-all duration-200 border animate-slide-up-fade
                        ${isSelected 
                            ? 'bg-white shadow-md border-[#e3e3e3] ring-1 ring-[#e3e3e3]' 
                            : 'bg-white border-transparent hover:shadow-sm hover:border-[#e3e3e3]'
                        }`}
                      style={{ animationDelay: `${index * 100 + 400}ms` }}
                      onClick={() => {
                        setSelectedId(item.id);
                        if (containerRef.current) {
                            containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                  >
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <span className={`text-xs font-medium uppercase tracking-wider ${colors.text}`}>{item.type}</span>
                        <span className="text-[10px] text-gray-400 border px-1 rounded ml-auto">P.{item.imageIndex + 1}</span>
                    </div>
                    <div className="text-base font-medium text-[#1f1f1f]">{item.label}</div>
                    <div className="text-sm text-[#444746] leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
                        <LatexRenderer>{item.details}</LatexRenderer>
                    </div>
                  </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default AnnotationViewer;