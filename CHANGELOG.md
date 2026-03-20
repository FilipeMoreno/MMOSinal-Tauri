# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.3.6] - 2026-03-20

### Corrigido
- **Badge de atualização na sidebar e rodapé** — após o redesign, o indicador de nova versão havia parado de aparecer. Corrigido centralizando o `useUpdater` exclusivamente no `Layout.tsx` (fonte única de verdade); a instância duplicada em `App.tsx` foi removida.
- **Padrão de atualização automática alterado para desativado** — o comportamento padrão ao encontrar uma atualização é agora exibir o dialog de confirmação, em vez de instalar silenciosamente. A atualização silenciosa pode ser ativada em Configurações > Sistema.

---

## [1.3.5] - 2026-03-20

### Adicionado
- **Atualização automática** — nova opção nas Configurações (Sistema). Quando ativada (padrão), o app verifica e instala atualizações silenciosamente ao iniciar, sem exibir dialog de confirmação. Quando desativada, mantém o comportamento anterior (dialog com botão "Instalar e reiniciar").

---

## [1.3.4] - 2026-03-20

### Corrigido
- **CI: erro de encoding ao gerar `latest.json`** — caracteres Unicode fora do cp1252 (ex: `≈`) no CHANGELOG causavam `UnicodeEncodeError` no `print()` do script Python no Windows. Corrigido escrevendo diretamente em `sys.stdout.buffer` com UTF-8.

### Adicionado
- **Controle de volume interativo** — ao clicar no indicador de volume em qualquer player (card principal, card de Sinal Manual, mini player), um popover com slider vertical é exibido, permitindo ajuste em tempo real. Inclui botão de mudo/desmudo e label com percentual.
- **Controles de transporte no card de Sinal Manual** — adicionados botões ⏮ (anterior), ⏯ (pausar/retomar), ⏭ (próximo) e ⏹ (parar) durante reprodução manual.
- **Drag-and-drop na fila de reprodução** — reordenação por arraste disponível tanto no diálogo de acionamento de sinal quanto na fila do card de Sinal Manual.
- **Sidebar de fila no diálogo de sinal manual** — a lista de reprodução foi movida para uma sidebar lateral direita (em vez de ficar na barra inferior do diálogo), com largura fixa e suporte a DnD.
- **Pause/retomar player** — novo comando `pause_player` no backend (Rust) utilizando `Sink::pause()` / `Sink::play()` do Rodio; estado `Paused` já existia no `audio_state.rs`.

### Alterado
- **Diálogo de sinal manual** ampliado para `max-w-3xl` para acomodar a sidebar de fila.
- **Ícones de mover/excluir na fila do card** agora aparecem apenas no hover, reduzindo poluição visual.
- **Botão "+ Pasta"** no modo de adição à fila ativa agora deduplicar itens já presentes antes de anexar.
- **Contagem de arquivos por pasta** carregada ao abrir o diálogo (e não somente ao clicar na pasta).
- **Volume padrão nas Configurações** atualizado em tempo real quando o controle de volume é ajustado em qualquer player (via evento `app:default-volume-changed`).

### Corrigido
- **Botão "Tocar fila"** não iniciava reprodução ao montar uma nova fila — chamava `onReplaceRemainingQueue` em vez de `onPlayQueue`.
- **Fila do card de Sinal Manual** não exibia as músicas selecionadas no diálogo (`displayQueue` apontava para a fila errada no modo de nova fila).
- **Mini player aparecia mesmo com a opção desativada nas Configurações** — o `setTimeout` de 150 ms do handler de blur podia disparar após a limpeza do `useEffect`. Corrigido com `useRef` para o estado atual da flag e cancelamento do timer tanto no cleanup quanto no handler de focus.
- **Mini player duplicava (duas janelas)** — race condition TOCTOU: duas chamadas concorrentes de `show_mini_window` passavam pela verificação `get_webview_window("mini")` antes de qualquer uma criar a janela. Corrigido com `static MINI_CREATION_LOCK: Mutex<()>` e `try_lock()` com double-checked locking no Rust.
- **Clique em item da fila para pular** parou de funcionar após adição do DnD — handler `onClick` re-adicionado ao elemento de nome separado do grip de arraste.

