"""
Gera latest.json para o Tauri updater.
Uso: python3 scripts/gen_latest_json.py <exe_file> <sig_file>
"""
import json
import os
import sys
from datetime import datetime, timezone


def extract_changelog(version):
    """Extrai as notas da versão do CHANGELOG.md."""
    changelog_path = os.path.join(os.path.dirname(__file__), "..", "CHANGELOG.md")
    if not os.path.exists(changelog_path):
        return ""

    content = open(changelog_path, encoding="utf-8").read()
    lines = content.splitlines()

    in_section = False
    notes = []

    for line in lines:
        if line.startswith(f"## [{version}]"):
            in_section = True
            continue
        if in_section:
            # Próxima seção de versão termina o bloco
            if line.startswith("## [") and not line.startswith(f"## [{version}]"):
                break
            # Pula separadores
            if line.strip() == "---":
                break
            notes.append(line)

    # Remove linhas vazias do início e do fim
    text = "\n".join(notes).strip()
    return text


def main():
    if len(sys.argv) < 3:
        print("Uso: python3 gen_latest_json.py <exe_file> <sig_file>")
        sys.exit(1)

    exe_file = sys.argv[1]
    sig_file = sys.argv[2]

    ref_name = os.environ.get("GITHUB_REF_NAME", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    version = ref_name.lstrip("v")

    exe_name = os.path.basename(exe_file)
    exe_url = f"https://github.com/{repo}/releases/download/{ref_name}/{exe_name}"
    signature = open(sig_file, "r", encoding="utf-8").read().strip()
    notes = extract_changelog(version)

    data = {
        "version": version,
        "notes": notes or "Veja o CHANGELOG para detalhes.",
        "pub_date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "platforms": {
            "windows-x86_64": {
                "signature": signature,
                "url": exe_url,
            }
        },
    }

    output = json.dumps(data, indent=2, ensure_ascii=False)
    with open("latest.json", "w", encoding="utf-8") as f:
        f.write(output)

    sys.stdout.buffer.write(b"--- latest.json gerado ---\n")
    sys.stdout.buffer.write(output.encode("utf-8"))


if __name__ == "__main__":
    main()
