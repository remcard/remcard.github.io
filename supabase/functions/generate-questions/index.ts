import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { flashcards, count = 5, questionType = "multiple_choice" } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const flashcardsText = flashcards
      .map((fc: any) => `Term: ${fc.term}\nDefinition: ${fc.definition}`)
      .join("\n\n");

    const systemPrompt = `You are an expert educational AI that generates high-quality study questions. Generate ${count} ${questionType} questions based on the provided flashcards. Make questions challenging but fair, testing understanding rather than mere memorization.`;

    let userPrompt = "";
    
    if (questionType === "multiple_choice") {
      userPrompt = `Generate ${count} multiple choice questions based on these flashcards:\n\n${flashcardsText}\n\nFor each question, provide 4 options (A, B, C, D) with exactly one correct answer. Format as JSON array with structure: [{"question": "...", "options": ["A: ...", "B: ...", "C: ...", "D: ..."], "correctAnswer": "A", "explanation": "..."}]`;
    } else if (questionType === "true_false") {
      userPrompt = `Generate ${count} true/false questions based on these flashcards:\n\n${flashcardsText}\n\nFormat as JSON array with structure: [{"question": "...", "correctAnswer": true/false, "explanation": "..."}]`;
    } else if (questionType === "fill_blank") {
      userPrompt = `Generate ${count} fill-in-the-blank questions based on these flashcards:\n\n${flashcardsText}\n\nUse ___ for blanks. Format as JSON array with structure: [{"question": "...", "correctAnswer": "...", "explanation": "..."}]`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_questions",
              description: "Generate study questions in the specified format",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correctAnswer: { type: ["string", "boolean"] },
                        explanation: { type: "string" },
                      },
                      required: ["question", "correctAnswer"],
                    },
                  },
                },
                required: ["questions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_questions" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const questions = JSON.parse(toolCall.function.arguments).questions;

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-questions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
