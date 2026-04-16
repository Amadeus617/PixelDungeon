#!/bin/bash
# ralph.sh — Ralph Loop 状态管理器

RALPH_DIR=/root/game-project/.ralph
PRD=$RALPH_DIR/prd.json
PROGRESS=$RALPH_DIR/progress.txt

case "$1" in
  next)
    jq -c '
      .milestones[0].userStories as $stories |
      $stories | map(select(.status == "pending")) |
      map(select(
        (.dependsOn // []) | length == 0 or
        all(. as $dep | $stories | map(select(.id == $dep and .status == "done")) | length > 0)
      )) |
      sort_by(.priority) |
      .[0] // empty
    ' "$PRD"
    ;;
  done)
    ID=$2
    jq --arg id "$ID" '
      (.milestones[0].userStories[] | select(.id == $id)).status = "done"
    ' "$PRD" > /tmp/prd_tmp.json && mv /tmp/prd_tmp.json "$PRD"
    echo "[$(date '+%Y-%m-%d %H:%M')] DONE: $ID" >> "$PROGRESS"
    echo "Marked $ID as done"
    ;;
  fail)
    ID=$2
    REASON="${@:3}"
    jq --arg id "$ID" --arg r "$REASON" '
      (.milestones[0].userStories[] | select(.id == $id)).status = "blocked"
    ' "$PRD" > /tmp/prd_tmp.json && mv /tmp/prd_tmp.json "$PRD"
    echo "[$(date '+%Y-%m-%d %H:%M')] FAIL: $ID - $REASON" >> "$PROGRESS"
    echo "Marked $ID as blocked: $REASON"
    ;;
  status)
    jq -r '.milestones[0].userStories[] | "\(.id) \(.status) \(.title)"' "$PRD"
    ;;
  log)
    MSG="${@:2}"
    echo "[$(date '+%Y-%m-%d %H:%M')] LEARN: $MSG" >> "$PROGRESS"
    echo "Logged: $MSG"
    ;;
  *)
    echo "Usage: ralph.sh {next|done|fail|status|log}"
    ;;
esac
