import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useDesignStore } from '../../store/designStore';
import { getComponentById } from '../../data';
import { Bot, Send, X, Loader2, Sparkles, Trash2, Play, Plus, Minus, Link } from 'lucide-react';
import { Node } from '@xyflow/react';

interface DesignAction {
  action: 'add_component' | 'remove_component' | 'connect';
  componentId?: string;
  x?: number;
  y?: number;
  nodeId?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  label?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  actions?: DesignAction[];
  actionsApplied?: boolean;
}

function parseActions(content: string): { text: string; actions: DesignAction[] } {
  const actionsRegex = /```actions\s*\n([\s\S]*?)\n```/g;
  let actions: DesignAction[] = [];
  let text = content;

  let match;
  while ((match = actionsRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        actions = [...actions, ...parsed];
      }
    } catch (e) {
      // Invalid JSON, skip
    }
    text = text.replace(match[0], '');
  }

  return { text: text.trim(), actions };
}

function ActionPreview({ actions, onApply, applied }: { actions: DesignAction[]; onApply: () => void; applied: boolean }) {
  const getActionIcon = (action: DesignAction) => {
    switch (action.action) {
      case 'add_component': return <Plus size={10} className="text-green-400" />;
      case 'remove_component': return <Minus size={10} className="text-red-400" />;
      case 'connect': return <Link size={10} className="text-blue-400" />;
    }
  };

  const getActionLabel = (action: DesignAction) => {
    switch (action.action) {
      case 'add_component': {
        const comp = action.componentId ? getComponentById(action.componentId) : null;
        return `Add ${comp?.name || action.componentId}`;
      }
      case 'remove_component':
        return `Remove node ${action.nodeId}`;
      case 'connect':
        return `Connect ${action.sourceNodeId} → ${action.targetNodeId}${action.label ? ` (${action.label})` : ''}`;
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-nvidia-green/30 bg-nvidia-green/5 p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-nvidia-green uppercase tracking-wide">Suggested Changes</span>
        <span className="text-[9px] text-slate-500">{actions.length} action{actions.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-1 mb-2">
        {actions.map((action, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-300">
            {getActionIcon(action)}
            <span>{getActionLabel(action)}</span>
          </div>
        ))}
      </div>
      {applied ? (
        <div className="text-[10px] text-nvidia-green font-medium flex items-center gap-1">
          ✓ Changes applied
        </div>
      ) : (
        <button
          onClick={onApply}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-nvidia-green text-black text-[10px] font-semibold rounded hover:bg-nvidia-green/90 transition-colors"
        >
          <Play size={10} />
          Apply Changes
        </button>
      )}
    </div>
  );
}

export function AIChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nodes = useDesignStore((s) => s.nodes);
  const edges = useDesignStore((s) => s.edges);
  const configName = useDesignStore((s) => s.configName);
  const workloadType = useDesignStore((s) => s.workloadType);
  const currentLayer = useDesignStore((s) => s.currentLayer);
  const addNode = useDesignStore((s) => s.addNode);
  const removeNode = useDesignStore((s) => s.removeNode);
  const onConnect = useDesignStore((s) => s.onConnect);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const applyActions = useCallback((actions: DesignAction[], messageIndex: number) => {
    for (const action of actions) {
      switch (action.action) {
        case 'add_component': {
          if (!action.componentId) break;
          const component = getComponentById(action.componentId);
          if (!component) break;
          const newNode: Node = {
            id: `${component.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'hardware',
            position: { x: action.x ?? 200, y: action.y ?? 200 },
            data: { component, label: component.name },
          };
          addNode(newNode);
          break;
        }
        case 'remove_component': {
          if (!action.nodeId) break;
          removeNode(action.nodeId);
          break;
        }
        case 'connect': {
          if (!action.sourceNodeId || !action.targetNodeId) break;
          onConnect({
            source: action.sourceNodeId,
            target: action.targetNodeId,
            sourceHandle: null,
            targetHandle: null,
          });
          break;
        }
      }
    }
    // Mark actions as applied
    setMessages(prev => prev.map((m, i) =>
      i === messageIndex ? { ...m, actionsApplied: true } : m
    ));
  }, [addNode, removeNode, onConnect]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    // Build a compact design summary for the AI (avoid sending full component specs)
    const compactDesign = {
      name: configName,
      workloadType,
      layer: currentLayer,
      nodes: nodes.map((n) => {
        const comp = (n.data as any)?.component;
        return {
          nodeId: n.id,
          componentId: comp?.id,
          name: comp?.name,
          category: comp?.category,
          vendor: comp?.vendor,
          position: n.position,
        };
      }),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: (e as any).label || undefined,
      })),
    };
    const designJson = JSON.stringify(compactDesign, null, 2);

    const userMessage = input.trim();
    setInput('');

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = [
        { role: 'system', content: `Current design JSON:\n${designJson}` },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        const reason = data.choices?.[0]?.finish_reason;
        const errorDetail = reason === 'length'
          ? 'The response was too long and got cut off. Try a more specific question.'
          : `Unexpected API response (finish_reason: ${reason || 'unknown'}). Response: ${JSON.stringify(data).slice(0, 300)}`;
        throw new Error(errorDetail);
      }
      const { text, actions } = parseActions(rawContent);

      setMessages([...newMessages, {
        role: 'assistant',
        content: text,
        actions: actions.length > 0 ? actions : undefined,
        actionsApplied: false,
      }]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Error: ${err.message}\n\nMake sure the OPENAI_API_KEY environment variable is set and the dev server was started with it available.` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    'What bottlenecks do you see in my design?',
    'Is this configuration NVIDIA-certified?',
    'How can I improve training throughput?',
    'Explain the networking topology choices',
    'What PCIe bandwidth is available per GPU?',
    'Should I use InfiniBand or RoCE for this?',
    'Add an InfiniBand switch to connect my NICs',
  ];

  return (
    <div className="w-96 bg-nvidia-dark border-l border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-nvidia-green flex items-center gap-2">
          <Bot size={16} />
          AI Design Assistant
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMessages([])}
            className="p-1 rounded hover:bg-slate-700 text-slate-400"
            title="Clear chat"
          >
            <Trash2 size={12} />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Sparkles className="w-8 h-8 text-nvidia-green/40 mx-auto mb-3" />
            <p className="text-xs text-slate-400 mb-4">
              Ask questions about your HPC design. Your current canvas layout is automatically shared as context.
            </p>
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-2">Try asking:</p>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q); }}
                  className="block w-full text-left text-[11px] text-slate-300 px-3 py-1.5 bg-nvidia-darker rounded border border-slate-700 hover:border-nvidia-green/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-nvidia-green/20 text-slate-200 border border-nvidia-green/30'
                  : 'bg-nvidia-darker text-slate-300 border border-slate-700'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1 mb-1 text-[10px] text-nvidia-green font-medium">
                  <Bot size={10} /> AI Assistant
                </div>
              )}
              {msg.role === 'assistant' ? (
                <>
                  <div className="prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:mb-2 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:mb-0.5 [&_code]:bg-slate-700/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-nvidia-green [&_code]:text-[10px] [&_pre]:bg-slate-800 [&_pre]:rounded [&_pre]:p-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_h1]:text-sm [&_h1]:font-bold [&_h1]:text-slate-200 [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:text-slate-200 [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-slate-300 [&_h3]:mt-1.5 [&_h3]:mb-1 [&_strong]:text-slate-100 [&_a]:text-nvidia-accent [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-nvidia-green/40 [&_blockquote]:pl-2 [&_blockquote]:text-slate-400 [&_hr]:border-slate-700 [&_hr]:my-2">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.actions && msg.actions.length > 0 && (
                    <ActionPreview
                      actions={msg.actions}
                      onApply={() => applyActions(msg.actions!, i)}
                      applied={!!msg.actionsApplied}
                    />
                  )}
                </>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-nvidia-darker text-slate-400 border border-slate-700 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Analyzing your design...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-slate-700 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your design..."
            rows={2}
            className="flex-1 bg-nvidia-darker border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-nvidia-green"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-3 bg-nvidia-green text-black rounded-lg hover:bg-nvidia-green/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[9px] text-slate-600 mt-1">
          Press Enter to send. Your design JSON is sent as context.
        </p>
      </div>
    </div>
  );
}
