const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

// Ensure dist directory exists
fs.mkdirSync("dist", { recursive: true });
fs.mkdirSync("dist/ui", { recursive: true });
fs.mkdirSync("dist/analysis", { recursive: true });

async function buildWithMeta() {
    console.log("Building with metafile generation...\n");

    // Build service worker
    const swResult = await esbuild.build({
        entryPoints: ["src/sw-entry.js"],
        bundle: true,
        platform: "browser",
        target: "chrome110",
        format: "iife",
        outfile: "dist/bg.js",
        logLevel: "info",
        legalComments: "none",
        metafile: true,
    });
    fs.writeFileSync(
        "dist/analysis/meta-bg.json",
        JSON.stringify(swResult.metafile)
    );
    console.log("✓ Built bg.js with metafile");

    // Build content script
    const csResult = await esbuild.build({
        entryPoints: ["src/cs-openai.js"],
        bundle: true,
        platform: "browser",
        target: "chrome110",
        format: "iife",
        outfile: "dist/cs-openai.js",
        logLevel: "info",
        legalComments: "none",
        metafile: true,
    });
    fs.writeFileSync(
        "dist/analysis/meta-cs-openai.json",
        JSON.stringify(csResult.metafile)
    );
    console.log("✓ Built cs-openai.js with metafile");

    // Build offscreen
    const offscreenResult = await esbuild.build({
        entryPoints: ["src/offscreen-entry.js"],
        bundle: true,
        platform: "browser",
        target: "chrome110",
        format: "esm",
        outfile: "dist/offscreen.js",
        logLevel: "info",
        legalComments: "none",
        metafile: true,
    });
    fs.writeFileSync(
        "dist/analysis/meta-offscreen.json",
        JSON.stringify(offscreenResult.metafile)
    );
    console.log("✓ Built offscreen.js with metafile");

    // Build oi
    const oiResult = await esbuild.build({
        entryPoints: ["src/oi.js"],
        bundle: true,
        platform: "browser",
        target: "chrome110",
        format: "iife",
        outfile: "dist/oi.js",
        logLevel: "info",
        legalComments: "none",
        metafile: true,
    });
    fs.writeFileSync(
        "dist/analysis/meta-oi.json",
        JSON.stringify(oiResult.metafile)
    );
    console.log("✓ Built oi.js with metafile");

    // Build UI (typically the largest bundle)
    const uiResult = await esbuild.build({
        entryPoints: ["ui/index.tsx"],
        bundle: true,
        platform: "browser",
        target: "chrome110",
        format: "esm",
        outfile: "dist/ui/index.js",
        logLevel: "info",
        loader: { ".ts": "ts", ".tsx": "tsx" },
        jsx: "automatic",
        legalComments: "none",
        metafile: true,
    });
    fs.writeFileSync(
        "dist/analysis/meta-ui.json",
        JSON.stringify(uiResult.metafile)
    );
    console.log("✓ Built ui/index.js with metafile");

    console.log("\n📊 Metafiles saved to dist/analysis/");
    console.log("Run 'npm run analyze' to visualize bundle composition");
}

buildWithMeta().catch((err) => {
    console.error(err);
    process.exit(1);
});
