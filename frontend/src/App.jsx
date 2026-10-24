import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Bot,
  User,
  UploadCloud,
  FileText,
  Trash2,
  Key,
  Send,
  Database,
  Layers,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  X,
  ExternalLink,
  Globe,
  BookOpen
} from "lucide-react";
import "./App.css";

const API_BASE = "http://localhost:8000/api";

export default function App() {
  const [status, setStatus] = useState({
    configured: false,
    has_key: false,
    total_chunks: 0,
    documents: []
  });

  const [messages, setMessages] = useState([
    {
      id: "welcome-msg",
      role: "agent",
      content:
        "Olá! Sou o seu **Agente de IA** integrado ao **Google Gemini**. Faça o upload dos seus documentos (PDF, DOCX, TXT ou MD) ao lado para que eu possa indexá-los e responder suas dúvidas com citações exatas das fontes!",
      sources: [],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const [inputQuery, setInputQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedSources, setExpandedSources] = useState({});
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [toast, setToast] = useState(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isFar = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isFar);
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Carrega status da API
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.warn("Backend ainda não disponível ou iniciando...", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Salvar Chave API
  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKeyInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Chave da API do Gemini configurada com sucesso!");
        setIsApiKeyModalOpen(false);
        setApiKeyInput("");
        fetchStatus();
      } else {
        showToast(data.detail || "Erro ao salvar chave", "error");
      }
    } catch (err) {
      showToast("Não foi possível conectar ao servidor backend.", "error");
    }
  };

  // Upload de arquivos
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    if (!status.configured) {
      setIsApiKeyModalOpen(true);
      showToast("Configure sua Chave Gemini antes de enviar arquivos.", "error");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`${data.total_chunks_indexed} novos trechos indexados na base vetorial!`);
        fetchStatus();
      } else {
        showToast(data.detail || "Erro no processamento dos arquivos.", "error");
      }
    } catch (err) {
      showToast("Falha na comunicação ao enviar arquivo.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  // Remover documento
  const handleDeleteDocument = async (filename) => {
    if (!confirm(`Remover "${filename}" da base de conhecimento?`)) return;

    try {
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast(`Documento "${filename}" removido com sucesso.`);
        fetchStatus();
      }
    } catch (err) {
      showToast("Erro ao remover documento.", "error");
    }
  };

  // Limpar toda a base
  const handleClearAll = async () => {
    if (!confirm("Tem certeza que deseja apagar todos os documentos e a base vetorial?")) return;

    try {
      const res = await fetch(`${API_BASE}/clear`, { method: "POST" });
      if (res.ok) {
        showToast("Base de conhecimento limpa.");
        fetchStatus();
      }
    } catch (err) {
      showToast("Erro ao limpar base.", "error");
    }
  };

  // Enviar mensagem
  const handleSendMessage = async (customPrompt = null) => {
    const text = customPrompt || inputQuery;
    if (!text.trim() || isGenerating) return;

    if (!status.configured) {
      setIsApiKeyModalOpen(true);
      showToast("Insira sua chave Gemini API para interagir.", "error");
      return;
    }

    const userMsgId = `user-${Date.now()}`;
    const newMsg = {
      id: userMsgId,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputQuery("");
    setIsGenerating(true);
    setGenerationStage("Recuperando contexto semântico nos documentos...");

    try {
      setTimeout(() => {
        setGenerationStage("Gemini sintetizando resposta com citações...");
      }, 700);

      const res = await fetch(`${API_BASE}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, top_k: 4 })
      });

      const data = await res.json();

      if (res.ok) {
        const agentMsgId = `agent-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: agentMsgId,
            role: "agent",
            content: data.answer,
            sources: data.sources || [],
            web_sources: data.web_sources || [],
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "agent",
            content: `⚠️ **Aviso do Sistema:** ${data.detail || "Erro ao processar consulta."}`,
            sources: [],
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "agent",
          content: "❌ **Erro de conexão:** Não foi possível contactar o servidor local do Agente RAG.",
          sources: [],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setIsGenerating(false);
      setGenerationStage("");
    }
  };

  const copyToClipboard = (text, msgId = null) => {
    navigator.clipboard.writeText(text);
    if (msgId) {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2500);
    }
    showToast("Resposta copiada para a área de transferência!");
  };

  const toggleSources = (msgId) => {
    setExpandedSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const quickPrompts = [
    "Quais são os principais pontos dos documentos carregados?",
    "Pesquise as últimas novidades de tecnologia e me dê os links oficiais.",
    "O que é o modelo Gemini 2.5 e onde encontrar a documentação?",
    "Quais as principais recomendações ou dados encontrados?"
  ];

  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            background: "#151922",
            border: toast.type === "error" ? "1px solid #ef4444" : "1px solid #2c3446",
            color: "#f1f5f9",
            padding: "0.7rem 1.1rem",
            borderRadius: "6px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            fontSize: "0.86rem",
            fontWeight: 500
          }}
          className="animate-fade-in"
        >
          {toast.type === "error" ? (
            <AlertCircle size={17} style={{ color: "#ef4444" }} />
          ) : (
            <CheckCircle2 size={17} style={{ color: "#10b981" }} />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-icon-wrapper">
            <Sparkles size={22} />
          </div>
          <div className="logo-title">
            NEXUS AI
            <span className="logo-badge">GEMINI 2.5</span>
          </div>
        </div>

        <div className="header-actions">
          <div className="status-badge">
            <div className={`status-dot ${status.configured ? "online" : "offline"}`} />
            <span>{status.configured ? "Gemini Conectado" : "Requer API Key"}</span>
          </div>

          <button className="btn-header" onClick={() => setIsApiKeyModalOpen(true)}>
            <Key size={16} />
            <span>Configurar Chave</span>
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="main-content">
        {/* Sidebar: Base de Conhecimento RAG */}
        <aside className="knowledge-sidebar">
          <div className="sidebar-section-title">
            <span>Base de Conhecimento</span>
            {status.documents.length > 0 && (
              <button
                onClick={handleClearAll}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent-rose)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
                title="Limpar todos os documentos"
              >
                <Trash2 size={13} /> Limpar
              </button>
            )}
          </div>

          <div className="sidebar-scrollable">
            {/* Drag & Drop Zone */}
            <div
              className={`dropzone ${isDragOver ? "active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                multiple
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <div className="dropzone-icon">
                {isUploading ? (
                  <div className="thinking-spinner" style={{ width: "24px", height: "24px" }} />
                ) : (
                  <UploadCloud size={24} />
                )}
              </div>
              <div className="dropzone-title">
                {isUploading ? "Indexando com Gemini..." : "Solte seus arquivos aqui"}
              </div>
              <div className="dropzone-subtitle">
                ou clique para selecionar documentos
              </div>

              <div className="formats-badges">
                <span className="format-badge">PDF</span>
                <span className="format-badge">DOCX</span>
                <span className="format-badge">TXT</span>
                <span className="format-badge">MD</span>
              </div>
            </div>

            {/* Estatísticas da Base */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{status.documents.length}</div>
                <div className="stat-label">Documentos Ativos</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{status.total_chunks}</div>
                <div className="stat-label">Trechos Vetorizados</div>
              </div>
            </div>

            {/* Lista de Documentos */}
            <div className="sidebar-section-title" style={{ padding: "0.5rem 0" }}>
              <span>Documentos ({status.documents.length})</span>
            </div>

            <div className="documents-list">
              {status.documents.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "1.5rem 0.5rem",
                    color: "var(--text-muted)",
                    fontSize: "0.82rem"
                  }}
                >
                  Nenhum documento carregado ainda. Adicione PDFs ou textos para enriquecer o agente.
                </div>
              ) : (
                status.documents.map((doc, idx) => (
                  <div key={idx} className="doc-card animate-fade-in">
                    <div className="doc-info">
                      <div className="doc-icon">
                        <FileText size={16} />
                      </div>
                      <div className="doc-meta">
                        <div className="doc-name" title={doc.filename}>
                          {doc.filename}
                        </div>
                        <div className="doc-sub">
                          {doc.chunks_count} chunks • {doc.pages_count} pág.
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn-icon-danger"
                      onClick={() => handleDeleteDocument(doc.filename)}
                      title="Excluir documento"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Chat Principal */}
        <main className="chat-container">
          <div className="chat-messages" ref={chatContainerRef} onScroll={handleChatScroll}>
            {messages.length === 1 && status.documents.length === 0 && (
              <div className="empty-hero animate-fade-in">
                <div className="hero-icon-glow">
                  <Database size={34} />
                </div>
                <h1 className="hero-title">IA Conectada</h1>
                <p className="hero-desc">
                  Pergunte sobre seus documentos ou faça qualquer pergunta sobre o mundo e atualidades.
                  O NEXUS AI pesquisa na web em tempo real e fornece respostas estruturadas com links clicáveis.
                </p>

                <div className="quick-prompts-grid">
                  {quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      className="quick-prompt-btn"
                      onClick={() => handleSendMessage(prompt)}
                    >
                      <Sparkles size={16} style={{ color: "var(--accent-primary)", flexShrink: 0, marginTop: "2px" }} />
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.role} animate-fade-in`}>
                {msg.role === "agent" && (
                  <div className="avatar agent">
                    <Bot size={20} />
                  </div>
                )}

                <div className={`message-bubble ${msg.role}`}>
                  {msg.role === "agent" && (
                    <div className="message-header-bar">
                      <span className="agent-name">
                        <Sparkles size={14} /> NEXUS AI
                      </span>
                      <button
                        className="btn-copy"
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        title="Copiar resposta"
                      >
                        {copiedId === msg.id ? (
                          <Check size={13} style={{ color: "#10b981" }} />
                        ) : (
                          <Copy size={13} />
                        )}
                        <span>{copiedId === msg.id ? "Copiado!" : "Copiar"}</span>
                      </button>
                    </div>
                  )}

                  {/* Conteúdo com Scroll para Respostas Longas */}
                  <div className={msg.role === "agent" ? "agent-message-scroll" : ""}>
                    <div className="markdown-content">
                      <ReactMarkdown
                        components={{
                          a: ({ node, ...props }) => (
                            <a
                              {...props}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="markdown-link"
                              title="Abrir link em nova aba"
                            />
                          )
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Barra Inferior para o Agente (Documentos Locais, Fontes Web & Horário) */}
                  {msg.role === "agent" && (msg.sources?.length > 0 || msg.web_sources?.length > 0 || msg.timestamp) && (
                    <div className="message-footer-bar">
                      <div className="footer-actions-left">
                        {msg.sources && msg.sources.length > 0 && (
                          <button
                            className="btn-action-footer"
                            onClick={() => toggleSources(msg.id)}
                            title="Ver trechos e documentos locais consultados"
                          >
                            <BookOpen size={13} />
                            <span>
                              {msg.sources.length} {msg.sources.length === 1 ? "Documento" : "Documentos"}
                            </span>
                            {expandedSources[msg.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        )}

                        {msg.web_sources && msg.web_sources.length > 0 && (
                          <div className="web-sources-chips">
                            <span className="web-sources-title">
                              <Globe size={12} /> Web:
                            </span>
                            {msg.web_sources.map((webSrc, wIdx) => (
                              <a
                                key={wIdx}
                                href={webSrc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="web-source-chip"
                                title={`Acessar: ${webSrc.url}`}
                              >
                                <span>{webSrc.title}</span>
                                <ExternalLink size={10} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {msg.timestamp && (
                        <span className="footer-timestamp">{msg.timestamp}</span>
                      )}
                    </div>
                  )}

                  {/* Trechos das Fontes RAG Expandidos */}
                  {msg.sources && msg.sources.length > 0 && expandedSources[msg.id] && (
                    <div className="sources-cards-grid animate-fade-in" style={{ marginTop: "0.75rem" }}>
                      {msg.sources.map((src, sIdx) => (
                        <div key={sIdx} className="source-snippet-card">
                          <div className="source-snippet-header">
                            <div className="source-filename">
                              <FileText size={14} />
                              <span>{src.filename}</span>
                              {src.page && (
                                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                  • Pág. {src.page}
                                </span>
                              )}
                            </div>
                            <span className="source-score">{src.score_pct}% Match</span>
                          </div>
                          <div className="source-text-body">{src.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="avatar user">
                    <User size={18} />
                  </div>
                )}
              </div>
            ))}

            {isGenerating && (
              <div className="message-row agent animate-fade-in">
                <div className="avatar agent">
                  <Bot size={20} />
                </div>
                <div className="agent-thinking">
                  <div className="thinking-spinner" />
                  <span>{generationStage}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Botão Flutuante de Rolar para o Final */}
          {showScrollBottom && (
            <button
              className="btn-scroll-bottom animate-fade-in"
              onClick={scrollToBottom}
              title="Rolar para a última mensagem"
            >
              <ArrowDown size={14} />
              <span>Voltar ao final</span>
            </button>
          )}

          {/* Barra de Digitação */}
          <div className="chat-input-wrapper">
            <form
              className="chat-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                id="query-input"
                type="text"
                className="chat-input"
                placeholder={
                  status.documents.length === 0
                    ? "Pergunte algo ou envie um documento para começar..."
                    : "Faça uma pergunta sobre seus documentos..."
                }
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                disabled={isGenerating}
              />
              <button
                type="submit"
                id="send-button"
                className="btn-send"
                disabled={!inputQuery.trim() || isGenerating}
                title="Enviar pergunta"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* Modal de Configuração de Chave API */}
      {isApiKeyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <Key size={20} style={{ color: "var(--accent-indigo)" }} />
                <h3 className="modal-title">Configurar Google Gemini API</h3>
              </div>
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Para gerar embeddings semânticos e respostas com o Gemini, insira sua chave da API.
              Você pode obter uma chave gratuita no{" "}
              <a
                href="https://aistudio.google.com"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}
              >
                Google AI Studio <ExternalLink size={12} style={{ display: "inline" }} />
              </a>
              .
            </p>

            <form onSubmit={handleSaveApiKey} style={{ marginTop: "1rem" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                GEMINI API KEY
              </label>
              <input
                id="api-key-input"
                type="password"
                className="input-field"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                autoFocus
              />

              <button type="submit" id="save-key-btn" className="btn-primary">
                Salvar & Conectar Agente
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
