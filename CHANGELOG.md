# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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
