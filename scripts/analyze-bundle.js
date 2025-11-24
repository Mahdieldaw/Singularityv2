const fs = require("fs");
const path = require("path");

// ANSI color codes
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    red: "\x1b[31m",
};

function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function analyzeMetafile(metaPath, bundleName) {
    if (!fs.existsSync(metaPath)) {
        console.log(`${colors.red}✗ Metafile not found: ${metaPath}${colors.reset}`);
        return;
    }

    const metafile = JSON.parse(fs.readFileSync(metaPath, "utf8"));

    console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}📦 ${bundleName}${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

    // Analyze inputs
    const inputs = Object.entries(metafile.inputs)
        .map(([path, info]) => ({
            path,
            bytes: info.bytes,
        }))
        .sort((a, b) => b.bytes - a.bytes);

    const totalInputBytes = inputs.reduce((sum, i) => sum + i.bytes, 0);

    // Get outputs
    const outputs = Object.entries(metafile.outputs);
    const mainOutput = outputs.find(([_, info]) => !info.entryPoint) || outputs[0];
    const outputBytes = mainOutput ? mainOutput[1].bytes : 0;

    console.log(`${colors.green}Total Input:${colors.reset}  ${formatBytes(totalInputBytes)}`);
    console.log(`${colors.green}Bundle Size:${colors.reset}  ${formatBytes(outputBytes)}`);
    console.log(`${colors.green}Compression:${colors.reset} ${((outputBytes / totalInputBytes) * 100).toFixed(1)}%\n`);

    console.log(`${colors.bright}Top 20 Largest Modules:${colors.reset}`);
    console.log(`${colors.cyan}${"─".repeat(80)}${colors.reset}`);

    inputs.slice(0, 20).forEach((item, idx) => {
        const percentage = ((item.bytes / totalInputBytes) * 100).toFixed(1);
        const sizeStr = formatBytes(item.bytes).padStart(10);
        const pctStr = `${percentage}%`.padStart(6);

        // Shorten path for readability
        let displayPath = item.path;
        if (displayPath.includes("node_modules")) {
            const parts = displayPath.split("node_modules/");
            displayPath = "node_modules/" + parts[parts.length - 1];
        }

        // Color code by size
        let color = colors.reset;
        if (item.bytes > 100000) color = colors.red;
        else if (item.bytes > 50000) color = colors.yellow;
        else color = colors.green;

        console.log(`${color}${(idx + 1).toString().padStart(2)}. ${sizeStr} ${pctStr}${colors.reset}  ${displayPath}`);
    });

    // Find duplicate packages
    const pkgs = {};
    inputs.forEach((item) => {
        const match = item.path.match(/node_modules\/(@?[^\/]+(?:\/[^\/]+)?)/);
        if (match) {
            const pkg = match[1];
            if (!pkgs[pkg]) pkgs[pkg] = 0;
            pkgs[pkg] += item.bytes;
        }
    });

    const largestPkgs = Object.entries(pkgs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (largestPkgs.length > 0) {
        console.log(`\n${colors.bright}Top 10 Heaviest Packages:${colors.reset}`);
        console.log(`${colors.cyan}${"─".repeat(80)}${colors.reset}`);
        largestPkgs.forEach(([pkg, bytes], idx) => {
            const sizeStr = formatBytes(bytes).padStart(10);
            const percentage = ((bytes / totalInputBytes) * 100).toFixed(1);
            const pctStr = `${percentage}%`.padStart(6);

            let color = colors.reset;
            if (bytes > 200000) color = colors.red;
            else if (bytes > 100000) color = colors.yellow;
            else color = colors.green;

            console.log(`${color}${(idx + 1).toString().padStart(2)}. ${sizeStr} ${pctStr}${colors.reset}  ${pkg}`);
        });
    }
}

// Analyze all bundles
const bundles = [
    { file: "dist/analysis/meta-ui.json", name: "UI Bundle (Main)" },
    { file: "dist/analysis/meta-bg.json", name: "Service Worker" },
    { file: "dist/analysis/meta-cs-openai.json", name: "Content Script" },
    { file: "dist/analysis/meta-offscreen.json", name: "Offscreen" },
    { file: "dist/analysis/meta-oi.json", name: "OI Bundle" },
];

console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════╗
║     📊 Bundle Size Analysis Report        ║
╚═══════════════════════════════════════════╝
${colors.reset}`);

bundles.forEach((bundle) => analyzeMetafile(bundle.file, bundle.name));

console.log(`\n${colors.bright}${colors.green}For interactive visualization, run:${colors.reset}`);
console.log(`${colors.cyan}  npx esbuild-visualizer --metadata dist/analysis/meta-ui.json${colors.reset}`);
console.log(`${colors.cyan}Or visit: https://esbuild.github.io/analyze/${colors.reset}\n`);
