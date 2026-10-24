# ⚡ NEXUS AI — Agente com Base de Conhecimento e Google Gemini

Um agente de inteligência artificial de alta performance com arquitetura **RAG (Retrieval-Augmented Generation)**, integrado ao **Google Gemini (Gemini 2.5 e text-embedding-004)** e interface moderna, dinâmica e futurista com tema escuro e glassmorphism.

---

## 🚀 Funcionalidades

- **Recuperação Aumentada (RAG)**: Indexa trechos semânticos com `text-embedding-004` e similaridade de cosseno ultrarrápida.
- **Transparência de Fontes**: Cada resposta cita os documentos exatos, com indicador de página e porcentagem de compatibilidade (`% Match`).
- **Upload Drag-and-Drop Dinâmico**: Suporte direto para arquivos **PDF**, **DOCX**, **TXT** e **Markdown (MD)**.
- **Agente com Google Gemini**: Respostas inteligentes, bem formatadas em Markdown com raciocínio contextual.
- **Gestão da Base de Conhecimento**: Estatísticas em tempo real (total de arquivos, trechos vetorizados), remoção individual e limpeza total.
- **Interface Premium**: Dark mode imersivo, tipografia com Google Fonts (`Outfit` & `Plus Jakarta Sans`), micro-animações e modal para configuração de API Key.

---

## 🛠️ Tecnologias Utilizadas

- **Backend**:
  - Python 3.14+
  - FastAPI
  - Uvicorn
  - Google GenAI SDK (`google-genai`)
  - NumPy (cálculo vetorial e persistência)
  - PyPDF & Python-docx (extração de documentos)
- **Frontend**:
  - React + Vite
  - Lucide React (ícones modernos)
  - React Markdown (renderização de respostas ricas)
  - CSS3 avançado (Design System próprio, sem dependência de frameworks pesados)

---

## ⚡ Como Executar

### Método 1: Inicialização Rápida (Recomendado no Windows)
Basta dar dois cliques no arquivo:
```bash
start.bat
```
Ele abrirá automaticamente o backend (`http://localhost:8000`) e o frontend (`http://localhost:5173`).

---

### Método 2: Execução Manual

#### 1. Iniciar o Backend
```bash
cd backend
..\.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Iniciar o Frontend
Em outro terminal:
```bash
cd frontend
npm run dev
```

Acesse no navegador: **http://localhost:5173**

---

## 🔑 Configuração da Google Gemini API Key

1. Obtenha sua chave gratuita no [Google AI Studio](https://aistudio.google.com).
2. Você pode configurá-la de duas formas:
   - **Pela Interface**: Ao abrir a aplicação, clique no botão **"Configurar Chave"** no topo superior direito e cole sua chave.
   - **No arquivo `.env`**: Na pasta `backend/`, crie ou edite o arquivo `.env`:
     ```env
     GEMINI_API_KEY=AIzaSySuaChaveAqui...
     ```

---

## 📂 Estrutura do Projeto

```
Projeto Agente2.0/
├── backend/
│   ├── main.py                # Servidor FastAPI com endpoints REST e CORS
│   ├── rag_engine.py          # Motor RAG, embeddings e integração com Gemini
│   ├── document_processor.py  # Extrator PDF/DOCX/TXT e chunking inteligente
│   ├── data/                  # Base vetorial persistente (chunks e embeddings)
│   └── .env.example           # Exemplo de configuração de variáveis
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Aplicação React com Chat e Base de Conhecimento
│   │   ├── App.css            # Estilos dos componentes e animações
│   │   ├── index.css          # Design system, paleta HSL e tema dark
│   │   └── main.jsx
│   └── index.html             # HTML com fontes Google Fonts e SEO
├── start.bat                  # Script de execução rápida unificado
├── run_backend.bat            # Executa apenas o backend
└── run_frontend.bat           # Executa apenas o frontend
```
