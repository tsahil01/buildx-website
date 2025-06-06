import { Message } from "@/types/types";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import OpenAI from "openai";
import { BASE_PROMPT, getSystemPrompt } from "../web-prompts";
import { BASE_MANIM_PROMPT, getManimSystemPrompt } from "../video-prompts";
import { reactPrompt } from "../defaults/react";
import { stripIndents } from "../stripindents";
import { nextPrompt } from "../defaults/nextjs";
import { manimPrompt } from "../defaults/manim";


export async function chat(llm: OpenAI, prompt: string) {
    try {
        const completion = await llm.chat.completions.create({
            model: "gemini-1.5-flash",
            messages: [{
                role: "system",
                content: "Return either node or react or nextjs or manim based on what do you think this project should be. Only return a single word either 'node' or 'react' or 'nextjs' or 'manim'. Do not return anything extra.\nPS: Manim is a framework for creating animations."
            }, {
                role: "user",
                content: prompt
            }]
        });
        return completion.choices[0].message;
    } catch (error) {
        if (error instanceof Error) {
            throw Error(`${error.message}`);
        } else {
            throw Error("An unknown error occurred");
        }
    }
}

export async function chatStream(llm: OpenAI, messages: Message[], prompt: string, framework: string, modelName: string, response: (token: string) => void) {
    try {
        if (framework === "REACT") {
            messages.unshift({
                role: "user", content: [{
                    type: "text",
                    text: stripIndents(reactPrompt)
                }]
            });
        } else if (framework === "NEXT") {
            messages.unshift({
                role: "user", content: [{
                    type: "text",
                    text: stripIndents(nextPrompt)
                }]
            });
        } else if (framework === "MANIM") {
            messages.unshift({
                role: "user", content: [{
                    type: "text",
                    text: stripIndents(manimPrompt)
                }]
            });
        }

        if (framework == "NEXT" || framework == "REACT") {
            if (!messages.some(msg => msg.role === "system")) {
                messages.unshift({
                    role: "system", content: [{
                        type: "text",
                        text: stripIndents(getSystemPrompt())
                    }]
                });
            }
            messages.unshift({
                role: "user", content: [{
                    type: "text",
                    text: stripIndents(BASE_PROMPT)
                }]
            })
        } else if (framework == "MANIM") {
            if (!messages.some(msg => msg.role === "system")) {
                messages.unshift({
                    role: "system", content: [{
                        type: "text",
                        text: stripIndents(getManimSystemPrompt())
                    }]
                });
            }
            messages.unshift({
                role: "user", content: [{
                    type: "text",
                    text: stripIndents(BASE_MANIM_PROMPT)
                }]
            })
        }

        messages.push({
            role: "user", content: [{
                type: "text",
                text: prompt
            }]
        });

        const completion = await llm.chat.completions.create({
            model: modelName,
            messages: messages as ChatCompletionMessageParam[],
            temperature: 0.8,
            stream: true,
        });

        let fullContent = "";
        for await (const chunk of completion) {
            if (chunk.choices?.[0]?.delta?.content === undefined) continue;
            response(chunk.choices?.[0]?.delta?.content || '');
            fullContent += chunk.choices?.[0]?.delta?.content || '';
        }
        return fullContent;

    } catch (error) {
        console.error("Error: ", error);
        messages.push({
            role: "assistant", content: [{
                type: "text",
                text: "Error occurred while processing the request"
            }]
        });
        response("Error occurred while processing the request");
        return "Error occurred while processing the request";
    }
}