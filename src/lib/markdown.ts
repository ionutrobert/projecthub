function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderInlineMarkdown(value: string) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/`([^`]+)`/g, "<code class=\"rounded bg-muted px-1 py-0.5 text-[0.9em]\">$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      "<a class=\"text-primary underline\" href=\"$2\" target=\"_blank\" rel=\"noreferrer\">$1</a>",
    );
}

export function renderMarkdownHtml(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    if (!line.trim()) {
      closeList();
      html.push("<br />");
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
      const cls =
        level === 1
          ? "text-base font-semibold"
          : level === 2
            ? "text-sm font-semibold"
            : "text-sm font-medium";
      html.push(`<${tag} class=\"${cls} mt-2\">${renderInlineMarkdown(heading[2])}</${tag}>`);
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.*)$/);
    if (listItem) {
      if (!inList) {
        html.push("<ul class=\"ml-4 list-disc space-y-1\">");
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(listItem[1])}</li>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      html.push(
        `<blockquote class=\"border-l-2 border-border pl-3 text-muted-foreground\">${renderInlineMarkdown(quote[1])}</blockquote>`,
      );
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  closeList();
  return html.join("\n");
}
