# B2B Product Comparison Engine 🚀

Uma plataforma SaaS inteligente voltada para consultores e equipes de vendas B2B, permitindo a comparação rápida e dinâmica entre produtos da sua empresa e os da concorrência. 

O diferencial da plataforma é o seu **Motor de Inteligência Artificial**, que gera automaticamente argumentos de vendas e contornos de objeções caso não haja um comparativo previamente mapeado.

## 🌟 Principais Funcionalidades

*   **Upload de Catálogos via Excel/CSV:** Suba listas de produtos e concorrentes de forma massiva com facilidade. Qualquer coluna nova na planilha (como Peso, Preço, Dimensões) é automaticamente absorvida pelo sistema como característica dinâmica.
*   **Filtro Inteligente de Categoria:** O sistema cruza "banana com banana". Ao selecionar um produto da categoria "Smartphones", o dropdown de concorrentes exibe apenas aparelhos da mesma categoria.
*   **Geração de Argumentos via IA:** Integração nativa com a API do **Google Gemini**. Quando uma comparação manual não existe, a IA entra em ação para analisar as características técnicas dos dois produtos e gerar argumentos persuasivos e técnicos voltados para a equipe B2B.
*   **Design Premium:** Interface moderna construída com React e TailwindCSS, pensada na usabilidade rápida de um vendedor em campo.

## 🛠️ Tecnologias Utilizadas

**Frontend:**
*   React 19 + TypeScript
*   Vite (Build Tool)
*   TailwindCSS (Estilização)
*   Lucide React (Ícones)

**Backend & Banco de Dados:**
*   Node.js com Express
*   SQLite (Banco de dados local rápido e eficiente)
*   Drizzle ORM (Mapeamento relacional inteligente)
*   Multer & SheetJS (Processamento de uploads de Excel)
*   SDK do Google GenAI (`@google/genai`)

## ⚙️ Como Executar Localmente

### 1. Pré-requisitos
Certifique-se de ter o [Node.js](https://nodejs.org/) instalado na sua máquina (versão 20+ recomendada).

### 2. Instalação
Clone o repositório e instale as dependências:
```bash
npm install
```

### 3. Configuração do Ambiente (.env)
Crie um arquivo `.env` na raiz do projeto (use o `.env.example` como base) e insira sua chave da API do Google Gemini:
```env
PORT=3000
GEMINI_API_KEY=sua_chave_de_api_aqui
```

### 4. Configuração do Banco de Dados
A aplicação utiliza SQLite. Para criar o arquivo do banco de dados e aplicar as tabelas necessárias, rode:
```bash
npm run db:push
```

### 5. Iniciando o Servidor
Para iniciar simultaneamente o backend e o frontend em modo de desenvolvimento:
```bash
npm run dev
```
Acesse `http://localhost:3000` no seu navegador.

## 📂 Como testar (Funcionalidade Admin)
Se não quiser subir uma planilha Excel de imediato, você pode popular o banco de dados com dados fictícios usando o botão na barra superior do sistema ou fazendo uma requisição POST na rota `/api/seed`.

---
*Desenvolvido como um motor de inteligência competitiva para vendas.*
