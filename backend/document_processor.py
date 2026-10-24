import os
import io
from typing import List, Dict, Any
from pypdf import PdfReader
from docx import Document

class DocumentProcessor:
    @staticmethod
    def extract_text_from_file(filename: str, file_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Extrai o texto do arquivo e retorna blocos com metadados como número da página/seção.
        Retorna: List[{"text": str, "page": int | None, "section": str | None}]
        """
        ext = os.path.splitext(filename)[1].lower()
        results = []

        if ext == ".pdf":
            reader = PdfReader(io.BytesIO(file_bytes))
            for page_num, page in enumerate(reader.pages, start=1):
                page_text = page.extract_text() or ""
                page_text = page_text.strip()
                if page_text:
                    results.append({
                        "text": page_text,
                        "page": page_num,
                        "section": f"Página {page_num}"
                    })

        elif ext in [".docx", ".doc"]:
            doc = Document(io.BytesIO(file_bytes))
            full_text = []
            for para in doc.paragraphs:
                if para.text.strip():
                    full_text.append(para.text.strip())
            
            combined_text = "\n\n".join(full_text)
            if combined_text:
                results.append({
                    "text": combined_text,
                    "page": 1,
                    "section": "Documento Word"
                })

        else: # .txt, .md, .csv, .json, etc.
            try:
                text = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                text = file_bytes.decode("latin-1", errors="ignore")
            
            text = text.strip()
            if text:
                results.append({
                    "text": text,
                    "page": 1,
                    "section": "Texto"
                })

        return results

    @staticmethod
    def chunk_text(
        text_blocks: List[Dict[str, Any]], 
        filename: str, 
        chunk_size: int = 600, 
        chunk_overlap: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Divide os blocos de texto em pedaços menores (chunks) com sobreposição para embeddings precisos.
        """
        chunks = []
        global_chunk_idx = 0

        for block in text_blocks:
            raw_text = block["text"]
            page = block.get("page", 1)
            section = block.get("section", "")

            # Divide o texto mantendo quebras de parágrafo quando possível
            words = raw_text.split()
            if not words:
                continue

            i = 0
            while i < len(words):
                chunk_words = words[i : i + chunk_size]
                chunk_str = " ".join(chunk_words)

                if len(chunk_str.strip()) > 20: # Ignora fragmentos insignificantes
                    chunks.append({
                        "id": f"{filename}_{global_chunk_idx}",
                        "filename": filename,
                        "chunk_index": global_chunk_idx,
                        "page": page,
                        "section": section,
                        "text": chunk_str,
                        "word_count": len(chunk_words)
                    })
                    global_chunk_idx += 1

                if i + chunk_size >= len(words):
                    break
                i += (chunk_size - chunk_overlap)

        return chunks
