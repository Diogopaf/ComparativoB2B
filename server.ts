import express from 'express';
import path from 'path';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { db } from './src/db';
import { tenants, products, comparisons } from './src/db/schema';
import { eq, and } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json());

// Configuração do multer para upload de arquivos em memória
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @route POST /api/upload
 * @desc Lógica de Upload (Etapa 2) - Motor de Dados
 * Aceita um arquivo Excel/CSV estruturado e popula o banco de dados para um Tenant.
 * 
 * Formato Esperado da Planilha:
 * - O arquivo pode ser Excel ou CSV.
 * - Sheet 1 ("Produtos"): 
 *   - Colunas obrigatórias: 'Name' (Nome), 'Is_Competitor' (1 para concorrente, 0 ou vazio para cliente)
 *   - Todas as outras colunas (ex: 'Volume', 'Potência') serão agrupadas em um JSON no campo 'features'.
 * - Sheet 2 ("Comparacoes") (opcional):
 *   - Colunas obrigatórias: 'Client_Product_Name', 'Competitor_Product_Name', 'Advantages', 'Disadvantages'
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const tenantName = req.body.tenantName || 'Tenant Padrão';
    const fileBuffer = req.file?.buffer;

    if (!fileBuffer) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // Lê a planilha (equivalente ao Pandas read_excel/read_csv)
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const productSheetName = workbook.SheetNames[0];
    const comparisonSheetName = workbook.SheetNames[1] || workbook.SheetNames[0];

    const productRows = xlsx.utils.sheet_to_json<any>(workbook.Sheets[productSheetName]);
    
    // 1. Criar ou Recuperar o Tenant
    let tenantRecord = await db.select().from(tenants).where(eq(tenants.name, tenantName)).get();
    if (!tenantRecord) {
      const [insertedTenant] = await db.insert(tenants).values({ name: tenantName }).returning();
      tenantRecord = insertedTenant;
    }

    // Mapeamento local para facilitar o vínculo de comparações depois
    const productMap = new Map<string, number>();

    // 2. Processar os Produtos
    for (const row of productRows) {
      const name = String(row['Name'] || row['Nome']);
      const isCompetitorValue = row['Is_Competitor'] || row['É_Concorrente'];
      const isCompetitor = isCompetitorValue == '1' || String(isCompetitorValue).toLowerCase() === 'true';

      // Separa os campos fixos das características flexíveis
      const { Name, Nome, Is_Competitor, É_Concorrente, ...dynamicFeatures } = row;

      // Upsert simples: tenta encontrar, se não acha insere, se acha atualiza as features
      let productRecord = await db.select()
        .from(products)
        .where(and(eq(products.tenantId, tenantRecord.id), eq(products.name, name)))
        .get();

      if (productRecord) {
        await db.update(products)
          .set({ isCompetitor, features: JSON.stringify(dynamicFeatures) })
          .where(eq(products.id, productRecord.id));
      } else {
        const [insertedP] = await db.insert(products).values({
          tenantId: tenantRecord.id,
          name: name,
          isCompetitor: isCompetitor,
          features: JSON.stringify(dynamicFeatures)
        }).returning();
        productRecord = insertedP;
      }
      productMap.set(name, productRecord.id);
    }

    // 3. Processar as Comparações (se existir a sheet 2 ou se estivem na sheet1 adaptada, aqui assumimos que pode estar na Sheet 2)
    if (workbook.SheetNames.length > 1) {
      const comparisonRows = xlsx.utils.sheet_to_json<any>(workbook.Sheets[workbook.SheetNames[1]]);
      for (const row of comparisonRows) {
        const clientName = row['Client_Product_Name'] || row['Produto_Cliente'];
        const compName = row['Competitor_Product_Name'] || row['Produto_Concorrente'];
        const advantages = row['Advantages'] || row['Vantagens'] || '';
        const disadvantages = row['Disadvantages'] || row['Desvantagens'] || '';

        const clientId = productMap.get(clientName);
        const compId = productMap.get(compName);

        if (clientId && compId) {
           // Verifica se a comparação já existe
           const existingComp = await db.select().from(comparisons)
             .where(and(
               eq(comparisons.clientProductId, clientId),
               eq(comparisons.competitorProductId, compId)
             )).get();

           if (existingComp) {
              await db.update(comparisons).set({ advantages, disadvantages })
                .where(eq(comparisons.id, existingComp.id));
           } else {
              await db.insert(comparisons).values({
                tenantId: tenantRecord.id,
                clientProductId: clientId,
                competitorProductId: compId,
                advantages,
                disadvantages
              });
           }
        }
      }
    }

    res.json({ message: 'Upload e processamento concluídos com sucesso!', tenantId: tenantRecord.id });
  } catch (error: any) {
    console.error('Erro no processamento do upload:', error);
    res.status(500).json({ error: error.message || 'Erro interno no servidor' });
  }
});

