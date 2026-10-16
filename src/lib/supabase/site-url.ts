import { headers } from "next/headers";

/**
 * Descobre a URL base do site a partir dos headers da requisição, pra
 * montar links absolutos pro próprio site (redirecionamento de e-mail,
 * principalmente) sem precisar de uma variável de ambiente fixa — funciona
 * em preview, produção ou qualquer domínio.
 *
 * Extraído de login/actions.ts (recuperação de senha) em 16/10/2026 pra ser
 * compartilhado também por setup-empresa/actions.ts e usuarios/actions.ts,
 * que agora enviam o mesmo tipo de e-mail (link de "definir senha") ao
 * criar um usuário novo — ver auditoria de senha aleatória + e-mail de
 * definição de senha, 16/10/2026.
 */
export async function getSiteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
