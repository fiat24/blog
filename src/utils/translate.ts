/**
 * 翻译工具 - 使用 DeepLX
 * API URL 格式：https://api.deeplx.org/<api-key>/translate
 * 支持多个 key 轮询（逗号分隔）
 */

export interface TranslateOptions {
    apiKey?: string;
}

export interface TranslateResult {
    success: boolean;
    content?: string;
    error?: string;
}

// 轮询计数器
let keyIndex = 0;

/**
 * 从逗号分隔的 key 字符串中轮询获取下一个 key
 */
function getNextApiKey(apiKeyStr: string): string {
    const keys = apiKeyStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
    if (keys.length === 0) {
        return "";
    }
    const key = keys[keyIndex % keys.length];
    keyIndex++;
    return key;
}

/**
 * 翻译文本
 */
export async function translateText(
    text: string,
    options: TranslateOptions
): Promise<TranslateResult> {
    const { apiKey: apiKeyStr } = options;

    if (!apiKeyStr) {
        return { success: false, error: "API key is required" };
    }

    // 轮询获取 key
    const apiKey = getNextApiKey(apiKeyStr);
    if (!apiKey) {
        return { success: false, error: "No valid API key found" };
    }

    // DeepLX API URL 格式：https://api.deeplx.org/<api-key>/translate
    const apiUrl = `https://api.deeplx.org/${apiKey}/translate`;

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text,
                source_lang: "ZH",
                target_lang: "EN",
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                error: `API request failed: ${response.status} ${errorText}`,
            };
        }

        const data = await response.json();

        // DeepLX 返回结构：{ code: 200, data: "translated text" }
        const translatedContent = data.data;

        if (!translatedContent) {
            return { success: false, error: `No translation content in response: ${JSON.stringify(data)}` };
        }

        return { success: true, content: translatedContent };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * 翻译 Markdown 内容 (DeepLX 不太适合直接翻整个 Markdown，这里只做简单透传，或者此时的 text 已经是纯文本/片段)
 * 为了兼容接口，保留函数名但底层调 translateText
 */
export async function translateMarkdown(
    content: string,
    options: TranslateOptions
): Promise<TranslateResult> {
    // DeepLX 是纯文本翻译，可能会破坏 Markdown 格式。
    // 简单处理：直接翻译。如果需要保护 Markdown 语法，需要更复杂的解析逻辑。
    // 鉴于博客文章主要是文本，这里暂时直接透传。
    return translateText(content, options);
}

/**
 * 翻译文章 frontmatter 中的标题和描述
 */
export function translateFrontmatter(
    frontmatter: Record<string, unknown>,
    translatedTitle?: string,
    translatedDescription?: string
): Record<string, unknown> {
    return {
        ...frontmatter,
        title: translatedTitle || frontmatter.title,
        description: translatedDescription || frontmatter.description,
    };
}

/**
 * 计算内容的简单 hash（用于缓存键）
 */
export function hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}
