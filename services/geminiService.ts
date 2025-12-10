import OpenAI from "openai";
import { GradingResponse, RawAnalysisResult, FeedbackItem, PositionRect, StudentAnswer, ChatMessage } from "../types";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Initialize OpenAI client compatible with DashScope
const client = new OpenAI({
  apiKey: "sk-e3adae5d49cb464ba63a0b177c33d8c0", // provided user key
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  dangerouslyAllowBrowser: true, // Required for client-side usage
  timeout: 120 * 1000, // 2-minute timeout for potentially long vision requests
  maxRetries: 2, // Retry up to 2 times on transient network errors
});

const USER_JSON_TEMPLATE = `{
"Link-picture": ["image_0", "image_1"],
"Question": {
"text": "<text of question>",
"picture_index": "0",
"position_of_whole_step": {
"x": 0.1,
"y": 0.1,
"width": 0.5,
"height": 0.2
}
},
"Answer": {
"student": [
  {
    "process": {
    "steps": [
    {
    "text": "<text of this step>",
    "formula": "<formula of this step>",
    "picture_index": "1",
    "position_of_whole_step": {
    "x": 0.1,
    "y": 0.3,
    "width": 0.8,
    "height": 0.1
    },
    "correction_of_whole_step": "<correction of this step>"
    }
    ]
    },
    "result": {
    "text": "<text of result>",
    "picture_index": "1",
    "position_of_result": {
    "x": 0.1,
    "y": 0.8,
    "width": 0.3,
    "height": 0.1
    },
    "correction_of_result": "<correction of this step>"
    }
  }
],
"reference": {
"process": {
"steps": [
{
"text": "<text of reference step>",
"formula": "<formula>",
"picture_index": "0",
"position_of_whole_step": {
"x": 0,
"y": 0,
"width": 0,
"height": 0
}
}
]
},
"result": {
"text": "<text of reference result>",
"picture_index": "0",
"position_of_result": {
"x": 0,
"y": 0,
"width": 0,
"height": 0
}
}
}
}`;

/**
 * Converts the application's ChatMessage format to the format required by the OpenAI-compatible API.
 * This enables passing the full conversation history as context.
 */
const buildApiHistory = (history: ChatMessage[]): ChatCompletionMessageParam[] => {
  const apiMessages: ChatCompletionMessageParam[] = [];

  for (const msg of history) {
    if (msg.isLoading || !msg.role) continue; // Skip transient UI messages

    if (msg.role === 'user') {
      const contentParts: { type: string; text?: string; image_url?: { url: string } }[] = [];
      
      if (msg.text) {
        contentParts.push({ type: 'text', text: msg.text });
      }
      if (msg.images) {
        msg.images.forEach(img => {
          contentParts.push({ type: 'image_url', image_url: { url: img } });
        });
      }
      if (contentParts.length > 0) {
        apiMessages.push({ role: 'user', content: contentParts as any });
      }
    } else if (msg.role === 'model') {
      // Use summary as text content if it's a grading result, otherwise use text.
      // This allows the model to have context of previous grading tasks in a follow-up chat.
      const modelText = msg.gradingResult ? msg.gradingResult.summary : msg.text;
      if (modelText) {
        apiMessages.push({ role: 'assistant', content: modelText });
      }
    }
  }
  return apiMessages;
};


/**
 * Helper to convert user's 0-1 percentage rect to 0-1000 scale [ymin, xmin, ymax, xmax]
 */
const convertRectToBox2d = (rect: PositionRect): number[] => {
    // Safety check
    if (!rect) return [0, 0, 0, 0];
    
    // User format: x(left), y(top), width, height (0.0 - 1.0)
    // Target format: ymin, xmin, ymax, xmax (0 - 1000)
    
    const xmin = Math.max(0, rect.x * 1000);
    const ymin = Math.max(0, rect.y * 1000);
    const xmax = Math.min(1000, (rect.x + rect.width) * 1000);
    const ymax = Math.min(1000, (rect.y + rect.height) * 1000);
    
    return [ymin, xmin, ymax, xmax];
};

/**
 * Helper to safely parse picture_index to number
 */
const parseImageIndex = (val: string | number | undefined): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    return parseInt(val, 10) || 0;
};

/**
 * New function for general purpose chat, streaming the response.
 * Now accepts the full conversation history for context.
 */
