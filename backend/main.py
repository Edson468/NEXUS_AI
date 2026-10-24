import os
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag_engine import RAGEngine
from document_processor import DocumentProcessor

app = FastAPI(
    title="Agente IA RAG API",
    description="API de Recuperação Aumentada por Geração (RAG) integrada com Google Gemini",
    version="2.0.0"
)

# Configuração de CORS para permitir acesso do React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite desenvolvimento local
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializa o motor RAG
rag_engine = RAGEngine(data_dir=os.path.join(os.path.dirname(__file__), "data"))

# Modelos Pydantic
class QueryRequest(BaseModel):
    question: str
    top_k: Optional[int] = 4

class ConfigRequest(BaseModel):
    api_key: str

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Agente IA RAG Gemini API",
        "configured": rag_engine.is_configured(),
        "total_chunks": len(rag_engine.chunks)
    }

@app.get("/api/status")
def get_status():
    return {
        "configured": rag_engine.is_configured(),
        "has_key": bool(rag_engine.api_key),
        "total_chunks": len(rag_engine.chunks),
        "documents": rag_engine.list_documents()
    }

@app.post("/api/config")
def update_config(req: ConfigRequest):
    if not req.api_key or not req.api_key.strip():
        raise HTTPException(status_code=400, detail="Chave de API não pode ser vazia.")
    
    rag_engine.set_api_key(req.api_key)
    return {
        "success": True,
        "configured": rag_engine.is_configured(),
        "message": "Chave Gemini atualizada com sucesso!"
    }

@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    if not rag_engine.is_configured():
        raise HTTPException(
            status_code=400, 
            detail="Configure sua Chave Gemini API antes de fazer upload de arquivos."
        )

    processed_summary = []
    total_new_chunks = 0

    for file in files:
        filename = file.filename
        try:
            content = await file.read()
            # 1. Extração de texto
            extracted_blocks = DocumentProcessor.extract_text_from_file(filename, content)
            if not extracted_blocks:
                processed_summary.append({
                    "filename": filename,
                    "status": "ignored",
                    "reason": "Arquivo vazio ou texto não extraível"
                })
                continue

            # 2. Chunking inteligente
            chunks = DocumentProcessor.chunk_text(
                text_blocks=extracted_blocks,
                filename=filename,
                chunk_size=500,
                chunk_overlap=80
            )

            # 3. Embeddings & indexação na base vetorial
            added_count = rag_engine.add_chunks(chunks)
            total_new_chunks += added_count

            processed_summary.append({
                "filename": filename,
                "status": "indexed",
                "chunks": added_count,
                "sections": len(extracted_blocks)
            })

        except Exception as e:
            processed_summary.append({
                "filename": filename,
                "status": "error",
                "reason": str(e)
            })

    return {
        "success": True,
        "summary": processed_summary,
        "total_chunks_indexed": total_new_chunks,
        "total_knowledge_chunks": len(rag_engine.chunks)
    }

@app.post("/api/query")
def query_rag(req: QueryRequest):
    if not rag_engine.is_configured():
        raise HTTPException(
            status_code=400, 
            detail="Configure sua chave da API do Google Gemini para realizar consultas."
        )

    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="A pergunta não pode estar vazia.")

    try:
        response = rag_engine.query_agent(req.question, top_k=req.top_k or 4)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents")
def get_documents():
    return {
        "documents": rag_engine.list_documents(),
        "total_chunks": len(rag_engine.chunks)
    }

@app.delete("/api/documents/{filename}")
def delete_document(filename: str):
    removed = rag_engine.delete_document(filename)
    if not removed:
        raise HTTPException(status_code=404, detail="Documento não encontrado na base de conhecimento.")
    
    return {
        "success": True,
        "message": f"Documento '{filename}' removido da base vetorial.",
        "remaining_chunks": len(rag_engine.chunks)
    }

@app.post("/api/clear")
def clear_knowledge():
    rag_engine.clear_all()
    return {
        "success": True,
        "message": "Base de conhecimento totalmente limpa."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