### Técnico (Rust)
- Novo método `PlayerEngine::set_volume()` atualiza o `Sink` e emite `player-state-changed`.
- Novo método `PlayerEngine::pause_or_resume()` alterna entre `Playing` e `Paused`.
- Loop principal do player ignora ticks de posição enquanto o sink estiver pausado.
- `static MINI_CREATION_LOCK: Mutex<()>` em `commands/window.rs` previne criação duplicada do mini player.
- Novos comandos Tauri registrados: `set_volume`, `save_default_volume`, `pause_player`.

---

## [1.3.3] - 2026-03-20

### Adicionado
- **Menu de contexto por arquivo na Biblioteca** — clique com botão direito em uma música agora inclui a ação **"Analisar silêncio"** para análise individual.
- **Menu de contexto na sidebar de pastas** — clique com botão direito na lista de pastas agora abre ações rápidas:
  - **Criar pasta**
  - **Editar**
  - **Excluir**
- **Feedback visual de arraste** — adicionada prévia flutuante **"Movendo arquivo"** enquanto o usuário arrasta um item da lista.

### Alterado
- **Toolbar da Biblioteca** — controles do topo foram compactados para manter o mesmo porte visual de **"Em ordem/Aleatório"**.
- **Ações de silêncio e badge** — opções foram consolidadas em um único dropdown **"Ações"** (substituindo múltiplos botões).
- **Exibição da badge de silêncio** — ao ocultar texto, a badge continua visível em modo compacto (somente ícone), facilitando leitura da linha sem perder o status.
- **Rótulo da ação de badge** — opção atualizada para **"Ocultar/Mostrar texto da badge"** para deixar o comportamento explícito.

### Corrigido
- **Drag-and-drop de arquivos na Biblioteca (Tauri/WebView)**:
  - Corrigido o estado que exibia cursor de bloqueio ao iniciar arraste.
  - Reordenação dentro da pasta voltou a funcionar de forma consistente.
  - Movimento entre pastas voltou a permitir soltar no destino corretamente.
- **Highlight de drop na sidebar** — durante arraste, apenas a pasta alvo é destacada (evita a lateral toda azul).
- **Renomeação de pasta** — ao editar nome de pasta, a linha agora mostra corretamente botões **Salvar/Cancelar** (em vez dos botões padrão de edição/exclusão).

---

## [1.3.2] - 2026-03-20

### Adicionado
- **Detecção e skip de silêncio** — arquivos de áudio com silêncio no início e/ou final são analisados automaticamente e tratados de forma inteligente durante a reprodução:
  - **Análise automática na importação** — ao importar um arquivo, o sistema analisa o silêncio inicial e final usando RMS por janelas de 50 ms. Silêncio mínimo de 1,5 s (limiar RMS < 0,01 ≈ −40 dB) é necessário para detecção.
  - **Botão "Analisar Silêncio"** na Biblioteca — processa todos os arquivos de uma pasta, exibindo o progresso arquivo por arquivo em tempo real. O estado de análise persiste na navegação entre páginas.
  - **Skip automático do silêncio inicial** — se um arquivo possui silêncio detectado no início e está sendo reproduzido do zero, o player salta diretamente para o início do conteúdo real.
  - **Parada antecipada no silêncio final** — durante a reprodução, quando a posição atinge `content_end_ms`, o player para o sink e encadeia automaticamente o próximo arquivo (como se fosse um fim natural).
  - **Seleção inteligente de arquivo** — `next_file_for_folder` trata arquivos com posição salva ≥ `content_end_ms` como "concluídos", evitando que o sistema retome um arquivo parado no trecho de silêncio final.
  - **Badges por arquivo** na Biblioteca:
    - Cinza "Não analisado" — arquivo ainda não foi analisado
    - Verde "✓ Sem silêncio" — analisado, nenhum silêncio significativo detectado
    - Âmbar "~silêncio (+X.Xs / −Y.Ys)" — silêncio detectado, com duração em segundos
    - Azul "Analisando..." com spinner — arquivo sendo processado no momento
  - **Registro no log de alterações** — início e conclusão de cada análise são registrados com nome da pasta e resultado.

