/**
 * Sanitize text by removing markdown formatting
 * Converts markdown to plain text while preserving readability
 */
export function sanitizeMarkdown(text: string): string {
  if (!text) return text;

  let sanitized = text;

  // Remove bold markers (**text** or __text__)
  sanitized = sanitized.replace(/\*\*(.+?)\*\*/g, '$1');
  sanitized = sanitized.replace(/__(.+?)__/g, '$1');

  // Remove italic markers (*text* or _text_)
  sanitized = sanitized.replace(/\*(.+?)\*/g, '$1');
  sanitized = sanitized.replace(/_(.+?)_/g, '$1');

  // Remove strikethrough (~~text~~)
  sanitized = sanitized.replace(/~~(.+?)~~/g, '$1');

  // Remove code blocks (```code```)
  sanitized = sanitized.replace(/```[\s\S]*?```/g, (match) => {
    // Extract just the code content without the backticks
    return match.replace(/```(\w+)?\n?/g, '').replace(/```/g, '');
  });

  // Remove inline code (`code`)
  sanitized = sanitized.replace(/`(.+?)`/g, '$1');

  // Convert headers to plain text with proper spacing
  sanitized = sanitized.replace(/^#{1,6}\s+(.+)$/gm, '$1\n');

  // Remove link syntax but keep the text [text](url) -> text
  sanitized = sanitized.replace(/\[(.+?)\]\(.+?\)/g, '$1');

  // Remove image syntax ![alt](url)
  sanitized = sanitized.replace(/!\[.*?\]\(.+?\)/g, '');

  // Remove bullet points and list markers
  sanitized = sanitized.replace(/^[\*\-\+]\s+/gm, '• ');
  sanitized = sanitized.replace(/^\d+\.\s+/gm, (match) => {
    const num = match.match(/\d+/);
    return num ? `${num[0]}. ` : '• ';
  });

  // Remove blockquote markers
  sanitized = sanitized.replace(/^>\s+/gm, '');

  // Remove horizontal rules
  sanitized = sanitized.replace(/^[-*_]{3,}$/gm, '');

  // Clean up excessive whitespace
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitize user input to prevent injection or formatting issues
 */
export function sanitizeUserInput(text: string): string {
  if (!text) return text;

  // Trim whitespace
  let sanitized = text.trim();

  // Remove null bytes and control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Limit consecutive newlines to 2
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  return sanitized;
}

/**
 * Sanitize text for text-to-speech
 * Removes markdown and converts special characters/symbols to readable text
 */
export function sanitizeForAudio(text: string): string {
  if (!text) return text;

  // First remove all markdown
  let sanitized = sanitizeMarkdown(text);

  // Convert common math symbols to words
  sanitized = sanitized.replace(/∑/g, 'sum');
  sanitized = sanitized.replace(/∫/g, 'integral');
  sanitized = sanitized.replace(/∂/g, 'partial derivative');
  sanitized = sanitized.replace(/∆/g, 'delta');
  sanitized = sanitized.replace(/π/g, 'pi');
  sanitized = sanitized.replace(/α/g, 'alpha');
  sanitized = sanitized.replace(/β/g, 'beta');
  sanitized = sanitized.replace(/γ/g, 'gamma');
  sanitized = sanitized.replace(/θ/g, 'theta');
  sanitized = sanitized.replace(/λ/g, 'lambda');
  sanitized = sanitized.replace(/μ/g, 'mu');
  sanitized = sanitized.replace(/σ/g, 'sigma');
  sanitized = sanitized.replace(/ω/g, 'omega');
  sanitized = sanitized.replace(/Σ/g, 'Sigma');
  sanitized = sanitized.replace(/Ω/g, 'Omega');
  
  // Convert math operators to words
  sanitized = sanitized.replace(/≈/g, 'approximately equals');
  sanitized = sanitized.replace(/≠/g, 'not equals');
  sanitized = sanitized.replace(/≤/g, 'less than or equal to');
  sanitized = sanitized.replace(/≥/g, 'greater than or equal to');
  sanitized = sanitized.replace(/×/g, 'times');
  sanitized = sanitized.replace(/÷/g, 'divided by');
  sanitized = sanitized.replace(/±/g, 'plus or minus');
  sanitized = sanitized.replace(/√/g, 'square root of');
  sanitized = sanitized.replace(/∞/g, 'infinity');
  
  // Convert common special characters
  sanitized = sanitized.replace(/°/g, ' degrees');
  sanitized = sanitized.replace(/©/g, 'copyright');
  sanitized = sanitized.replace(/®/g, 'registered');
  sanitized = sanitized.replace(/™/g, 'trademark');
  sanitized = sanitized.replace(/€/g, 'euros');
  sanitized = sanitized.replace(/£/g, 'pounds');
  sanitized = sanitized.replace(/¥/g, 'yen');
  
  // Replace multiple consecutive special chars with single space
  sanitized = sanitized.replace(/[^\w\s.,!?;:()\-'"]/g, ' ');
  
  // Clean up excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Recursively sanitize mind map node labels
 */
export function sanitizeMindMapNode(node: any): any {
  if (!node) return node;
  return {
    ...node,
    label: sanitizeMarkdown(node.label || ""),
    children: (node.children || []).map(sanitizeMindMapNode),
  };
}
