/**
 * Agentic Loop Handler
 *
 * Handles the tool use loop for Brand AI:
 * 1. Make initial Claude call with tools
 * 2. If tool_use, execute tool via nested Claude call
 * 3. Return tool result to Claude
 * 4. Get final response (for streaming)
 *
 * This creates a two-phase response:
 * - Phase 1: Brand AI decides and optionally calls tools (non-streaming)
 * - Phase 2: Final response streams to user
 */

import { getToolDefinitions } from './agent-tools.js';
import { executeAgentTool } from './tool-executor.js';

/**
 * Make a non-streaming Claude API call
 */
async function callClaudeNonStreaming(options, env) {
  const { system, messages, tools } = options;

  const payload = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system,
    messages,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Make a streaming Claude API call and return ReadableStream
 */
async function callClaudeStreaming(options, env) {
  const { system, messages } = options;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      stream: true,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  return response;
}

/**
 * Process the agentic loop for Brand AI with tools
 *
 * @param {object} options - Configuration options
 * @param {string} options.systemPrompt - Brand AI system prompt
 * @param {Array} options.messages - Conversation history
 * @param {object} options.brandContext - Brand profile, page context, etc.
 * @param {object} env - Worker environment
 * @param {WritableStreamDefaultWriter} writer - Stream writer for SSE
 * @param {TextEncoder} encoder - Text encoder
 * @returns {Promise<string>} - Full response text for saving
 */
export async function handleAgenticLoop(options, env, writer, encoder) {
  const { systemPrompt, messages, brandContext } = options;
  const tools = getToolDefinitions();

  console.log('[Agentic Loop] Starting with tools:', tools.map((t) => t.name));

  // Phase 1: Initial Claude call to decide if tools are needed
  console.log('[Agentic Loop] Phase 1: Initial call to detect tool use');
  const initialResponse = await callClaudeNonStreaming(
    {
      system: systemPrompt,
      messages,
      tools,
    },
    env
  );

  console.log('[Agentic Loop] Initial response stop_reason:', initialResponse.stop_reason);

  // Check if Claude wants to use a tool
  const toolUseBlock = initialResponse.content.find((c) => c.type === 'tool_use');

  if (toolUseBlock) {
    // Phase 2: Execute the tool (nested Claude call with agent)
    console.log('[Agentic Loop] Phase 2: Executing tool:', toolUseBlock.name);

    // Send indicator to client that tool is being executed
    const toolIndicator = `Generating content with ${formatToolName(toolUseBlock.name)}...\n\n`;
    await writer.write(encoder.encode(`data: ${JSON.stringify({ content: toolIndicator, isToolExecution: true })}\n\n`));

    let toolResult;
    try {
      toolResult = await executeAgentTool(
        toolUseBlock.name,
        toolUseBlock.input,
        brandContext,
        env
      );
    } catch (error) {
      console.error('[Agentic Loop] Tool execution error:', error);
      toolResult = `Error generating content: ${error.message}. Please try again.`;
    }

    console.log('[Agentic Loop] Tool result length:', toolResult.length);

    // Phase 3: Continue conversation with tool result
    console.log('[Agentic Loop] Phase 3: Streaming final response');

    const finalMessages = [
      ...messages,
      { role: 'assistant', content: initialResponse.content },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: toolResult,
          },
        ],
      },
    ];

    // Stream the final response
    const streamResponse = await callClaudeStreaming(
      {
        system: systemPrompt,
        messages: finalMessages,
      },
      env
    );

    // Process and forward the stream
    const fullResponse = await processAndForwardStream(streamResponse, writer, encoder);
    return fullResponse;
  } else {
    // No tool use - stream the initial response content directly
    console.log('[Agentic Loop] No tool use, forwarding initial response');

    // Extract text from initial response and send it
    let fullResponse = '';
    for (const block of initialResponse.content) {
      if (block.type === 'text') {
        fullResponse += block.text;
        await writer.write(encoder.encode(`data: ${JSON.stringify({ content: block.text })}\n\n`));
      }
    }

    return fullResponse;
  }
}

/**
 * Process Claude streaming response and forward to client
 */
async function processAndForwardStream(claudeResponse, writer, encoder) {
  const reader = claudeResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);

          // Handle content_block_delta events
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            const text = parsed.delta.text;
            fullResponse += text;

            // Forward to client
            await writer.write(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
          }
        } catch (e) {
          // Skip non-JSON lines
        }
      }
    }
  }

  return fullResponse;
}

/**
 * Format tool name for user-friendly display
 */
function formatToolName(toolName) {
  const names = {
    generate_meta_ads: 'Meta Ads Expert',
    generate_google_ads: 'Google Ads Expert',
    generate_email: 'Email Marketing Expert',
    generate_landing_page: 'Landing Page Expert',
    generate_copy: 'Copywriter',
  };
  return names[toolName] || toolName;
}

/**
 * Check if we should use the agentic loop (Brand AI mode)
 * @param {string|null} agentId - The selected agent ID (null = Brand AI)
 * @returns {boolean} Whether to use agentic loop
 */
export function shouldUseAgenticLoop(agentId) {
  // Use agentic loop when no specific agent is selected (Brand AI mode)
  return !agentId;
}