### Alterado
- **Toolbar da Biblioteca** — botões "Em ordem/Aleatório", "Analisar Silêncio" e "Importar" agrupados e alinhados à direita.
- **Log de alterações** — nova ação "Analisado" com badge violeta para registros de análise de silêncio.

### Técnico (Rust)
- Novo módulo `core/silence.rs` com função `analyze_silence()` usando Symphonia + `SampleBuffer<f32>` para decodificação em qualquer formato (MP3, WAV, FLAC, etc.).
- Novas colunas `content_start_ms` e `content_end_ms` em `audio_files` via migration `ALTER TABLE`.
- Novo campo `content_start_ms: Option<i64>` distingue "não analisado" (`null`) de "analisado sem silêncio" (`0`) e "tem silêncio inicial" (`> 0`).
- Queries SELECT de `AudioFile` convertidas de `query_as!` (macro) para `sqlx::query_as` não-macro para incluir as novas colunas sem necessidade de atualizar o cache `.sqlx/`.
- Novos comandos Tauri: `analyze_file_silence` (arquivo individual) e `scan_folder_silence` (pasta completa).
- Store Zustand (`audioStore`) estendido com `scanningFolderId` e `scanningFileId` para persistência do estado de análise entre navegações.

---

## [1.3.1] - 2026-03-20

### Adicionado
- **Músicas Sazonais** — cadastre períodos sazonais (ex: "Natal": 20/12 → 05/01) com uma pasta substituta. Durante o período ativo, todos os agendamentos configurados com **pasta** passam a tocar arquivos da pasta sazonal automaticamente, sem precisar editar cada agendamento. Agendamentos com arquivo específico não são afetados.
  - Suporte a virada de ano (ex: 20/Dez → 05/Jan).
  - Múltiplos períodos podem ser cadastrados; apenas o primeiro ativo é aplicado.
  - Toggle ativo/inativo por período; badge "ATIVO HOJE" na interface.
  - CRUD completo na página de Configurações (seção "Músicas Sazonais").

---

## [1.3.0] - 2026-03-20

### Adicionado
- **Duplicar agendamento** — botão de cópia (ícone duplo) em cada agendamento; cria uma cópia inativa com o nome "Cópia de [nome]".
- **Watchdog do player** — tarefa em segundo plano detecta player travado (posição parada por 30 s) e força parada automática, registrando o incidente nos logs.
- **Log de erro de dispositivo de áudio** — erros de desconexão do dispositivo de áudio agora emitem uma notificação toast imediata na interface, além de serem registrados nos logs de execução.
- **Atalhos de teclado** — `Espaço` para parar o player (quando fora de campos de texto); `F5` na página de Agendamentos para atualizar a lista; `Ctrl+M` para abrir o sinal manual de qualquer página.
- **Markdown no diálogo de atualização** — as notas da versão agora são renderizadas com formatação (títulos, listas, código inline, negrito).

### Corrigido
- Atalho `Ctrl+M` não abria o sinal manual indevidamente ao navegar para o Dashboard pelo menu lateral.

---

## [1.2.9] - 2026-03-19

### Corrigido
- Fechar o diálogo de atualização ("Agora não") não apaga mais o indicador de atualização na sidebar e na página Sobre.
- Botão "Instalar" na página Sobre reabre o diálogo em vez de instalar diretamente.
- Estado "Atualizado" só aparece quando de fato não há atualização disponível.

---

## [1.2.8] - 2026-03-19

