#!/bin/bash
# generate-art.sh — curl + Replicate API 生成像素画
source ~/.bashrc
cd /root/game-project

QUEUE_FILE=".ralph/art-queue.json"
BUDGET_FILE=".ralph/budget.json"
ASSETS_DIR="public/assets"

TASK=$(jq -c '[.[] | select(.status=="pending")][0]' "$QUEUE_FILE")
if [ "$TASK" = "null" ] || [ -z "$TASK" ]; then
  echo "No pending art tasks"
  exit 0
fi

TASK_ID=$(echo "$TASK" | jq -r .id)
MODEL=$(echo "$TASK" | jq -r .model)
PROMPT=$(echo "$TASK" | jq -r .prompt)
WIDTH=$(echo "$TASK" | jq -r .width)
HEIGHT=$(echo "$TASK" | jq -r .height)
OUTPUT=$(echo "$TASK" | jq -r .outputPath)
STYLE=$(echo "$TASK" | jq -r '.style // empty')
REMOVE_BG=$(echo "$TASK" | jq -r '.remove_bg // false')

echo "[$(date)] Generating: $TASK_ID - $PROMPT"

# Build input JSON
INPUT="{\"prompt\":\"$PROMPT\",\"width\":$WIDTH,\"height\":$HEIGHT,\"num_images\":1"
[ -n "$STYLE" ] && INPUT="$INPUT,\"style\":\"$STYLE\""
[ "$REMOVE_BG" = "true" ] && INPUT="$INPUT,\"remove_bg\":true"
INPUT="$INPUT}"

# Create prediction
RESPONSE=$(curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"input\":$INPUT}" \
  "https://api.replicate.com/v1/models/$MODEL/predictions")

OUTPUT_URL=$(echo "$RESPONSE" | jq -r '.output')
if [ -z "$OUTPUT_URL" ] || [ "$OUTPUT_URL" = "null" ]; then
  PREDICTION_ID=$(echo "$RESPONSE" | jq -r .id)
  echo "Waiting for prediction $PREDICTION_ID..."
  for i in $(seq 1 60); do
    sleep 3
    STATUS=$(curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
      "https://api.replicate.com/v1/predictions/$PREDICTION_ID")
    STATE=$(echo "$STATUS" | jq -r .status)
    if [ "$STATE" = "succeeded" ]; then
      OUTPUT_URL=$(echo "$STATUS" | jq -r '.output[0]')
      break
    elif [ "$STATE" = "failed" ]; then
      echo "Prediction failed: $(echo "$STATUS" | jq -r .error)"
      exit 1
    fi
    echo "  Status: $STATE ($i/60)..."
  done
fi

if [ -z "$OUTPUT_URL" ] || [ "$OUTPUT_URL" = "null" ]; then
  echo "Failed to get output URL"
  exit 1
fi

echo "Downloading: $OUTPUT_URL"
mkdir -p "$(dirname "$ASSETS_DIR/$OUTPUT")"
curl -sL "$OUTPUT_URL" -o "$ASSETS_DIR/$OUTPUT"

SIZE=$(stat -c%s "$ASSETS_DIR/$OUTPUT" 2>/dev/null)
if [ "$SIZE" -lt 500 ]; then
  echo "File too small ($SIZE bytes)"
  exit 1
fi

# Update queue
jq --arg id "$TASK_ID" --arg ts "$(date -Iseconds)" --argjson sz "$SIZE" \
  '(.[] | select(.id==$id)) |= . + {status:"done", completedAt:$ts, fileSize:$sz}' \
  "$QUEUE_FILE" > /tmp/aq_tmp.json && mv /tmp/aq_tmp.json "$QUEUE_FILE"

# Update budget
jq --arg ts "$(date -Iseconds)" --arg m "$MODEL" --arg o "$OUTPUT" \
  '.replicate.used += 0.05 | .replicate.runs += [{date:$ts, model:$m, cost:0.05, artifact:$o}]' \
  "$BUDGET_FILE" > /tmp/bg_tmp.json && mv /tmp/bg_tmp.json "$BUDGET_FILE"

echo "[$(date)] Done: $ASSETS_DIR/$OUTPUT ($SIZE bytes)"
