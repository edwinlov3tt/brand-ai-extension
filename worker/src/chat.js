/**
 * Chat Module - Handles AI chat with streaming responses
 * Following CLAUDE.md SSE streaming rules
 */

import { getCorsHeaders, jsonResponse, errorResponse } from './cors.js';
import { getUploadsByIds, linkUploadsToMessage, getFileContent } from './uploads.js';
import { getAgent as getAgentFromFiles, BRAND_AI_PROMPT } from './agents/index.js';
import { handleAgenticLoop, shouldUseAgenticLoop } from './tools/agentic-loop.js';

/**
 * Generate a unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Build the system prompt with brand context, optional agent, chip selections, and optional page context
 */
function buildSystemPrompt(brandProfile, agent, currentDateTime, pageContext, chipSelections) {
  let systemPrompt = '';

  // Add agent-specific prompt if present (file-based agents use systemPrompt, not system_prompt)
  if (agent) {
    systemPrompt = (agent.systemPrompt || agent.system_prompt) + '\n\n';
  } else {
    systemPrompt = `You are a helpful AI marketing assistant. You help businesses create compelling marketing content, ad copy, and messaging that aligns with their brand voice and resonates with their target audience.\n\n`;
  }

  // Add chip selections as user preferences context
  if (chipSelections && Object.keys(chipSelections).length > 0) {
    systemPrompt += `<user_preferences>
The user has selected the following preferences for this request:
`;
    for (const [key, value] of Object.entries(chipSelections)) {
      // Convert camelCase to Title Case for display
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      systemPrompt += `- ${label}: ${value}\n`;
    }
    systemPrompt += `
IMPORTANT: Tailor your response to match these preferences. They indicate the user's specific needs.
</user_preferences>\n\n`;
  }

  // Add current date/time context for seasonal awareness
  if (currentDateTime) {
    systemPrompt += `<current_context>
The current date and time is: ${currentDateTime}
Use this information to provide seasonally relevant suggestions (e.g., holiday campaigns, seasonal promotions, time-sensitive marketing ideas).
</current_context>\n\n`;
  }

  // Add page context if present (product/service the user wants to focus on)
  if (pageContext && pageContext.title) {
    systemPrompt += `<page_context>
The user has selected a specific ${pageContext.type || 'page'} to focus on for this message:

<${pageContext.type || 'page'}_details>
  <title>${pageContext.title}</title>
  ${pageContext.summary ? `<summary>${pageContext.summary}</summary>` : ''}
  ${pageContext.valuePropositions?.length > 0 ? `<value_propositions>\n    ${pageContext.valuePropositions.map(vp => `- ${vp}`).join('\n    ')}\n  </value_propositions>` : ''}
  ${pageContext.features?.length > 0 ? `<features>\n    ${pageContext.features.map(f => `- ${f}`).join('\n    ')}\n  </features>` : ''}
  ${pageContext.benefits?.length > 0 ? `<benefits>\n    ${pageContext.benefits.map(b => `- ${b}`).join('\n    ')}\n  </benefits>` : ''}
  ${pageContext.targetAudience ? `<target_audience>${pageContext.targetAudience}</target_audience>` : ''}
</${pageContext.type || 'page'}_details>

IMPORTANT: When responding to the user's message, focus your content on this specific ${pageContext.type || 'item'}. Reference its features, benefits, and value propositions when creating marketing content.
</page_context>\n\n`;
  }

  // Add brand context
  if (brandProfile) {
    systemPrompt += `You are currently working with the following brand:

<brand_profile>
  <brand_identity>
    <name>${brandProfile.name || 'Unknown Brand'}</name>
    <tagline>${brandProfile.tagline || ''}</tagline>
    <positioning>${brandProfile.positioning || ''}</positioning>
    <mission>${brandProfile.mission || ''}</mission>
  </brand_identity>

  <brand_voice>
    <personality_traits>${(brandProfile.voice_personality || []).join(', ')}</personality_traits>
    <tone>
      Formal: ${brandProfile.tone_sliders?.formal || 50}/100
      Playful: ${brandProfile.tone_sliders?.playful || 50}/100
      Energetic: ${brandProfile.tone_sliders?.energetic || 50}/100
    </tone>
    <preferred_phrases>${(brandProfile.lexicon_preferred || []).join('; ')}</preferred_phrases>
    <phrases_to_avoid>${(brandProfile.lexicon_avoid || []).join('; ')}</phrases_to_avoid>
  </brand_voice>

  <target_audience>
    <primary>${brandProfile.audience_primary || ''}</primary>
    <pain_points>${(brandProfile.audience_pain_points || []).join('; ')}</pain_points>
    <needs>${(brandProfile.audience_needs || []).join('; ')}</needs>
  </target_audience>
</brand_profile>

Always maintain this brand's voice, tone, and target audience in your responses. Reference the brand guidelines when creating content.`;

    // Add additional instructions if present
    if (brandProfile.additional_instructions && brandProfile.additional_instructions.length > 0) {
      const instructionsList = brandProfile.additional_instructions
        .map(instruction => `- ${instruction.text}`)
        .join('\n');

      systemPrompt += `

<additional_instructions>
IMPORTANT: Follow these specific guidelines for this brand. These are user-defined rules that MUST be followed in ALL responses:
${instructionsList}
</additional_instructions>`;
    }
  }

  return systemPrompt;
}

