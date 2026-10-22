# Laboratório das Loterias

App web para gerar combinações das loterias da Caixa (Mega-Sena, Lotofácil, Quina, Lotomania, Timemania, Dupla Sena,
Dia de Sorte, +Milionária e Super Sete), com probabilidades exatas e testes estatísticos sobre o histórico oficial.

- **Grátis**: 1 combinação por modalidade a cada semana.
- **Assinatura**: R$ 7,99/mês ou R$ 59/ano. Combinações ilimitadas, até 10 jogos por vez, apostas com mais números e todos os testes.
- Login com e-mail e senha ou Google. Pagamento recorrente pelo Mercado Pago.
- Resultados atualizados automaticamente após cada sorteio.

Nenhum método aumenta a chance de acerto: os testes do próprio app mostram isso. O filtro de padrões populares só reduz o risco de dividir o prêmio.

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `web/` | Site estático publicado no GitHub Pages (HTML/CSS/JS, PWA, Termos e Privacidade) |
| `web/data/` | Histórico de todos os concursos (atualizado pelo robô) |
| `supabase/` | Banco (migrations) e Edge Functions: `gerar`, `assinar`, `cancelar`, `mp-webhook` |
| `scripts/` | Atualização dos resultados e build do preview |
| `testes/` | Testes do sorteio, limites dos planos e webhook |

Passo a passo para colocar no ar: [docs/PUBLICAR.md](docs/PUBLICAR.md).
