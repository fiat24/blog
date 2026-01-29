/**
 * 翻译工具 - 使用硅基流动 API 调用 DeepSeek R1
 */

const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/chat/completions";
const SILICONFLOW_MODEL = "deepseek-ai/DeepSeek-R1";

// 翻译 prompt，参考 lyc8503 的优化版本
const TRANSLATE_PROMPT = `请将以上 Markdown 翻译成英文，不用深度思考，保留所有格式，但遇到一些中文的梗或玩笑时，可以灵活的调整翻译内容，使其更加符合英语表达习惯。除此之外，不要修改任何链接或代码（最多翻译代码中的注释），确保你的输出还是合法的 Markdown，不用放在一个代码块中，直接输出结果。`;

export interface TranslateOptions {
    apiKey: string;
    apiUrl?: string;
    model?: string;
}

export interface TranslateResult {
    success: boolean;
    content?: string;
    error?: string;
}

/**
 * 翻译 Markdown 内容
 */
export async function translateMarkdown(
    content: string,
    options: TranslateOptions
): Promise<TranslateResult> {
    const { apiKey, apiUrl = SILICONFLOW_API_URL, model = SILICONFLOW_MODEL } = options;

    if (!apiKey) {
        return { success: false, error: "API key is required" };
    }

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: "user",
                        content: `${content}\n\n${TRANSLATE_PROMPT}`,
                    },
                ],
                temperature: 0.7,
                top_p: 0.8,
                max_tokens: Math.max(4096, content.length * 2),
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
        const translatedContent = data.choices?.[0]?.message?.content;

        if (!translatedContent) {
            return { success: false, error: "No translation content in response" };
        }

        // 移除可能的 <think> 标签（DeepSeek R1 的思考过程）
        const cleanedContent = translatedContent
            .replace(/<think>[\s\S]*?<\/think>/g, "")
            .trim();

        return { success: true, content: cleanedContent };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
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
