// ============================================================
// VÍDEO DE FUNDO DO HERO
// ============================================================
// Os <video> ficam escondidos e cada frame é desenhado em um <canvas>.
//
// Desktop: dois vídeos alternam com crossfade (efeito de loop contínuo).
// Mobile : um único vídeo com `loop` nativo. Usa metade da banda e só um
//          decodificador de vídeo, que é o que os celulares aguentam bem.
//
// Proteções contra o vídeo "congelar" (principalmente no mobile):
//   - retoma o vídeo quando o navegador o pausa (trocar de app, bloquear tela)
//   - tenta de novo no primeiro toque se o autoplay foi bloqueado
//   - se o 2º vídeo não estiver pronto na hora da troca, só reinicia o atual
//   - vigia (watchdog) travamentos e chama play() de novo
//   - pausa tudo quando o hero sai da tela (economiza bateria)
// ============================================================

const videoA   = document.getElementById('videoA');
const videoB   = document.getElementById('videoB');
const canvas   = document.getElementById('bgCanvas');
const ctx      = canvas.getContext('2d');
const hero     = document.querySelector('.hero');
const fallback = document.querySelector('.bg-fallback');

// ----- Configuração -----
const CROSSFADE_MS      = 1200;  // duração do crossfade (desktop)
const MAX_DPR           = 2;     // limita a resolução do canvas (celulares chegam a 3x)
const WATCHDOG_MS       = 1500;  // intervalo da checagem de travamento
const READY_STATE_READY = 3;     // HAVE_FUTURE_DATA: dá pra tocar sem engasgar

// Mobile = tela pequena ou toque como entrada principal
const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
const useCrossfade = !isMobile;

// ----- Estado -----
let activeVideo    = videoA;
let inactiveVideo  = videoB;
let crossfading    = false;   // crossfade em andamento
let startingFade   = false;   // aguardando o play() do próximo vídeo
let crossfadeStart = 0;
let rafId          = null;
let heroVisible    = true;

// Estado do watchdog
let lastTime       = -1;


// ============================================================
// CANVAS
// ============================================================

// Só redimensiona se o tamanho mudou de verdade. No mobile a barra de endereço
// dispara "resize" durante o scroll; redimensionar limpa o canvas e causa flicker.
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const w = Math.round(canvas.offsetWidth  * dpr);
  const h = Math.round(canvas.offsetHeight * dpr);
  if (canvas.width === w && canvas.height === h) return;
  canvas.width  = w;
  canvas.height = h;
}

// Desenha um frame com o equivalente a "object-fit: cover"
function drawCover(video, alpha) {
  if (video.readyState < 2) return; // sem dados suficientes ainda

  const cw = canvas.width;
  const ch = canvas.height;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;

  ctx.globalAlpha = alpha;
  ctx.drawImage(video, dx, dy, dw, dh);
}


// ============================================================
// REPRODUÇÃO
// ============================================================

// Garante que o vídeo ativo está tocando. Seguro de chamar várias vezes.
function ensurePlaying() {
  if (document.hidden || !heroVisible) return;
  if (!activeVideo.paused && !activeVideo.ended) return;

  activeVideo.play()
    .then(() => { fallback.style.opacity = '0'; })
    .catch(() => { fallback.style.opacity = '1'; }); // autoplay bloqueado
}

// Reinicia o vídeo ativo do começo (usado quando o crossfade não é possível)
function restartActive() {
  startingFade = false;
  activeVideo.currentTime = 0;
  ensurePlaying();
}

// Se o autoplay for bloqueado (ex.: modo de economia de bateria no iOS),
// o primeiro toque do usuário libera a reprodução.
function retryOnFirstGesture() {
  const events = ['touchend', 'click', 'keydown'];
  const handler = () => {
    events.forEach((e) => window.removeEventListener(e, handler));
    ensurePlaying();
  };
  events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
}