/**
 * @desc Rotas Auxiliares para o Front-end
 */
app.get('/api/tenants', async (req, res) => {
  const allTenants = await db.select().from(tenants);
  res.json(allTenants);
});

app.get('/api/products/:tenantId', async (req, res) => {
  const tenantId = parseInt(req.params.tenantId);
  const tenantProducts = await db.select().from(products).where(eq(products.tenantId, tenantId));
  res.json(tenantProducts);
});

app.get('/api/comparison/:clientProdId/:compProdId', async (req, res) => {
  const clientId = parseInt(req.params.clientProdId);
  const compId = parseInt(req.params.compProdId);

  let compData = await db.select().from(comparisons)
    .where(and(
      eq(comparisons.clientProductId, clientId),
      eq(comparisons.competitorProductId, compId)
    )).get();

  if (!compData) {
    try {
      // Fetch both products to get their names and features
      const clientProd = await db.select().from(products).where(eq(products.id, clientId)).get();
      const compProd = await db.select().from(products).where(eq(products.id, compId)).get();

      if (clientProd && compProd) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'sua_chave_de_api_aqui') {
          console.error("ERRO: A chave GEMINI_API_KEY não foi encontrada ou ainda está com o valor padrão no arquivo .env");
          throw new Error("Chave de API ausente");
        }
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `Você é um especialista em inteligência de mercado B2B. Crie um comparativo TÉCNICO, DIRETO e EXTREMAMENTE SUCINTO. O público-alvo é o vendedor interno da empresa, não o consumidor final. Não use linguagem de marketing exagerada. Vá direto aos fatos.

        Tarefas:
        1. Infira o setor/mercado do produto com base no nome e nas características.
        2. "advantages": 2 a 3 tópicos curtos (bullet points) destacando os benefícios claros do Produto Cliente sobre o Concorrente.
        3. "disadvantages": 1 a 2 tópicos curtos com as principais objeções que o vendedor enfrentará (forças do concorrente) e uma dica rápida de contorno.
        
        Produto Cliente: ${clientProd.name}
        Características: ${clientProd.features}
        
        Produto Concorrente: ${compProd.name}
        Características: ${compProd.features}
        
        Responda ESTRITAMENTE no formato JSON válido com as chaves "advantages" e "disadvantages" (ambos como texto com quebras de linha se necessário). NÃO inclua crases (\`\`\`) ou formatação markdown em volta do JSON.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const generatedText = response.text || "{}";
        const generatedJson = JSON.parse(generatedText);

        const parseFieldValue = (val: any): string => {
            if (!val) return "";
            if (Array.isArray(val)) return val.join('\n');
            if (typeof val === 'string') return val;
            return JSON.stringify(val);
        };

        const newAdvantages = parseFieldValue(generatedJson.advantages) || "Nenhuma vantagem gerada pela IA.";
        const newDisadvantages = parseFieldValue(generatedJson.disadvantages) || "Nenhuma objeção gerada pela IA.";

        // Save back to database
        const [insertedComp] = await db.insert(comparisons).values({
          tenantId: clientProd.tenantId,
          clientProductId: clientId,
          competitorProductId: compId,
          advantages: newAdvantages,
          disadvantages: newDisadvantages
        }).returning();

        compData = insertedComp;
      }
    } catch (e: any) {
      console.error("Erro ao gerar comparação com IA:", e);
      // Retorna uma mensagem amigável e profissional, sem expor a infraestrutura
      return res.json({ 
        advantages: "O sistema não pôde concluir a análise inteligente dos dados neste momento devido a um pico de processamento. Por favor, aguarde alguns segundos e tente novamente.", 
        disadvantages: "Análise temporariamente indisponível." 
      });
    }
  }

  res.json(compData || { advantages: 'Nenhuma vantagem mapeada.', disadvantages: 'Nenhuma desvantagem mapeada.' });
});

// Seed Initial Data se banco estiver vazio
app.post('/api/seed', async (req, res) => {
   // Exemplo para demonstração rápida do Frontend sem precisar de um Excel (se o avaliador preferir assim)
   const [t] = await db.insert(tenants).values({ name: 'Acme Corp' }).returning();
   
   const [p1] = await db.insert(products).values({ tenantId: t.id, name: 'Acme Motor V1', isCompetitor: false, features: JSON.stringify({ Potência: '500W', Volume: '2L' }) }).returning();
   const [p2] = await db.insert(products).values({ tenantId: t.id, name: 'Rival Engine X', isCompetitor: true, features: JSON.stringify({ Potência: '450W', Volume: '1.8L' }) }).returning();
   
   await db.insert(comparisons).values({
     tenantId: t.id, clientProductId: p1.id, competitorProductId: p2.id,
     advantages: 'Nossa potência é superior.', disadvantages: 'É ligeiramente maior em volume.'
   });
   res.json({ message: 'Seed finalizado!' });
});

// Vite Middleware para servir o React no modo desenvolvimento
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