### Corrigido
- CI: erro de sintaxe YAML causado por heredoc Python no workflow (movido para `scripts/gen_latest_json.py`).
- CI: notas da versão no `latest.json` agora são extraídas automaticamente do `CHANGELOG.md` e exibidas no diálogo de atualização.

---

## [1.2.7] - 2026-03-19

### Adicionado
- Sidebar: badge "novo" e dot animado no item "Sobre" quando há atualização disponível.

### Corrigido
- CI: `latest.json` gerado via Python para escapar corretamente as quebras de linha da assinatura minisign (corrige "invalid encoding in minisign data").

---

## [1.2.6] - 2026-03-19

### Corrigido
- CI: adicionado `createUpdaterArtifacts: true` no `tauri.conf.json` para forçar geração dos arquivos `.sig` necessários para o `latest.json`.

---

## [1.2.5] - 2026-03-19

### Corrigido
- CI: `latest.json` agora é gerado manualmente no workflow, independente da versão do `tauri-action`.

---

## [1.2.4] - 2026-03-19

### Corrigido
- CI: sintaxe do `--profile` corrigida para passar o argumento ao cargo (`-- --profile release-ci`).

---

## [1.2.3] - 2026-03-19

### Alterado
- CI: build de release ~50% mais rápido (perfil `release-ci`, target apenas NSIS, LTO desativado no CI).

---

## [1.2.2] - 2026-03-19

### Adicionado
- Modo quiosque: trava o app em tela cheia impedindo fechamento, com opção de iniciar automaticamente nesse modo.
- Personalização do instalador NSIS: idioma português, atalho na área de trabalho, pasta no Menu Iniciar, imagens com logo e cores da marca.

### Corrigido
- Verificação de atualizações não gerava `latest.json` no GitHub Actions (adicionado `updaterJsonPreferNsis: true`).
- Erro "Could not fetch a valid release JSON" exibido como toast ao abrir a página Sobre.

### Alterado
- Página Sobre agora tem três abas: Sistema, Histórico de Versões e Sobre & Licenças.
- Subtítulo do app atualizado para "Gerenciador de Sinal Escolar".
- Datas do histórico de versões exibidas no formato DD/MM/AAAA.

---

## [1.2.1] - 2026-03-19

### Adicionado
- Página **Sobre** unificada com informações do sistema, histórico de versões e licenças de bibliotecas.
- Seleção múltipla e edição em lote de agendamentos (duração, fade, pasta, status).
- Ações em lote na biblioteca de áudio: excluir selecionados e resetar posição.

### Alterado
- Página Sistema mesclada à página Sobre (três abas: Sistema, Histórico de Versões, Sobre & Licenças).
- Ícone da aplicação substituído em toda a interface (sidebar, onboarding, cabeçalhos).
- Subtítulo do app atualizado para "Gerenciador de Sinal Escolar".

### Corrigido
- Player aparecia no card de Sinal Manual durante reprodução de sinal agendado.
- Travamento da aplicação ao remover dispositivo de áudio durante reprodução.
- Ausência de áudio após reconexão de dispositivo de áudio no Windows (WASAPI).

---

## [1.2.0] - 2026-03-19

### Adicionado

#### Biblioteca de Áudio
- **Modo aleatório/sequencial por pasta** — cada pasta possui agora um toggle individual para reprodução em ordem (sequencial) ou aleatória. A lógica de seleção da próxima música respeita: (1) retoma arquivo em progresso, (2) escolhe entre não reproduzidos (ordem ou aleatório), (3) reinicia ciclo quando todos foram reproduzidos.
- **Encadeamento de arquivos** — quando um agendamento possui duração maior que a música atual, a próxima música da pasta é iniciada automaticamente com o tempo restante. Exemplo: agendamento de 30 s, música acaba em 10 s → próxima música toca os 20 s restantes.
- **Drag-and-drop de arquivos entre pastas** — arraste um arquivo para outra pasta na barra lateral para movê-lo.
- **Reordenação por drag-and-drop** — reordene arquivos dentro de uma pasta arrastando as linhas da tabela.
- **Mover arquivo via menu de contexto** — botão de 3 pontos em cada arquivo com opção "Mover para..." com submenu de pastas disponíveis.
- **Renomear arquivo** — edição inline do nome do arquivo na lista.
- **Importar múltiplos arquivos** — seleção de vários arquivos de áudio de uma só vez via diálogo.

