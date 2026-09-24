import { randomBytes } from "crypto";

// Validade do código de pareamento mostrado no QR — curto o bastante pra
// não sobrar tempo de alguém tentar reaproveitá-lo depois, longo o
// bastante pra dar tempo de abrir a câmera do aparelho e escanear. Usado
// tanto ao criar uma estação quanto ao gerar um novo código pra ela (ver
// src/app/(app)/estacoes/actions.ts).
export const VALIDADE_CODIGO_MINUTOS = 5;

/**
 * 8 caracteres em base36 maiúsculo (dígitos + letras) — dá pra digitar à
 * mão se a leitura do QR falhar, e combinado com a validade curta acima é
 * impraticável de adivinhar por tentativa.
 */
export function gerarCodigoPareamento(): string {
  return randomBytes(6).toString("hex").toUpperCase().slice(0, 8);
}

export function calcularExpiracaoCodigo(): string {
  return new Date(Date.now() + VALIDADE_CODIGO_MINUTOS * 60_000).toISOString();
}

/**
 * Segredo permanente do aparelho pareado (guardado no localStorage do
 * tablet/celular da empresa) — bem mais longo que o código de pareamento
 * porque este não expira sozinho, só quando o admin revoga (gerando um
 * novo código de pareamento ou desativando a estação — ver
 * src/app/(app)/estacoes/actions.ts).
 */
export function gerarTokenEstacao(): string {
  return randomBytes(32).toString("hex");
}