/**
 * Get brand profile by ID
 */
async function getBrandProfile(brandProfileId, env) {
  const result = await env.DB.prepare(
    'SELECT * FROM brand_profiles WHERE id = ?'
  ).bind(brandProfileId).first();

  if (!result) return null;

  // Parse JSON fields
  return {
    ...result,
    voice_personality: JSON.parse(result.voice_personality || '[]'),
    tone_sliders: JSON.parse(result.tone_sliders || '{}'),
    lexicon_preferred: JSON.parse(result.lexicon_preferred || '[]'),
    lexicon_avoid: JSON.parse(result.lexicon_avoid || '[]'),
    audience_needs: JSON.parse(result.audience_needs || '[]'),
    audience_pain_points: JSON.parse(result.audience_pain_points || '[]'),
    additional_instructions: JSON.parse(result.additional_instructions || '[]'),
  };
}

/**
 * Get agent by ID (uses file-based agent registry)
 */
function getAgent(agentId) {
  // Use file-based agents instead of database
  return getAgentFromFiles(agentId);
}

/**
 * Get conversation history
 */
async function getConversationHistory(conversationId, env, limit = 20) {
  const messages = await env.DB.prepare(
    `SELECT role, content FROM chat_messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC
     LIMIT ?`
  ).bind(conversationId, limit).all();

  return messages.results.map(m => ({
    role: m.role,
    content: m.content
  }));
}

/**
 * Save a message to the database
 */
async function saveMessage(conversationId, role, content, env, attachments = null) {
  const id = generateId();
  const attachmentsJson = attachments ? JSON.stringify(attachments) : null;
  await env.DB.prepare(
    `INSERT INTO chat_messages (id, conversation_id, role, content, attachments, created_at)
     VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))`
  ).bind(id, conversationId, role, content, attachmentsJson).run();
  return id;
}

/**
 * Build Claude content array from message text and attachments
 * Handles images (via base64), PDFs (via base64), and text files (via extracted text)
 */
