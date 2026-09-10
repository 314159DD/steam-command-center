#!/usr/bin/env bash
# Launch the PICS watcher interactively (tmux mode). Steam's email Guard needs a fresh
# code each login, so this runs in the foreground and prompts once for password + code.
# Usage:
#   tmux new -s pics '/path/to/steam-command-center/collector/run_pics_tmux.sh'   # then attach + enter code
#   tmux attach -t pics                                            # detach with Ctrl-b then d
set -euo pipefail
cd /path/to/steam-command-center/collector
source .venv/bin/activate
set -a && source pics.env && set +a
exec python pics_worker.py
