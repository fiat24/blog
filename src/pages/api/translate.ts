import type { APIRoute } from "astro";

const DEEPLX_KEY = "jU9cgx4Gnu2pO_xHVZEuDru3LPkylsvKAyuOL8fR-Ik";
const DEEPLX_ENDPOINT = `https://api.deeplx.org/${DEEPLX_KEY}/translate`;

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { text, targetLang = "EN" } = body;

        if (!text) {
            return new Response(JSON.stringify({ error: "No text provided" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const response = await fetch(DEEPLX_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text,
                source_lang: "auto",
                target_lang: targetLang,
            }),
        });

        if (!response.ok) {
            return new Response(
                JSON.stringify({ error: `DeepLX failed: ${response.statusText}` }),
                { status: response.status, headers: { "Content-Type": "application/json" } }
            );
        }

        const data = await response.json();

        if (data.code !== 200) {
            return new Response(
                JSON.stringify({ error: data.message || "Translation failed" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        return new Response(JSON.stringify({ translatedText: data.data }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};