async function buildClaudeContent(messageText, attachments, env) {
  console.log('[buildClaudeContent] Starting with', attachments?.length || 0, 'attachments');

  // If no attachments, return simple text content
  if (!attachments || attachments.length === 0) {
    console.log('[buildClaudeContent] No attachments, returning text');
    return messageText;
  }

  const content = [];

  for (const att of attachments) {
    console.log('[buildClaudeContent] Processing attachment:', att.file_category, att.original_filename, att.r2_key);

    if (att.file_category === 'image') {
      // Images: Fetch from R2 and send as base64 (Claude can't fetch URLs)
      try {
        console.log('[buildClaudeContent] Fetching image from R2:', att.r2_key);
        const imageObject = await getFileContent(att.r2_key, env);
        console.log('[buildClaudeContent] Image object exists:', !!imageObject);

        if (imageObject) {
          const arrayBuffer = await imageObject.arrayBuffer();
          console.log('[buildClaudeContent] ArrayBuffer size:', arrayBuffer.byteLength);

          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          console.log('[buildClaudeContent] Base64 length:', base64.length);

          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: att.file_type,
              data: base64
            }
          });
          console.log('[buildClaudeContent] Image added to content');
        } else {
          console.log('[buildClaudeContent] No image object returned from R2');
        }
      } catch (error) {
        console.error(`[buildClaudeContent] Failed to fetch image ${att.r2_key}:`, error.message);
        // Fallback to text description
        content.push({
          type: 'text',
          text: `[Image: ${att.original_filename}] (Failed to load)`
        });
      }
    } else if (att.file_category === 'pdf') {
      // PDFs: Fetch from R2 and send as base64
      try {
        const pdfObject = await getFileContent(att.r2_key, env);
        if (pdfObject) {
          const arrayBuffer = await pdfObject.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          content.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64
            }
          });
        }
      } catch (error) {
        console.error(`Failed to fetch PDF ${att.r2_key}:`, error);
        // Fallback to text description
        content.push({
          type: 'text',
          text: `[PDF File: ${att.original_filename}] (Failed to load content)`
        });
      }
    } else {
      // Text/document files: Use extracted text from client
      const textContent = att.extracted_text || '[No text content extracted]';
      content.push({
        type: 'text',
        text: `[File: ${att.original_filename}]\n\n${textContent}`
      });
    }
  }

  // Add the user's message text last
  content.push({
    type: 'text',
    text: messageText
  });

  return content;
}

/**
 * Update conversation timestamp
 */
async function updateConversationTimestamp(conversationId, env) {
  await env.DB.prepare(
    `UPDATE chat_conversations SET updated_at = strftime('%s', 'now') WHERE id = ?`
  ).bind(conversationId).run();
}

/**
 * Generate conversation title from first message
 */
async function generateConversationTitle(message, env) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: `Generate a short (3-5 word) title for a conversation that starts with: "${message.substring(0, 200)}". Return ONLY the title, no quotes or explanation.`
        }]
      })
    });

    if (!response.ok) {
      return 'New Chat';
    }

    const data = await response.json();
    return data.content[0].text.trim().substring(0, 100);
  } catch (error) {
    console.error('Failed to generate title:', error);
    return 'New Chat';
  }
}

/**
 * Handle streaming chat request
 * Following CLAUDE.md SSE streaming rules with keepalive
 */
