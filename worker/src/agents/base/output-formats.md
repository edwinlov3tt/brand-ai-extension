# Output Format Specifications

This document defines the standardized output format ALL agents must follow.

---

<output_structure>

## Required Output Format

You MUST respond in this exact XML structure for all content generation:

```xml
<content_generation>
  <thinking>
    [Your chain-of-thought reasoning process:
     - Audience analysis
     - Angle selection
     - Hook strategy
     - Key message formulation
     - Variant differentiation strategy]
  </thinking>

  <variants>
    <variant number="1" strategy="[Hook type or approach used]">
      <content>
        <!-- Content sections based on template -->
      </content>
      <metadata>
        <character_count>[Total character count]</character_count>
        <word_count>[Total word count]</word_count>
        <key_features>
          - [What makes this variant unique]
          - [Psychological trigger used]
          - [Target audience alignment]
        </key_features>
      </metadata>
      <rationale>[Why this variant will perform well]</rationale>
    </variant>

    <!-- Repeat for all requested variants -->
  </variants>

  <optimization_recommendations>
    <a_b_testing>
      - [Primary element to test first]
      - [Secondary element to test]
    </a_b_testing>

    <performance_prediction>
      <predicted_engagement>[Low/Medium/High with reasoning]</predicted_engagement>
      <audience_resonance>
        - [Which audience segments will respond best]
      </audience_resonance>
    </performance_prediction>

    <improvement_suggestions>
      - [How to potentially improve further]
    </improvement_suggestions>
  </optimization_recommendations>
</content_generation>
```

</output_structure>

---

<thinking_requirements>

## Chain-of-Thought Requirements

The `<thinking>` section MUST include:

### 1. Audience Analysis
- Who exactly is this for?
- What do they care about?
- What language resonates with them?
- What objections might they have?

### 2. Angle Selection
- What unique perspective will we take?
- How do we differentiate from generic content?
- What emotional trigger is most effective?

### 3. Hook Strategy
- Which hook formula fits best?
- How do we grab attention in the first 3-5 words?
- What creates curiosity or urgency?

### 4. Key Message Formulation
- What's the ONE thing they should remember?
- How do we tie to brand positioning?
- What proof points support this?

### 5. Variant Strategy
- How will each variant differ?
- What elements are we testing?
- How do we cover different angles?

</thinking_requirements>

---

<variant_differentiation>

## Variant Differentiation Guidelines

Each variant MUST be meaningfully different:

### Differentiation Approaches

1. **Hook Type Variation** (channel-dependent, questions are NOT default)
   - Variant 1: Direct statement or benefit hook (default)
   - Variant 2: Contrarian or proof hook
   - Variant 3: Story, process, or vivid snapshot hook
   - Questions are optional (max 1 per variant) and MUST pass the Question Rubric

   **Hook Device Menu** (choose based on intent/channel):
   - Direct benefit statement
   - Specific offer with constraint
   - Proof point (number, stat, quote)
   - Micro-story (1-2 lines)
   - Vivid future snapshot
   - Contrarian truth
   - Command/imperative
   - Question (only if passes rubric)

2. **Emotional Trigger Variation**
   - Variant 1: Fear of missing out
   - Variant 2: Aspiration/transformation
   - Variant 3: Social proof/belonging

3. **Length Variation**
   - Variant 1: Concise (minimum viable)
   - Variant 2: Standard (optimal length)
   - Variant 3: Expanded (maximum detail)

4. **Audience Focus Variation**
   - Variant 1: Pain-point focused
   - Variant 2: Benefit focused
   - Variant 3: Feature focused

### NOT Acceptable Differentiation
- Simply rewording the same content
- Changing only one or two words
- Using synonyms without strategic purpose
- Reordering paragraphs without reason

</variant_differentiation>

---

<quality_verification>

## Pre-Output Verification

Before outputting content, verify each variant:

### Grammar Compliance
- [ ] All sentences under 19 words
- [ ] NO em dashes (use commas or periods)
- [ ] NO dangling modifiers
- [ ] Active voice (less than 9% passive)
- [ ] Transition words used naturally (not forced)
- [ ] Questions pass Question Rubric (or rewritten as statements)
- [ ] No banned question templates

### Brand Compliance
- [ ] Matches specified tone of voice
- [ ] Avoids all words on the avoid list
- [ ] Uses preferred phrases where natural
- [ ] Addresses target audience pain points

### Platform Compliance
- [ ] Within character limits
- [ ] Follows platform best practices
- [ ] Appropriate formatting
- [ ] Hashtags/mentions where relevant

### Quality Standards
- [ ] Hook grabs attention immediately
- [ ] Value proposition is clear
- [ ] Call-to-action is present
- [ ] No spelling or grammar errors
- [ ] Sounds human (not AI-generated)

</quality_verification>

---

<metadata_requirements>

## Required Metadata for Each Variant

### Character Count
- Exact character count including spaces
- Flag if over platform limit

### Word Count
- Total word count
- Flag if outside optimal range

### Key Features
- Primary differentiator from other variants
- Psychological trigger employed
- Audience segment targeted

### Rationale
- Why this approach was chosen
- Expected performance factors
- Suggested use case

</metadata_requirements>
