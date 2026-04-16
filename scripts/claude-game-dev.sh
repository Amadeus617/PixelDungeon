#!/bin/bash
# claude-game-dev.sh — Claude Code + GLM-5.1 Ralph Loop
# 系统 cron 每15分钟调用

source ~/.bashrc
source ~/.nvm/nvm.sh

RALPH_DIR=/root/game-project
RALPH_SCRIPT=$RALPH_DIR/scripts/ralph.sh

# 1. 获取下一个任务
TASK_JSON=$($RALPH_SCRIPT next)

if [ -z "$TASK_JSON" ]; then
  echo "[$(date)] No pending tasks. Exiting."
  exit 0
fi

TASK_ID=$(echo "$TASK_JSON" | jq -r .id)
TASK_TITLE=$(echo "$TASK_JSON" | jq -r .title)
TASK_DESC=$(echo "$TASK_JSON" | jq -r .description)
TASK_TYPE=$(echo "$TASK_JSON" | jq -r .type)
TASK_CRITERIA=$(echo "$TASK_JSON" | jq -r ".acceptanceCriteria | join(\"- \")")

echo "[$(date)] Starting task: $TASK_ID - $TASK_TITLE"

# 2. 构造 prompt
read -r -d "" PROMPT << PROMPT_EOF
你在 /root/game-project/ 目录下开发一个 2D Roguelike 游戏（Phaser 3 + TypeScript + Vite）。

当前任务: $TASK_ID - $TASK_TITLE
类型: $TASK_TYPE
描述: $TASK_DESC

验收标准:
- $TASK_CRITERIA

请完成这个任务：
1. 先了解当前项目结构（ls, cat 已有文件）
2. 根据任务要求创建或修改代码文件
3. 运行 cd /root/game-project && npx tsc --noEmit 检查类型
4. 如果有错误，修复后重试
5. 运行 cd /root/game-project && npm run build 确认构建成功

完成后回复格式：
DONE: $TASK_ID
或
FAIL: $TASK_ID 原因
PROMPT_EOF

# 3. 运行 Claude Code
RESULT=$(claude --print --model GLM-5.1 --bare --dangerously-skip-permissions --add-dir /root/game-project \
  --max-budget-usd 2 \
  --append-system-prompt "你是一个游戏开发者，专注于 Phaser 3 + TypeScript 游戏。保持简洁，直接写代码。" \
  -p "$PROMPT" 2>&1)

echo "$RESULT"

# 4. 更新状态
if echo "$RESULT" | grep -q "DONE: $TASK_ID"; then
  $RALPH_SCRIPT done "$TASK_ID"
  cd $RALPH_DIR && git add -A && git commit -m "feat: [$TASK_ID] $TASK_TITLE" && git push
  echo "[$(date)] SUCCESS: $TASK_ID"
elif echo "$RESULT" | grep -q "FAIL: $TASK_ID"; then
  REASON=$(echo "$RESULT" | grep "FAIL: $TASK_ID" | sed "s/.*FAIL: $TASK_ID //")
  $RALPH_SCRIPT fail "$TASK_ID" "$REASON"
  echo "[$(date)] FAILED: $TASK_ID - $REASON"
else
  # 自动检测：如果构建成功就算完成
  if cd $RALPH_DIR && npx tsc --noEmit 2>/dev/null && npm run build 2>/dev/null; then
    $RALPH_SCRIPT done "$TASK_ID"
    git add -A && git commit -m "feat: [$TASK_ID] $TASK_TITLE" && git push
    echo "[$(date)] SUCCESS (auto-detected): $TASK_ID"
  else
    $RALPH_SCRIPT fail "$TASK_ID" "Build failed after execution"
    echo "[$(date)] FAILED (build check): $TASK_ID"
  fi
fi

$RALPH_SCRIPT log "Executed $TASK_ID via Claude Code + GLM-5.1"