export async function handleStreamChat(request, env, ctx) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    const { conversationId, message, brandProfileId, agentId, currentDateTime, pageContext, attachmentIds, chipSelections } = body;

    if (!conversationId || !message) {
      return errorResponse('conversationId and message are required', request, 400);
    }

    // Get conversation to verify it exists
    const conversation = await env.DB.prepare(
      'SELECT * FROM chat_conversations WHERE id = ?'
    ).bind(conversationId).first();

    if (!conversation) {
      return errorResponse('Conversation not found', request, 404);
    }

    // Get brand profile and agent (agent from file-based registry)
    const brandProfile = await getBrandProfile(conversation.brand_profile_id, env);
    const agent = conversation.agent_id ? getAgent(conversation.agent_id) : null;

    // Get conversation history
    const history = await getConversationHistory(conversationId, env);

    // Build system prompt with date/time context, page context, and chip selections
    const systemPrompt = buildSystemPrompt(brandProfile, agent, currentDateTime, pageContext, chipSelections);

    // Get attachments if provided
    const attachments = attachmentIds?.length > 0
      ? await getUploadsByIds(attachmentIds, env)
      : [];

    // Build attachment metadata for storing with message
    const attachmentMeta = attachments.map(att => ({
      id: att.id,
      filename: att.original_filename,
      fileType: att.file_type,
      fileSize: att.file_size,
      fileCategory: att.file_category,
      url: att.public_url
    }));

    // Save user message with attachment metadata
    const userMessageId = await saveMessage(
      conversationId,
      'user',
      message,
      env,
      attachmentMeta.length > 0 ? attachmentMeta : null
    );

    // Link uploads to the message
    if (attachmentIds?.length > 0) {
      await linkUploadsToMessage(attachmentIds, userMessageId, env);
    }

    // Build Claude content with attachments
    const userContent = await buildClaudeContent(message, attachments, env);

    // Build messages array for Claude
    const messages = [
      ...history,
      { role: 'user', content: userContent }
    ];

    // Determine if we should use Brand AI with tools (agentic loop)
    const useBrandAIMode = shouldUseAgenticLoop(conversation.agent_id);

    // Create streaming response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start the streaming response in the background
    ctx.waitUntil((async () => {
      let fullResponse = '';
      let keepaliveInterval;

      try {
        console.log('[Chat] Starting streaming response...');
        console.log('[Chat] Mode:', useBrandAIMode ? 'Brand AI (with tools)' : 'Direct Agent');
        console.log('[Chat] Attachments:', attachments?.length || 0);

        // Set up keepalive to prevent timeout
        keepaliveInterval = setInterval(() => {
          writer.write(encoder.encode(': keepalive\n\n'));
        }, 15000);

        if (useBrandAIMode) {
          // Brand AI mode: Use agentic loop with tools
          console.log('[Chat] Using Brand AI agentic loop...');

          // Build Brand AI system prompt with brand context
          const brandAISystemPrompt = buildSystemPrompt(brandProfile, { systemPrompt: BRAND_AI_PROMPT }, currentDateTime, pageContext, chipSelections);

          // Prepare brand context for tool execution
          const brandContext = {
            brandProfile,
            pageContext,
            currentDateTime,
          };

          // Handle the agentic loop (tool use)
          fullResponse = await handleAgenticLoop(
            {
              systemPrompt: brandAISystemPrompt,
              messages,
              brandContext,
            },
            env,
            writer,
            encoder
          );
        } else {
          // Direct agent mode: Stream directly without tools
          console.log('[Chat] Using direct agent streaming...');
          console.log('[Chat] User content type:', typeof userContent);
          console.log('[Chat] User content is array:', Array.isArray(userContent));
          if (Array.isArray(userContent)) {
            console.log('[Chat] Content items:', userContent.length);
            userContent.forEach((item, i) => {
              console.log(`[Chat] Content[${i}]:`, item.type, item.type === 'image' ? `(${item.source?.type})` : '');
            });
          }

          // Call Claude API with streaming
          console.log('[Chat] Calling Claude API...');
          const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
              system: systemPrompt,
              messages: messages,
            }),
          });

          console.log('[Chat] Claude response status:', claudeResponse.status);
          if (!claudeResponse.ok) {
            const errorText = await claudeResponse.text();
            console.error('[Chat] Claude API error:', claudeResponse.status, errorText);
            throw new Error(`Claude API error: ${claudeResponse.status} - ${errorText}`);
          }
          console.log('[Chat] Claude response OK, starting stream processing...');

          // Process the stream
          const reader = claudeResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

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

                    // Send to client
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
                  }
                } catch (e) {
                  // Skip non-JSON lines
                }
              }
            }
          }
        }

        // Save assistant response
        if (fullResponse) {
          await saveMessage(conversationId, 'assistant', fullResponse, env);
          await updateConversationTimestamp(conversationId, env);
        }

        // Send done signal
        await writer.write(encoder.encode('data: [DONE]\n\n'));

      } catch (error) {
        console.error('[Chat] Streaming error:', error.message);
        console.error('[Chat] Error stack:', error.stack);
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
      } finally {
        console.log('[Chat] Stream complete, closing writer');
        if (keepaliveInterval) clearInterval(keepaliveInterval);
        await writer.close();
      }
    })());

    // Return the streaming response with proper headers
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',  // Prevents nginx/proxy buffering
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    return errorResponse(error.message, request, 500);
  }
}

/**
 * Create a new conversation
 */
