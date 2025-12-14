import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';

interface LatexRendererProps {
  children: string;
}

const LatexRenderer: React.FC<LatexRendererProps> = ({ children }) => {
  if (!children) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeKatex]}
      className="markdown-body"
      components={{
        // Paragraphs
        p: ({node, ...props}) => <p className="mb-4 last:mb-0 leading-relaxed text-[var(--text-main)]" {...props} />,
        
        // Headings
        h1: ({node, ...props}) => <h1 className="text-2xl font-medium mt-6 mb-4 text-[var(--text-main)]" {...props} />,
        h2: ({node, ...props}) => <h2 className="text-xl font-medium mt-5 mb-3 text-[var(--text-main)]" {...props} />,
        h3: ({node, ...props}) => <h3 className="text-lg font-medium mt-4 mb-2 text-[var(--text-main)]" {...props} />,
        
        // Lists
        ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 mb-4 space-y-1 text-[var(--text-main)]" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1 text-[var(--text-main)]" {...props} />,
        li: ({node, ...props}) => <li className="pl-1" {...props} />,
        
        // Links
        a: ({node, ...props}) => <a className="text-[#0b57d0] dark:text-blue-400 hover:underline cursor-pointer font-medium" target="_blank" rel="noopener noreferrer" {...props} />,
        
        // Blockquotes
        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[var(--border-main)] pl-4 py-1 my-4 text-[var(--text-sub)] italic bg-[var(--bg-sub)] rounded-r" {...props} />,
        
        // Code Blocks
        code: ({node, inline, className, children, ...props}: any) => {
          const match = /language-(\w+)/.exec(className || '');
          return !inline ? (
            <div className="relative my-4 rounded-lg overflow-hidden bg-[var(--bg-sub)] border border-[var(--border-main)]">
                {match && (
                    <div className="bg-[var(--bg-selected)] px-4 py-1.5 text-xs font-medium text-[var(--text-sub)] border-b border-[var(--border-main)] flex justify-between items-center">
                        <span>{match[1]}</span>
                        <span className="material-symbols-outlined text-[14px] cursor-pointer hover:text-[var(--text-main)]" title="Copy">content_copy</span>
                    </div>
                )}
                <pre className="p-4 overflow-x-auto text-sm font-mono text-[var(--text-main)] leading-6">
                    <code className={className} {...props}>
                        {children}
                    </code>
                </pre>
            </div>
          ) : (
            <code className="bg-[var(--bg-sub)] text-[var(--text-main)] px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-[var(--border-main)]" {...props}>
              {children}
            </code>
          );
        },
        
        // Tables
        table: ({node, ...props}) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-[var(--border-main)]">
                <table className="min-w-full divide-y divide-[var(--border-main)]" {...props} />
            </div>
        ),
        thead: ({node, ...props}) => <thead className="bg-[var(--bg-sub)]" {...props} />,
        th: ({node, ...props}) => <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-sub)] uppercase tracking-wider" {...props} />,
        tbody: ({node, ...props}) => <tbody className="bg-[var(--bg-main)] divide-y divide-[var(--border-main)]" {...props} />,
        tr: ({node, ...props}) => <tr className="hover:bg-[var(--bg-sub)] transition-colors" {...props} />,
        td: ({node, ...props}) => <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-main)]" {...props} />,
        
        // Horizontal Rule
        hr: ({node, ...props}) => <hr className="my-6 border-[var(--border-main)]" {...props} />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
};

export default LatexRenderer;