// Detecta vídeo travado: deveria estar tocando, mas o tempo não anda.
function watchdog() {
  if (document.hidden || !heroVisible) { lastTime = -1; return; }

  const stuck = !activeVideo.paused && activeVideo.currentTime === lastTime;
  lastTime = activeVideo.currentTime;

  if (activeVideo.paused || activeVideo.ended || stuck) {
    ensurePlaying();
  }
}


// ============================================================
// CROSSFADE (desktop)
// ============================================================

function startCrossfade() {
  if (crossfading || startingFade) return;

  // O 2º vídeo ainda não carregou: não dá pra fazer a troca sem ficar em branco.
  // Em vez de congelar, apenas reinicia o vídeo atual.
  if (inactiveVideo.readyState < READY_STATE_READY) {
    restartActive();
    return;
  }

  startingFade = true;
  inactiveVideo.currentTime = 0;
  inactiveVideo.play()
    .then(() => {
      startingFade   = false;
      crossfading    = true;
      crossfadeStart = performance.now();
    })
    .catch(() => {
      // Navegador recusou o play() do 2º vídeo: segue com o atual
      restartActive();
    });
}

function finishCrossfade() {
  crossfading = false;
  const outgoing = activeVideo;
  [activeVideo, inactiveVideo] = [inactiveVideo, activeVideo];
  outgoing.pause();
  outgoing.currentTime = 0;
}

// Dispara o crossfade quando o vídeo ativo está perto do fim
function checkNearEnd() {
  if (!useCrossfade || crossfading || startingFade) return;

  const { duration, currentTime, ended } = activeVideo;
  if (!duration) return;

  if (ended || duration - currentTime <= CROSSFADE_MS / 1000) {
    startCrossfade();
  }
}


// ============================================================
// LOOP DE RENDERIZAÇÃO
// ============================================================

function renderLoop(timestamp) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (crossfading) {
    const t = Math.min((timestamp - crossfadeStart) / CROSSFADE_MS, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easing suave

    drawCover(activeVideo,   1 - ease);
    drawCover(inactiveVideo, ease);

    if (t >= 1) finishCrossfade();
  } else {
    drawCover(activeVideo, 1);
    checkNearEnd();
  }

  rafId = requestAnimationFrame(renderLoop);
}

function startRender() {
  if (!rafId) rafId = requestAnimationFrame(renderLoop);
}

function stopRender() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}


// ============================================================
// ECONOMIA DE RECURSOS: pausa quando não está visível
// ============================================================

function onVisibilityChange() {
  if (document.hidden) {
    stopRender();
  } else {
    startRender();
    ensurePlaying(); // o navegador costuma pausar o vídeo em segundo plano
  }
}

function observeHero() {
  if (!('IntersectionObserver' in window)) return;

  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    if (heroVisible) {
      startRender();
      ensurePlaying();
    } else {
      stopRender();
      activeVideo.pause();
      if (crossfading) finishCrossfade();
    }
  }, { threshold: 0.01 }).observe(hero);
}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

function silenceMediaSession() {
  // Impede o navegador de tratar o fundo como mídia controlável
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
    ['play', 'pause', 'stop', 'seekbackward', 'seekforward',
     'previoustrack', 'nexttrack', 'enterpictureinpicture'
    ].forEach((a) => { try { navigator.mediaSession.setActionHandler(a, null); } catch (_) {} });
  } catch (_) {}
}

function init() {
  silenceMediaSession();

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);

  // Mobile: loop nativo em um único vídeo (o videoB nunca é baixado)
  if (!useCrossfade) videoA.loop = true;

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pageshow', ensurePlaying); // volta do cache (botão voltar)
  observeHero();

  activeVideo.play()
    .then(() => {
      fallback.style.opacity = '0';
      startRender();

      // Só agora começa a baixar o videoB (preload="none" no HTML), para não
      // concorrer com o videoA pela banda. No mobile ele nem é usado.
      if (useCrossfade) inactiveVideo.load();
    })
    .catch(() => {
      fallback.style.opacity = '1'; // autoplay bloqueado → mostra o poster
      startRender();
      retryOnFirstGesture();
    });

  setInterval(watchdog, WATCHDOG_MS);
}

document.addEventListener('DOMContentLoaded', init);
