/**
 * Brand Profile Schema Validation
 */

/**
 * Validate brand profile structure
 */
export function validateBrandProfile(profile) {
  const errors = [];

  // Validate brand section
  if (!profile.brand) {
    errors.push('Missing brand section');
  } else {
    if (!profile.brand.name) errors.push('Missing brand.name');
    if (!Array.isArray(profile.brand.valueProps)) errors.push('brand.valueProps must be an array');
  }

  // Validate voice section
  if (!profile.voice) {
    errors.push('Missing voice section');
  } else {
    if (!Array.isArray(profile.voice.personality)) errors.push('voice.personality must be an array');
    if (!profile.voice.toneSliders || typeof profile.voice.toneSliders !== 'object') {
      errors.push('voice.toneSliders must be an object');
    }
    if (!profile.voice.lexicon || typeof profile.voice.lexicon !== 'object') {
      errors.push('voice.lexicon must be an object');
    }
  }

  // Validate audience section
  if (!profile.audience) {
    errors.push('Missing audience section');
  } else {
    if (!Array.isArray(profile.audience.needs)) errors.push('audience.needs must be an array');
    if (!Array.isArray(profile.audience.painPoints)) errors.push('audience.painPoints must be an array');
  }

  // Validate writingGuide section
  if (!profile.writingGuide) {
    errors.push('Missing writingGuide section');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Serialize brand profile for D1 storage
 */
export function serializeBrandProfile(profile) {
  return {
    id: generateId(),
    domain: profile.metadata?.domain || 'unknown',
    name: profile.brand?.name || 'Unknown',
    tagline: profile.brand?.tagline || '',
    story: profile.brand?.story || '',
    mission: profile.brand?.mission || '',
    positioning: profile.brand?.positioning || '',
    value_props: JSON.stringify(profile.brand?.valueProps || []),
    voice_personality: JSON.stringify(profile.voice?.personality || []),
    tone_sliders: JSON.stringify(profile.voice?.toneSliders || {}),
    lexicon_preferred: JSON.stringify(profile.voice?.lexicon?.preferred || []),
    lexicon_avoid: JSON.stringify(profile.voice?.lexicon?.avoid || []),
    audience_primary: profile.audience?.primary || '',
    audience_needs: JSON.stringify(profile.audience?.needs || []),
    audience_pain_points: JSON.stringify(profile.audience?.painPoints || []),
    writing_guide: JSON.stringify(profile.writingGuide || {}),
    additional_instructions: JSON.stringify(profile.additionalInstructions || [])
  };
}

/**
 * Deserialize brand profile from D1 row
 * Returns nested structure matching extension BrandProfile type
 */
export function deserializeBrandProfile(row) {
  return {
    // Root-level identity fields
    id: row.id,
    metadata: {
      domain: row.domain,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    },
    // Nested brand object (expected by extension ProfileTab)
    brand: {
      name: row.name,
      tagline: row.tagline,
      story: row.story,
      mission: row.mission,
      positioning: row.positioning,
      valueProps: JSON.parse(row.value_props || '[]')
    },
    // Nested voice object
    voice: {
      personality: JSON.parse(row.voice_personality || '[]'),
      toneSliders: JSON.parse(row.tone_sliders || '{}'),
      lexicon: {
        preferred: JSON.parse(row.lexicon_preferred || '[]'),
        avoid: JSON.parse(row.lexicon_avoid || '[]')
      }
    },
    // Nested audience object
    audience: {
      primary: row.audience_primary,
      needs: JSON.parse(row.audience_needs || '[]'),
      painPoints: JSON.parse(row.audience_pain_points || '[]')
    },
    writingGuide: JSON.parse(row.writing_guide || '{}'),
    additionalInstructions: JSON.parse(row.additional_instructions || '[]'),
    // Keep flat fields for backward compatibility with webapp
    domain: row.domain,
    name: row.name,
    tagline: row.tagline,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Generate unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
