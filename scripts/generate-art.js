import Replicate from "replicate";
import fs from "fs";
import https from "https";
import path from "path";

const ASSETS_DIR = path.resolve("public/assets");
const QUEUE_FILE = path.resolve(".ralph/art-queue.json");
const BUDGET_FILE = path.resolve(".ralph/budget.json");

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

async function main() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) { console.error("REPLICATE_API_TOKEN not set"); process.exit(1); }

  const budget = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8"));
  if (budget.replicate.used >= budget.replicate.monthlyBudget) {
    console.log("Replicate budget exceeded: $" + budget.replicate.used);
    process.exit(1);
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf-8"));
  const task = queue.find(t => t.status === "pending");
  if (!task) { console.log("No pending art tasks"); process.exit(0); }

  console.log("Generating:", task.prompt);
  const replicate = new Replicate({ auth: token });

  const output = await replicate.run(task.model, {
    input: {
      prompt: task.prompt,
      width: task.width || 64,
      height: task.height || 64,
      num_outputs: 1,
    }
  });

  const url = Array.isArray(output) ? output[0] : output;
  const filePath = path.join(ASSETS_DIR, task.outputPath);
  await downloadFile(url, filePath);

  const stats = fs.statSync(filePath);
  if (stats.size < 1024) {
    console.error("Generated file too small, possibly corrupt");
    process.exit(1);
  }

  task.status = "done";
  task.completedAt = new Date().toISOString();
  task.fileSize = stats.size;
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

  budget.replicate.used += 0.05;
  budget.replicate.runs.push({
    date: new Date().toISOString(),
    model: task.model,
    cost: 0.05,
    artifact: task.outputPath
  });
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(budget, null, 2));

  console.log("Done:", filePath, "(" + stats.size + " bytes)");
}

main().catch(err => { console.error(err); process.exit(1); });
