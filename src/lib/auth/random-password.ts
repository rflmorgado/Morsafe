import { randomBytes } from "crypto";

/**
 * Gera uma senha aleatória só pra satisfazer a exigência técnica do
 * Supabase Auth (toda conta criada via `auth.admin.createUser` precisa de
 * uma senha) — ela nunca é mostrada nem repassada a ninguém, nem fica
 * guardada em lugar nenhum além do Supabase Auth. A pessoa define a própria
 * senha pelo e-mail de "definir senha" enviado logo em seguida (mesmo link
 * de recuperação já usado em "Esqueci minha senha" — ver
 * src/app/login/actions.ts e /redefinir-senha).
 *
 * Criado em 16/10/2026: antes, tanto /setup-empresa (criarEmpresa) quanto
 * "+ Novo usuário" (criarUsuario, em usuarios/actions.ts) exigiam que quem
 * estava cadastrando digitasse a senha da outra pessoa no formulário e
 * repassasse por fora (WhatsApp, e-mail manual etc.) — a pessoa que cadastra
 * ficava sabendo a senha real de acesso de quem for usar o login, e essa
 * senha trafegava em texto puro em algum canal que não é seguro pra isso.
 *
 * 32 caracteres em base64url a partir de 24 bytes aleatórios — bem acima do
 * mínimo de 8 exigido de uma senha normal no sistema, sem nenhuma
 * preocupação de ser pronunciável ou fácil de digitar, já que ninguém vai
 * digitar isso.
 */
export function gerarSenhaAleatoria(): string {
  return randomBytes(24).toString("base64url");
}
