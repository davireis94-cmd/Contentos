import mammoth from "mammoth";
import path from "path";

const base = "C:\\Users\\55219\\OneDrive\\Desktop\\@davimoxoto";

const [ec, iv] = await Promise.all([
  mammoth.extractRawText({ path: path.join(base, "Davi Moxoto Estrategia Comunicacao.docx") }),
  mammoth.extractRawText({ path: path.join(base, "Davi Moxoto Identidade Visual.docx") }),
]);

console.log("=== ESTRATEGIA DE COMUNICACAO ===");
console.log(ec.value);
console.log("\n=== IDENTIDADE VISUAL ===");
console.log(iv.value);