export async function* getChatResponse(history: ChatMessage[], model: string, signal?: AbortSignal): AsyncGenerator<string> {
  try {
    const apiHistory = buildApiHistory(history);

    const stream = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `你是一个得力的多模态助手。请根据用户提供的文本和图片进行回复。

重要提示：本应用有一个专门的“作业批改模式”。如果用户想要详细的作业批改、标注和纠错，他们需要在输入中包含 “@grader” 关键词。

如果用户：
1. 似乎想要批改作业但拼写了错误的关键词（如 @grad, @grade, @grading 等）；
2. 询问如何使用批改功能；

请在你的回答中礼貌地提醒他们，只需在输入中加上 “@grader” 即可激活专业的批改模式。`
        },
        ...apiHistory
      ],
      stream: true,
    }, { signal });

    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  } catch (error) {
    console.error("Error getting chat response from Qwen:", error);
    if (error instanceof OpenAI.APIConnectionError) {
        throw new Error("Connection error.");
    }
    throw error;
  }
}

/**
 * Grades homework from an image.
 * Now accepts the full conversation history for context.
 */
export const gradeHomeworkImage = async (history: ChatMessage[], model: string, signal?: AbortSignal): Promise<GradingResponse> => {
  try {
    const apiHistory = buildApiHistory(history);

    const stream = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `你是一个专业的作业批改助手。
识别图中所有信息,将题目,学生解答以及标准答案都识别出来填入 json,并完成标准答案对于学生解答的纠正。

重要提示：
如果用户在包含 '@grader' 的消息中提供了额外的文本指令（例如“检查语法”、“解释第二步公式”或“只看最后结果”），请务必在生成的 JSON 内容中体现对这些指令的响应。例如，在 'summary' 中回答用户的问题，或在 'correction' 中提供用户要求的特定反馈。

提示:
1. reference 是参考答案,一般不是手写.
2. Answer.student 是一个数组 (Array)，因为用户可能上传了多个解答部分或多页答案。请务必将不同的解答部分作为数组中的不同对象返回。
3. steps 是步骤的列表,里面可能有多个元素,一般一个 step 是对应一个手绘图以及相关的所有公式,也就是说一个 step 主要的标志是一个手绘图和相关联的所有公式
4. result 一般是不搭配手绘图的,是一段总结结果的文字
5. text 和 formula 是纯识别任务. formula 字段请只包含数学公式，不要包含文字。
6. picture_index 对应输入图片的顺序索引 (例如第一张图为 "0", 第二张图为 "1")。
7. position_of_whole_step 中的 x, y, width, height 为 0 到 1 之间的浮点数 (百分比)。
8. LaTeX 格式化规则：
   - 对于 "formula" 字段：请只填写纯 LaTeX 数学公式，不要包含任何 $ 符号。这部分内容将被渲染为独立的公式块 (Block Math)。
   - 对于所有其他文本字段 (例如 "text", "correction_of_whole_step", "correction_of_result")：如果其中包含数学符号或公式，请务必使用单个 $ 将其包裹起来，以形成行内公式 (Inline Math)。例如："因为 $x > 0$ 且 $y = x^2$。" 不要使用 $$。
9. 确保你生成的 JSON 是严格有效的。例如，不要在对象或数组的末尾添加尾随逗号。
10. JSON 字符串值中不允许出现真正的换行符。如果需要在字符串中表示换行，请务必使用 \`\\n\` 进行转义。

请严格按照以下 JSON 格式输出结果，不要包含 markdown 格式标记 (如 \`\`\`json):
${USER_JSON_TEMPLATE}`
        },
        ...apiHistory,
      ],
      stream: true,
    }, { signal });

    let fullContent = "";
    
    for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
            fullContent += chunk.choices[0].delta.content;
        }
    }
    
    if (!fullContent) {
        throw new Error("Received empty response from Qwen model.");
    }

    // Clean up potential markdown code blocks
    let jsonString = fullContent.replace(/```json\n?|\n?```/g, "").trim();
    // Attempt to extract JSON if the model included conversational filler
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }

    let rawData: RawAnalysisResult;
    try {
        rawData = JSON.parse(jsonString);
    } catch (error) {
        console.warn("Failed to parse JSON on first attempt. Trying to sanitize...", error);
        // Sanitize by removing trailing commas which are a common LLM mistake
        const sanitizedJsonString = jsonString.replace(/,(?=\s*?[}\]])/g, '');
        try {
            rawData = JSON.parse(sanitizedJsonString);
        } catch (finalError) {
            console.error("Error parsing sanitized JSON from Qwen:", finalError);
            console.error("Original JSON string:", jsonString);
            console.error("Sanitized JSON string:", sanitizedJsonString);
            // Re-throw the original error or a new one to be caught by the calling function
            throw new Error(`Failed to parse JSON response from the model. Original error: ${error}`);
        }
    }

    // --- MAP RAW DATA TO UI FORMAT ---
    
    const annotations: FeedbackItem[] = [];

    // 1. Map Question
    if (rawData.Question) {
        annotations.push({
            id: `q-${Date.now()}`,
            label: "题目",
            details: rawData.Question.text,
            box_2d: convertRectToBox2d(rawData.Question.position_of_whole_step),
            type: 'suggestion', // Blue/Neutral
            imageIndex: parseImageIndex(rawData.Question.picture_index)
        });
    }

    // 2. Map Student Steps (Handling Array now)
    let studentAnswers: StudentAnswer[] = [];
    if (rawData.Answer?.student) {
        if (Array.isArray(rawData.Answer.student)) {
            studentAnswers = rawData.Answer.student;
        } else if (typeof rawData.Answer.student === 'object') {
            // Fallback if model returns a single object despite instruction
            studentAnswers = [rawData.Answer.student];
        }
    }

    studentAnswers.forEach((studentAns, ansIndex) => {
        // Steps
        if (studentAns.process?.steps) {
            const steps = Array.isArray(studentAns.process.steps) ? studentAns.process.steps : [studentAns.process.steps];
            
            steps.forEach((step, stepIndex) => {
                // Determine type based on if correction seems negative or positive
                let type: 'praise' | 'error' | 'suggestion' = 'praise';
                const correction = step.correction_of_whole_step || "";
                
                if (correction.length > 5 && !correction.includes("正确") && !correction.includes("Correct")) {
                    type = 'error';
                }

                // Wrap formula in $$ for block math display if it exists, or keep empty
                const formattedFormula = step.formula ? `$$${step.formula}$$` : "";

                annotations.push({
                    id: `s${ansIndex}-step-${stepIndex}-${Date.now()}`,
                    label: `步骤 ${stepIndex + 1} (解答 ${ansIndex + 1})`,
                    // Construct details with delimiters for LatexRenderer
                    details: `内容: ${step.text}\n公式: ${formattedFormula}\n\n批改: ${correction || "正确"}`,
                    box_2d: convertRectToBox2d(step.position_of_whole_step),
                    type: type,
                    imageIndex: parseImageIndex(step.picture_index)
                });
            });
        }

        // Result
        if (studentAns.result) {
            const res = studentAns.result;
            const correction = res.correction_of_result || "";
            let type: 'praise' | 'error' = 'praise';
            if (correction.length > 5 && !correction.includes("正确")) {
                type = 'error';
            }

            annotations.push({
                id: `s${ansIndex}-res-${Date.now()}`,
                label: `最终结果 (解答 ${ansIndex + 1})`,
                details: `结果: ${res.text}\n\n批改: ${correction || "正确"}`,
                box_2d: convertRectToBox2d(res.position_of_result),
                type: type,
                imageIndex: parseImageIndex(res.picture_index)
            });
        }
    });

    // 4. Construct Summary including Reference Answer (Robust construction)
    let summaryParts: string[] = [];
    
    // Question Part
    if (rawData.Question?.text) {
        summaryParts.push(`题目：${rawData.Question.text}`);
    } else {
        summaryParts.push("作业批改完成。");
    }

    // Reference Answer Part
    if (rawData.Answer?.reference) {
        const ref = rawData.Answer.reference;
        summaryParts.push(`**标准答案思路**：`); // Bold markdown header
        
        let steps: any[] = [];
        // Robust check: ref.process might be undefined, steps might be array or object
        if (ref.process?.steps) {
             if (Array.isArray(ref.process.steps)) {
                 steps = ref.process.steps;
             } else if (typeof ref.process.steps === 'object') {
                 steps = [ref.process.steps];
             }
        }

        if (steps.length > 0) {
            steps.forEach((step, i) => {
                const t = step?.text || "";
                const f = step?.formula ? `$${step.formula}$` : "";
                summaryParts.push(`${i+1}. ${t} ${f}`);
            });
        }

        if (ref.result?.text) {
            summaryParts.push(`\n**标准结果**：${ref.result.text}`); // Bold markdown header
        }
    }

    return {
        summary: summaryParts.join("\n\n"),
        annotations: annotations
    };

  } catch (error) {
    console.error("Error grading homework with Qwen:", error);
    if (error instanceof OpenAI.APIConnectionError) {
        throw new Error("Connection error.");
    }
    throw error;
  }
};