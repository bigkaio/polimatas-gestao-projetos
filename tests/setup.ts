import { config } from "dotenv";
config();

// A suíte fecha vendas de verdade contra o banco: sem isto o `.env` de quem
// desenvolve mandaria WhatsApp real a cada execução. Os testes que exercitam
// o envio configuram as variáveis por conta própria e simulam o `fetch`.
// Vazio, e não apagado: o dotenv só preenche chave ausente, e outros módulos
// carregam o `.env` de novo.
process.env.EVOLUTION_API_URL = "";
process.env.EVOLUTION_API_KEY = "";
process.env.EVOLUTION_INSTANCE = "";
