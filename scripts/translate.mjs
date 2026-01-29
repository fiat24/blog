/**
 * 预构建翻译脚本 - 使用 DeepLX API（支持多 Key 轮询）
 * 使用方式: node scripts/translate.mjs
 * 环境变量: DEEPLX_API_KEYS (逗号分隔的多个 key)
 */
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// API Key 管理器（轮询）
class KeyManager {
    constructor(keys) {
        this.keys = keys;
        this.index = 0;
    }

    getNextKey() {
        const key = this.keys[this.index];
        this.index = (this.index + 1) % this.keys.length;
        return key;
    }
}

// 计算 hash
function hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

// 简单的 frontmatter 解析
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: content, raw: "" };

    const frontmatterStr = match[1];
    const body = match[2];

    const frontmatter = {};
    const lines = frontmatterStr.split("\n");

    for (const line of lines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            frontmatter[key] = value;
        }
    }

    return { frontmatter, body, raw: frontmatterStr };
}

// 重建 frontmatter
function stringifyFrontmatter(frontmatter, content) {
    let fm = "---\n";
    for (const [key, value] of Object.entries(frontmatter)) {
        if (typeof value === "string" && (value.includes(":") || value.includes("#") || value.includes('"'))) {
            fm += `${key}: "${value.replace(/"/g, '\\"')}"\n`;
        } else {
            fm += `${key}: ${value}\n`;
        }
    }
    fm += "---\n";
    return fm + content;
}

// 使用 DeepLX 翻译文本（支持重试和 key 轮询）
async function translateText(text, keyManager, retries = 3) {
    if (!text || text.trim().length === 0) return text;

    for (let i = 0; i < retries; i++) {
        const apiKey = keyManager.getNextKey();
        const url = `https://api.deeplx.org/${apiKey}/translate`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: text,
                    source_lang: "auto",
                    target_lang: "EN",
                }),
            });

            if (!response.ok) {
                console.error(`DeepLX error (key ${i + 1}): ${response.status}, trying next key...`);
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            const data = await response.json();

            if (data.code !== 200) {
                console.error(`DeepLX error: ${data.message || "Unknown error"}, trying next key...`);
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            return data.data;
        } catch (error) {
            console.error(`Translation error: ${error.message}, trying next key...`);
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    return null;
}

// 翻译目录
async function translateDirectory(sourceDir, outputDir, keyManager) {
    const sourcePath = join(projectRoot, sourceDir);
    const outputPath = join(projectRoot, outputDir);

    await mkdir(outputPath, { recursive: true });

    let files;
    try {
        files = await readdir(sourcePath);
    } catch {
        console.log(`Source directory ${sourceDir} not found, skipping`);
        return;
    }

    const mdFiles = files.filter(f => f.endsWith(".md") || f.endsWith(".mdx"));

    for (const file of mdFiles) {
        const filePath = join(sourcePath, file);
        const outPath = join(outputPath, file);

        const fileStat = await stat(filePath);
        if (fileStat.isDirectory()) continue;

        const content = await readFile(filePath, "utf-8");
        const contentHash = hashContent(content);

        // 检查是否已翻译
        try {
            const existing = await readFile(outPath, "utf-8");
            const existingHash = existing.match(/<!-- hash: (\w+) -->/)?.[1];
            if (existingHash === contentHash) {
                console.log(`Skip (cached): ${file}`);
                continue;
            }
        } catch {
            // 文件不存在
        }

        console.log(`Translating: ${file}`);

        const { frontmatter, body } = parseFrontmatter(content);

        // 翻译内容（分段翻译以避免文本过长）
        const paragraphs = body.split(/\n\n+/);
        const translatedParagraphs = [];

        for (const para of paragraphs) {
            if (para.trim().length === 0) {
                translatedParagraphs.push("");
                continue;
            }
            // 跳过代码块
            if (para.startsWith("```") || para.startsWith("    ")) {
                translatedParagraphs.push(para);
                continue;
            }

            const translated = await translateText(para, keyManager);
            translatedParagraphs.push(translated || para);

            // 延迟避免限流
            await new Promise(r => setTimeout(r, 300));
        }

        const translatedBody = translatedParagraphs.join("\n\n");

        // 翻译标题
        if (frontmatter.title) {
            const translatedTitle = await translateText(frontmatter.title, keyManager);
            if (translatedTitle) {
                frontmatter.title = translatedTitle.replace(/\n/g, " ").trim();
            }
            await new Promise(r => setTimeout(r, 300));
        }

        // 翻译描述
        if (frontmatter.description) {
            const translatedDesc = await translateText(frontmatter.description, keyManager);
            if (translatedDesc) {
                frontmatter.description = translatedDesc.replace(/\n/g, " ").trim();
            }
            await new Promise(r => setTimeout(r, 300));
        }

        const finalContent = stringifyFrontmatter(
            frontmatter,
            `<!-- hash: ${contentHash} -->\n\n> ⚠️ This article is machine-translated and may contain errors.\n\n${translatedBody}`
        );

        await writeFile(outPath, finalContent);
        console.log(`Done: ${file}`);
    }
}

// 主函数
async function main() {
    // 支持逗号分隔的多个 key
    const keysEnv = process.env.DEEPLX_API_KEYS || process.env.DEEPLX_API_KEY;

    if (!keysEnv) {
        console.log("DEEPLX_API_KEYS not set, skipping translation");
        return;
    }

    const keys = keysEnv.split(",").map(k => k.trim()).filter(k => k);
    console.log(`Starting translation with DeepLX (${keys.length} API keys)...`);

    const keyManager = new KeyManager(keys);

    await translateDirectory("src/content/post", "src/content/post-en", keyManager);
    await translateDirectory("src/content/note", "src/content/note-en", keyManager);

    console.log("Translation complete!");
}

main().catch(console.error);
