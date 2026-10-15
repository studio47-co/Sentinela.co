// ============================================================
// TEMA CLARO / ESCURO
// ============================================================
// - O tema inicial é definido por um script no <head> do index.html
//   (escolha salva → tema do sistema → escuro), antes da página pintar.
// - O botão alterna entre claro e escuro e guarda a escolha no navegador.
// - Enquanto o visitante não escolher, o site acompanha o tema do sistema
//   em tempo real (ex.: o celular muda para escuro à noite).
// ============================================================

(function () {
  const raiz  = document.documentElement;
  const botao = document.getElementById('temaBtn');
  const mqClaro = window.matchMedia('(prefers-color-scheme: light)');
  const metaCor = document.querySelector('meta[name="theme-color"]');
  const CHAVE = 'tema';

  const lerSalvo = () => {
    try {
      const v = localStorage.getItem(CHAVE);
      return v === 'claro' || v === 'escuro' ? v : null;
    } catch (_) { return null; }
  };
  const salvar = (v) => { try { localStorage.setItem(CHAVE, v); } catch (_) {} };
  const temaDoSistema = () => (mqClaro.matches ? 'claro' : 'escuro');

  function aplicar(tema, animar) {
    if (animar) {
      raiz.classList.add('tema-trocando');
      clearTimeout(aplicar.t);
      aplicar.t = setTimeout(() => raiz.classList.remove('tema-trocando'), 500);
    }
    raiz.setAttribute('data-tema', tema);

    if (metaCor) {
      metaCor.setAttribute('content', getComputedStyle(raiz).getPropertyValue('--fundo').trim() || '#2A2A2A');
    }
    if (botao) {
      const proximo = tema === 'escuro' ? 'claro' : 'escuro';
      botao.setAttribute('aria-label', `Mudar para o tema ${proximo}`);
      botao.setAttribute('title', `Mudar para o tema ${proximo}`);
    }
  }

  if (botao) {
    botao.addEventListener('click', () => {
      const novo = raiz.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro';
      salvar(novo);
      aplicar(novo, true);
    });
  }

  // Sem escolha salva, acompanha o sistema
  const aoMudarSistema = () => { if (!lerSalvo()) aplicar(temaDoSistema(), true); };
  if (mqClaro.addEventListener) mqClaro.addEventListener('change', aoMudarSistema);
  else if (mqClaro.addListener) mqClaro.addListener(aoMudarSistema);

  // Mantém várias abas sincronizadas
  window.addEventListener('storage', (e) => {
    if (e.key === CHAVE) aplicar(lerSalvo() || temaDoSistema(), true);
  });

  aplicar(raiz.getAttribute('data-tema') || temaDoSistema(), false);
})();
