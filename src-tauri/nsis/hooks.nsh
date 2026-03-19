; ── MMO Sinal — NSIS Installer Hooks ────────────────────────────────────────
; Executado após a instalação dos arquivos

!macro customInstall
  ; Atalho na Área de Trabalho
  CreateShortcut "$DESKTOP\MMO Sinal.lnk" \
    "$INSTDIR\MMOSinal.exe" "" \
    "$INSTDIR\MMOSinal.exe" 0 \
    SW_SHOWNORMAL "" "MMO Sinal — Gerenciador de Sinal Escolar"
!macroend

; Executado durante a desinstalação

!macro customUnInstall
  ; Remove atalho da Área de Trabalho
  Delete "$DESKTOP\MMO Sinal.lnk"
!macroend