#### Registro de Alterações (Audit Log)
- Nova aba **Alterações** na página de Logs mostrando um histórico de todas as operações CRUD realizadas: agendamentos, biblioteca de áudio, feriados, configurações e botões de pânico.
- Filtros por tipo de entidade e tipo de ação.
- Botão para limpar histórico de alterações.
- Registro automático nas páginas: Agendamentos, Biblioteca, Feriados, Configurações.

#### Página de Informações do Sistema
- Nova rota `/sistema` acessível pelo menu lateral.
- Exibe: versão do app, total de músicas/pastas/agendamentos, status do player em tempo real, contagem de logs de execução e alterações, configurações de NTP e backup.

#### Notificações do Sistema
- Notificações nativas do sistema operacional ao iniciar e encerrar uma reprodução agendada.

#### Onboarding
- Assistente de configuração inicial exibido na primeira execução do sistema.

#### Agendamentos
- **Detecção de conflitos** — ao criar ou editar um agendamento, o sistema verifica se existe outro agendamento no mesmo horário e dias da semana e exibe um aviso.

### Alterado

#### Backend (Rust)
- `audio_repo::next_file_for_folder` movido de `scheduler.rs` para `audio_repo.rs` como função pública, permitindo reutilização no encadeamento de arquivos.
- `PlayerEngine::play()` recebe agora o parâmetro `folder_id: Option<i64>` para suporte ao encadeamento automático.
- Migrations tornadas idempotentes: statements `ALTER TABLE` com coluna duplicada são ignorados silenciosamente, permitindo re-execução segura em instâncias existentes.
- `settings_repo` expandido com suporte a configurações de NTP e backup.

#### Frontend (React/TypeScript)
- Página de Logs reestruturada com duas abas: **Execuções** e **Alterações**.
- Layout lateral reorganizado com seção secundária de navegação (Sistema).
- `AudioFileList` refatorado para suportar DnD, reordenação, menu de contexto e toggle de modo aleatório.
- `FolderSidebar` exibe ícone de modo aleatório ao lado do nome da pasta quando ativo.

### Corrigido
- Espaçamento entre input e botão no formulário de criação de pasta na barra lateral.
- Cor do card de hora atual no dashboard (contraste insuficiente).
- Submenu "Mover para..." sendo cortado pela borda esquerda da tela.
- DnD entre arquivos e pastas não funcionava corretamente em alguns cenários.

---

## [1.1.2] - 2026-03-18

### Corrigido
- Correção de permissões no workflow do GitHub Actions para publicação de releases.

---

## [1.1.1] - 2026-03-18

### Adicionado
- Workflow de CI/CD via GitHub Actions para build e publicação automática de releases no Windows.
- Suporte a auto-atualização via `tauri-plugin-updater`.

---

## [1.0.0] - 2026-03-18

### Adicionado
- Gerenciamento de agendamentos com dias da semana, horário, duração de reprodução e fade-in/fade-out.
- Biblioteca de áudio com pastas e arquivos, playback com resumo de posição.
- Registro de feriados para suspensão automática de agendamentos.
- Botões de pânico/sinal manual com dois modos: interrupção imediata e fila com pausa.
- Configurações gerais: volume padrão, modo de pausa, startup automático, minimizar para bandeja.
- Dashboard com relógio, próximo sinal agendado e status do player em tempo real.
- Logs de execução com status, duração e posição de início.
- Bandeja do sistema (system tray) com controles de play/stop.
- Scheduler em loop via tokio verificando agendamentos a cada segundo.
- Persistência via SQLite com sqlx (modo offline para build sem banco de dados).