export async function createConversation(request, env) {
  try {
    const body = await request.json();
    const { brandProfileId, agentId, title, initialMessage } = body;

    if (!brandProfileId) {
      return errorResponse('brandProfileId is required', request, 400);
    }

    // Verify brand exists
    const brand = await env.DB.prepare(
      'SELECT id FROM brand_profiles WHERE id = ?'
    ).bind(brandProfileId).first();

    if (!brand) {
      return errorResponse('Brand not found', request, 404);
    }

    const conversationId = generateId();
    const conversationTitle = title || (initialMessage ? await generateConversationTitle(initialMessage, env) : 'New Chat');

    await env.DB.prepare(
      `INSERT INTO chat_conversations (id, brand_profile_id, agent_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))`
    ).bind(conversationId, brandProfileId, agentId || null, conversationTitle).run();

    return jsonResponse({
      id: conversationId,
      brandProfileId,
      agentId: agentId || null,
      title: conversationTitle,
      isPinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, request, 201);

  } catch (error) {
    console.error('Create conversation error:', error);
    return errorResponse(error.message, request, 500);
  }
}

/**
 * List conversations for a brand
 */
export async function listConversations(request, env, brandProfileId) {
  try {
    const conversations = await env.DB.prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count
       FROM chat_conversations c
       WHERE c.brand_profile_id = ?
       ORDER BY c.is_pinned DESC, c.updated_at DESC
       LIMIT 50`
    ).bind(brandProfileId).all();

    return jsonResponse(conversations.results.map(c => ({
      id: c.id,
      brandProfileId: c.brand_profile_id,
      agentId: c.agent_id,
      title: c.title,
      isPinned: c.is_pinned === 1,
      messageCount: c.message_count,
      createdAt: c.created_at * 1000,
      updatedAt: c.updated_at * 1000,
    })), request);

  } catch (error) {
    console.error('List conversations error:', error);
    return errorResponse(error.message, request, 500);
  }
}

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(request, env, conversationId) {
  try {
    const messages = await env.DB.prepare(
      `SELECT * FROM chat_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`
    ).bind(conversationId).all();

    return jsonResponse(messages.results.map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role,
      content: m.content,
      attachments: m.attachments ? JSON.parse(m.attachments) : [],
      createdAt: m.created_at * 1000,
    })), request);

  } catch (error) {
    console.error('Get messages error:', error);
    return errorResponse(error.message, request, 500);
  }
}

/**
 * Update a conversation (title, pin status)
 */
export async function updateConversation(request, env, conversationId) {
  try {
    const body = await request.json();
    const { title, isPinned } = body;

    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (isPinned !== undefined) {
      updates.push('is_pinned = ?');
      values.push(isPinned ? 1 : 0);
    }

    if (updates.length === 0) {
      return errorResponse('No updates provided', request, 400);
    }

    updates.push('updated_at = strftime(\'%s\', \'now\')');
    values.push(conversationId);

    await env.DB.prepare(
      `UPDATE chat_conversations SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return jsonResponse({ success: true }, request);

  } catch (error) {
    console.error('Update conversation error:', error);
    return errorResponse(error.message, request, 500);
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(request, env, conversationId) {
  try {
    // Messages will be deleted via CASCADE
    await env.DB.prepare(
      'DELETE FROM chat_conversations WHERE id = ?'
    ).bind(conversationId).run();

    return jsonResponse({ success: true }, request);

  } catch (error) {
    console.error('Delete conversation error:', error);
    return errorResponse(error.message, request, 500);
  }
}

/**
 * Get a single conversation by ID (includes agentId for state restoration)
 */
export async function getConversation(request, env, conversationId) {
  try {
    const conversation = await env.DB.prepare(
      'SELECT * FROM chat_conversations WHERE id = ?'
    ).bind(conversationId).first();

    if (!conversation) {
      return errorResponse('Conversation not found', request, 404);
    }

    return jsonResponse({
      id: conversation.id,
      brandProfileId: conversation.brand_profile_id,
      agentId: conversation.agent_id,
      title: conversation.title,
      isPinned: conversation.is_pinned === 1,
      createdAt: conversation.created_at * 1000,
      updatedAt: conversation.updated_at * 1000,
    }, request);

  } catch (error) {
    console.error('Get conversation error:', error);
    return errorResponse(error.message, request, 500);
  }
}
