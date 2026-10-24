import os
import json
import numpy as np
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Carrega variáveis de ambiente procurando no mesmo diretório do arquivo
current_dir = os.path.dirname(os.path.abspath(__file__))
env_file = os.path.join(current_dir, ".env")
env_example = os.path.join(current_dir, ".env.example")

if os.path.exists(env_file):
    load_dotenv(dotenv_path=env_file)
elif os.path.exists(env_example):
    load_dotenv(dotenv_path=env_example)
else:
    load_dotenv()

class RAGEngine:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        self.meta_file = os.path.join(self.data_dir, "chunks_metadata.json")
        self.emb_file = os.path.join(self.data_dir, "embeddings.npy")
        
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        self.client = None
        self.chunks: List[Dict[str, Any]] = []
        self.embeddings: Optional[np.ndarray] = None
        
        self._init_client()
        self._load_store()

    def set_api_key(self, api_key: str):
        self.api_key = api_key.strip()
        os.environ["GEMINI_API_KEY"] = self.api_key
        # Salva no arquivo .env
        with open(".env", "w", encoding="utf-8") as f:
            f.write(f"GEMINI_API_KEY={self.api_key}\n")
        self._init_client()

    def _init_client(self):
        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                print(f"[RAGEngine] Erro ao inicializar cliente Gemini: {e}")
                self.client = None
        else:
            self.client = None

    def is_configured(self) -> bool:
        return bool(self.api_key and self.client)

    def _load_store(self):
        if os.path.exists(self.meta_file) and os.path.exists(self.emb_file):
            try:
                with open(self.meta_file, "r", encoding="utf-8") as f:
                    self.chunks = json.load(f)
                self.embeddings = np.load(self.emb_file)
                print(f"[RAGEngine] Carregados {len(self.chunks)} chunks do armazenamento.")
            except Exception as e:
                print(f"[RAGEngine] Erro ao carregar vetores salvos: {e}")
                self.chunks = []
                self.embeddings = None
        else:
            self.chunks = []
            self.embeddings = None

    def _save_store(self):
        try:
            with open(self.meta_file, "w", encoding="utf-8") as f:
                json.dump(self.chunks, f, ensure_ascii=False, indent=2)
            if self.embeddings is not None and len(self.embeddings) > 0:
                np.save(self.emb_file, self.embeddings)
            elif os.path.exists(self.emb_file):
                os.remove(self.emb_file)
        except Exception as e:
            print(f"[RAGEngine] Erro ao salvar vetores: {e}")

    def get_embedding(self, text: str) -> List[float]:
        """Gera o embedding vetorial para um texto usando text-embedding-004 do Gemini"""
        if not self.is_configured():
            raise ValueError("GEMINI_API_KEY não configurada. Configure na interface.")
        
        response = self.client.models.embed_content(
            model="text-embedding-004",
            contents=text,
        )
        return response.embeddings[0].values

    def add_chunks(self, new_chunks: List[Dict[str, Any]]) -> int:
        """Gera embeddings para os novos chunks e adiciona à base vetorial persistente"""
        if not new_chunks:
            return 0
        if not self.is_configured():
            raise ValueError("Chave de API do Gemini não configurada.")

        new_embeddings = []
        for idx, chunk in enumerate(new_chunks):
            emb = self.get_embedding(chunk["text"])
            new_embeddings.append(emb)

        new_emb_array = np.array(new_embeddings, dtype=np.float32)

        if self.embeddings is None or len(self.embeddings) == 0:
            self.embeddings = new_emb_array
            self.chunks = new_chunks
        else:
            self.embeddings = np.vstack([self.embeddings, new_emb_array])
            self.chunks.extend(new_chunks)

        self._save_store()
        return len(new_chunks)

    def search_similar(self, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
        """Busca os chunks semanticamente mais semelhantes à query"""
        if self.embeddings is None or len(self.embeddings) == 0 or len(self.chunks) == 0:
            return []

        query_emb = np.array(self.get_embedding(query), dtype=np.float32)

        # Cálculo de similaridade de cosseno
        matrix_norm = np.linalg.norm(self.embeddings, axis=1)
        query_norm = np.linalg.norm(query_emb)
        
        # Evita divisão por zero
        denom = matrix_norm * query_norm
        denom[denom == 0] = 1e-10

        cosine_sim = np.dot(self.embeddings, query_emb) / denom

        # Top K índices
        top_k = min(top_k, len(self.chunks))
        top_indices = np.argsort(cosine_sim)[::-1][:top_k]

        results = []
        for idx in top_indices:
            score = float(cosine_sim[idx])
            chunk_data = dict(self.chunks[idx])
            chunk_data["similarity"] = round(score, 4)
            chunk_data["score_pct"] = max(0, min(100, int(score * 100)))
            results.append(chunk_data)

        return results

    def query_agent(self, question: str, top_k: int = 4) -> Dict[str, Any]:
        """
        Executa a pipeline completa:
        1. Busca chunks relevantes nos documentos locais (RAG)
        2. Executa busca na internet em tempo real via Google Search Grounding
        3. Invoca o Gemini com síntese estruturada e links clicáveis
        """
        if not self.is_configured():
            raise ValueError("GEMINI_API_KEY não configurada.")

        # 1. Recuperação RAG nos documentos locais
        retrieved_sources = self.search_similar(question, top_k=top_k)

        context_texts = []
        for i, source in enumerate(retrieved_sources, 1):
            src_info = f"[DOCUMENTO LOCAL {i}] Arquivo: {source['filename']} | {source.get('section', '')}"
            context_texts.append(f"{src_info}\nConteúdo: {source['text']}")

        has_context = len(context_texts) > 0
        context_str = "\n\n---\n\n".join(context_texts) if has_context else "Nenhum documento interno carregado ou relevante para esta consulta."

        # 2. System Prompt refinado para RAG + Busca Web em Tempo Real
        system_instruction = (
            "Você é o NEXUS AI, um assistente inteligente de conhecimento avançado equipado com busca interna em documentos (RAG) "
            "e navegação/busca na internet em tempo real via Google.\n\n"
            "DIRETRIZES DE RESPOSTA:\n"
            "1. DOCUMENTOS LOCAIS: Se o CONTEXTO DOS DOCUMENTOS (RAG) contiver a resposta para a pergunta, priorize essas informações "
            "e cite as fontes no formato: `[Fonte: nome_do_arquivo, Página X]`.\n"
            "2. PESQUISA NA INTERNET (WEB): Se a pergunta NÃO estiver nos documentos locais, ou se for sobre temas gerais, fatos recentes, "
            "notícias, ferramentas, documentações, sites, tutoriais ou empresas, utilize a busca na internet para trazer a resposta mais atualizada, detalhada e precisa.\n"
            "3. LINKS CLICÁVEIS E DIRECIONADOS: Sempre que mencionar sites, plataformas, documentações, portais de notícias ou referências, "
            "crie links Markdown explícitos e clicáveis (por exemplo: [Google](https://www.google.com), [GitHub](https://github.com), [Nome da Notícia](https://...)). "
            "Certifique-se de que o usuário possa clicar diretamente no link para ser direcionado à página.\n"
            "4. FORMATO: Responda em Português do Brasil de forma clara, agradável e bem estruturada com títulos, listas e negrito quando aplicável."
        )

        user_prompt = (
            f"=== CONTEXTO DOS DOCUMENTOS INTERNOS (RAG) ===\n"
            f"{context_str}\n\n"
            f"=== PERGUNTA DO USUÁRIO ===\n"
            f"{question}"
        )

        from google.genai import types

        # Configura as ferramentas incluindo Google Search ao vivo
        search_tool = types.Tool(google_search=types.GoogleSearch())
        gen_config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=[search_tool],
            temperature=0.3,
        )

        model_name = "gemini-2.5-flash"
        response = None
        try:
            response = self.client.models.generate_content(
                model=model_name,
                contents=user_prompt,
                config=gen_config
            )
            answer_text = response.text
        except Exception as e:
            # Fallback para gemini-1.5-flash se gemini-2.5-flash oscilar
            try:
                response = self.client.models.generate_content(
                    model="gemini-1.5-flash",
                    contents=user_prompt,
                    config=gen_config
                )
                answer_text = response.text
            except Exception as e2:
                # Fallback sem ferramenta caso a conta não tenha permissão de search em algum endpoint
                try:
                    fallback_config = types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.3,
                    )
                    response = self.client.models.generate_content(
                        model="gemini-1.5-flash",
                        contents=user_prompt,
                        config=fallback_config
                    )
                    answer_text = response.text
                except Exception as e3:
                    raise RuntimeError(f"Erro ao gerar resposta com o Gemini: {e3}")

        # Extrai links e fontes web do Grounding do Google Search
        web_sources = []
        if response and response.candidates:
            cand = response.candidates[0]
            if hasattr(cand, "grounding_metadata") and cand.grounding_metadata:
                gm = cand.grounding_metadata
                if hasattr(gm, "grounding_chunks") and gm.grounding_chunks:
                    for chunk in gm.grounding_chunks:
                        if hasattr(chunk, "web") and chunk.web:
                            title = chunk.web.title or "Fonte da Web"
                            uri = chunk.web.uri
                            if uri and not any(s["url"] == uri for s in web_sources):
                                web_sources.append({"title": title, "url": uri})

        return {
            "answer": answer_text,
            "sources": retrieved_sources,
            "web_sources": web_sources,
            "total_sources_found": len(retrieved_sources),
            "question": question
        }

    def list_documents(self) -> List[Dict[str, Any]]:
        """Agrupa os chunks por arquivo para listar documentos indexados"""
        docs_map: Dict[str, Dict[str, Any]] = {}
        for chunk in self.chunks:
            fname = chunk["filename"]
            if fname not in docs_map:
                docs_map[fname] = {
                    "filename": fname,
                    "chunks_count": 0,
                    "total_words": 0,
                    "pages": set()
                }
            docs_map[fname]["chunks_count"] += 1
            docs_map[fname]["total_words"] += chunk.get("word_count", 0)
            if chunk.get("page"):
                docs_map[fname]["pages"].add(chunk["page"])

        result = []
        for doc in docs_map.values():
            result.append({
                "filename": doc["filename"],
                "chunks_count": doc["chunks_count"],
                "total_words": doc["total_words"],
                "pages_count": len(doc["pages"]) if doc["pages"] else 1
            })
        return result

    def delete_document(self, filename: str) -> bool:
        """Remove todos os chunks e embeddings associados a um arquivo"""
        if not self.chunks or self.embeddings is None:
            return False

        indices_to_keep = [i for i, c in enumerate(self.chunks) if c["filename"] != filename]
        
        if len(indices_to_keep) == len(self.chunks):
            return False # Arquivo não encontrado

        self.chunks = [self.chunks[i] for i in indices_to_keep]
        if indices_to_keep:
            self.embeddings = self.embeddings[indices_to_keep]
        else:
            self.embeddings = None

        self._save_store()
        return True

    def clear_all(self):
        """Limpa toda a base de conhecimento"""
        self.chunks = []
        self.embeddings = None
        self._save_store()
